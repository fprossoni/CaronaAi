"""PostGIS integration checks for campus matching and ride requests."""

import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import Base, engine, get_db
from app.main import app
from app.models import User, UserAddress
from app.services.osrm import RouteResult


async def route_through(points, with_geometry=False):
    coordinates = [[lng, lat] for lat, lng in points]
    geometry = {"type": "LineString", "coordinates": coordinates} if with_geometry else None
    legs = (180,) * (len(points) - 1)
    return RouteResult(1200 + 300 * (len(points) - 2), sum(legs), geometry, legs)


class RideRoutesTest(unittest.TestCase):
    def setUp(self):
        connection = engine.connect()
        transaction = connection.begin()
        self.addCleanup(connection.close)
        self.addCleanup(transaction.rollback)
        schema = "test_routes_" + uuid4().hex
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
        Base.metadata.create_all(connection, checkfirst=False)
        self.db = Session(bind=connection, join_transaction_mode="create_savepoint")
        self.addCleanup(self.db.close)
        self.db.add_all([
            User(id=1, email="driver@ufrgs.br", name="Motorista", hashed_password="unused",
                 is_active=True, is_verified=True, is_driver=True),
            User(id=2, email="passenger@ufrgs.br", name="Passageiro", hashed_password="unused",
                 is_active=True, is_verified=True),
        ])
        self.db.flush()
        self.db.add_all([
            UserAddress(id=1, user_id=2, label="Casa", street="Rua A", number="10",
                        postal_code="90000-001", lat=-30.034, lng=-51.219),
            UserAddress(id=2, user_id=2, label="Trabalho", street="Rua B", number="20",
                        postal_code="90000-002", lat=-30.037, lng=-51.211),
        ])
        self.db.commit()
        self.user_id = 1
        self.departure = datetime.now(UTC).replace(microsecond=0) + timedelta(hours=1)
        app.dependency_overrides[get_current_user] = lambda: self.db.get(User, self.user_id)
        app.dependency_overrides[get_db] = lambda: self.db
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        for target in ("app.api.rides.get_route", "app.services.matching.get_route"):
            mock = patch(target, route_through)
            mock.start()
            self.addCleanup(mock.stop)

    def create_ride(self, **changes):
        trip = {
            "origin_label": "Rua de partida", "origin_lat": -30.033, "origin_lng": -51.221,
            "destination_campus_id": "campus_saude",
            "departure_at": self.departure.isoformat(),
        }
        response = self.client.post("/rides/", json={**trip, **changes})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["id"]

    def pickup_window(self):
        return {
            "pickup_after": self.departure.isoformat(),
            "pickup_before": (self.departure + timedelta(minutes=10)).isoformat(),
        }

    def test_matching_campus_destination_search_and_request(self):
        ride_id = self.create_ride()
        completed_id = self.create_ride()
        self.assertEqual(self.client.patch(f"/rides/{completed_id}/start").status_code, 200)
        self.assertEqual(self.client.patch(f"/rides/{completed_id}/complete").status_code, 200)
        cancelled_id = self.create_ride()
        self.assertEqual(self.client.patch(f"/rides/{cancelled_id}/cancel").status_code, 200)
        self.user_id = 2
        trip = {"pickup_address_id": 1, "dropoff_campus_id": "campus_saude", **self.pickup_window()}
        response = self.client.get("/rides/search", params=trip)
        self.assertEqual(response.status_code, 200, response.text)
        ride, = response.json()
        self.assertEqual(ride["id"], ride_id)
        self.assertEqual(ride["driver"]["name"], "Motorista")
        self.assertEqual(ride["driver_completed_ride_count"], 1)
        self.assertEqual(ride["detour_geojson"]["coordinates"][1:], [[-51.219, -30.034], [-51.206096, -30.043243]])
        self.assertEqual(datetime.fromisoformat(ride["estimated_pickup_at"]), self.departure + timedelta(minutes=3))
        self.assertEqual(datetime.fromisoformat(ride["estimated_dropoff_at"]), self.departure + timedelta(minutes=6))

        response = self.client.post("/matches/", json={"ride_id": ride_id, **trip})
        self.assertEqual(response.status_code, 201, response.text)
        match_id = response.json()["id"]
        self.user_id = 1
        pending = self.client.get(f"/matches/{match_id}").json()
        self.assertIsNone(pending["pickup_street"])
        self.assertIsNone(pending["dropoff_label"])

        accepted = self.client.patch(f"/matches/{match_id}/respond", json={"action": "accept"})
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertEqual(accepted.json()["dropoff_lat"], -30.043243)
        self.assertIn("Campus Saúde", accepted.json()["dropoff_label"])

    def test_offer_preview_uses_the_published_route(self):
        points = {
            "origin": {"lat": -30.033, "lng": -51.221},
            "destination": {"lat": -30.043243, "lng": -51.206096},
        }
        preview = self.client.post("/rides/preview", json=points)
        self.assertEqual(preview.status_code, 200, preview.text)
        ride_id = self.create_ride()
        ride = self.client.get(f"/rides/{ride_id}").json()
        self.assertEqual(preview.json()["route_geojson"], ride["route_geojson"])
        self.user_id = 2
        self.assertEqual(self.client.post("/rides/preview", json=points).status_code, 403)

    def test_requires_same_campus_and_direction(self):
        ride_id = self.create_ride()
        self.user_id = 2
        for points in (
            {"pickup_address_id": 1, "dropoff_campus_id": "campus_centro"},
            {"pickup_campus_id": "campus_saude", "dropoff_address_id": 2},
        ):
            with self.subTest(points=points):
                trip = {**points, **self.pickup_window()}
                response = self.client.get("/rides/search", params=trip)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json(), [])
                response = self.client.post("/matches/", json={"ride_id": ride_id, **trip})
                self.assertEqual(response.status_code, 400, response.text)

    def test_passenger_may_use_another_campus_at_the_drivers_non_campus_endpoint(self):
        ride_id = self.create_ride()
        self.user_id = 2
        trip = {"pickup_campus_id": "campus_centro", "dropoff_campus_id": "campus_saude", **self.pickup_window()}
        response = self.client.get("/rides/search", params=trip)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([ride["id"] for ride in response.json()], [ride_id])

    def test_campus_origin_skips_table_and_uses_departure_as_pickup(self):
        offer = {
            "origin_campus_id": "campus_centro", "destination_campus_id": None,
            "destination_label": "Rua de chegada", "destination_lat": -30.038, "destination_lng": -51.209,
        }
        self.create_ride(**offer)
        self.create_ride(**offer)
        self.user_id = 2
        trip = {"pickup_campus_id": "campus_centro", "dropoff_address_id": 2, **self.pickup_window()}
        with patch("app.services.matching.get_pickup_durations") as table:
            response = self.client.get("/rides/search", params=trip)
        table.assert_not_called()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()), 2)
        ride = response.json()[0]
        self.assertEqual(datetime.fromisoformat(ride["estimated_pickup_at"]), self.departure)
        self.assertEqual(datetime.fromisoformat(ride["estimated_dropoff_at"]), self.departure + timedelta(minutes=3))
        self.assertEqual(ride["detour_geojson"]["coordinates"], [[-51.221131, -30.03331], [-51.211, -30.037], [-51.209, -30.038]])

    def test_two_campuses_reuse_original_route_without_osrm_calls(self):
        ride_id = self.create_ride(origin_campus_id="campus_centro")
        self.create_ride(origin_campus_id="campus_saude", destination_campus_id="campus_centro")
        self.user_id = 2
        trip = {"pickup_campus_id": "campus_centro", "dropoff_campus_id": "campus_saude", **self.pickup_window()}
        with patch("app.services.matching.get_pickup_durations") as table, patch("app.services.matching.get_route") as route:
            response = self.client.get("/rides/search", params=trip)
            match = self.client.post("/matches/", json={"ride_id": ride_id, **trip})
        table.assert_not_called()
        route.assert_not_called()
        self.assertEqual(response.status_code, 200, response.text)
        ride, = response.json()
        self.assertEqual(ride["id"], ride_id)
        self.assertEqual(ride["detour_meters"], 0)
        self.assertEqual(ride["detour_geojson"], ride["route_geojson"])
        self.assertEqual(datetime.fromisoformat(ride["estimated_dropoff_at"]), self.departure + timedelta(minutes=3))
        self.assertEqual(match.status_code, 201, match.text)
        one_campus = {"pickup_address_id": 1, "dropoff_campus_id": "campus_saude", **self.pickup_window()}
        self.assertEqual(self.client.get("/rides/search", params=one_campus).json(), [])
        response = self.client.post("/matches/batch", json={"ride_ids": [ride_id], **one_campus})
        self.assertEqual(response.status_code, 400, response.text)

    def test_rejects_trips_without_campus(self):
        response = self.client.post("/rides/", json={
            "campus_point": "campus_centro",
            "origin_label": "Rua A", "origin_lat": -30.033, "origin_lng": -51.221,
            "destination_label": "Rua B", "destination_lat": -30.038, "destination_lng": -51.209,
            "departure_at": self.departure.isoformat(),
        })
        self.assertEqual(response.status_code, 400, response.text)
        ride_id = self.create_ride()
        self.user_id = 2
        trip = {"pickup_address_id": 1, "dropoff_address_id": 2, **self.pickup_window()}
        self.assertEqual(self.client.get("/rides/search", params=trip).status_code, 400)
        self.assertEqual(self.client.post("/matches/", json={"ride_id": ride_id, **trip}).status_code, 400)

    def test_requires_two_points_and_rejects_another_users_saved_address(self):
        trip = {"pickup_lat": -30.034, "pickup_lng": -51.219, **self.pickup_window()}
        self.assertEqual(self.client.get("/rides/search", params=trip).status_code, 400)
        trip["dropoff_address_id"] = 2
        self.assertEqual(self.client.get("/rides/search", params=trip).status_code, 404)
