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
from app.services.osrm import RouteResult, TravelLeg


async def route_through(points, with_geometry=False):
    coordinates = [[lng, lat] for lat, lng in points]
    geometry = {"type": "LineString", "coordinates": coordinates} if with_geometry else None
    legs = (180,) * (len(points) - 1)
    distance = 1200 + 300 * (len(points) - 2)
    return RouteResult(distance, sum(legs), geometry, legs, (distance / len(legs),) * len(legs))


async def sample_table(client, sources, destinations):
    return {(start, end): TravelLeg(1200, 180) for start in sources for end in destinations if start != end}


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
            User(id=3, email="another@ufrgs.br", name="Outro passageiro", hashed_password="unused",
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
        self.enterContext(patch("app.api.rides.get_route", side_effect=route_through))
        self.route = self.enterContext(patch("app.services.matching.get_route", side_effect=route_through))
        self.table = self.enterContext(patch("app.services.osrm._read_table", side_effect=sample_table))

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
        self.assertIsNone(ride["detour_geojson"])
        self.assertEqual(ride["detour_meters"], 1200)
        self.table.assert_awaited_once()
        self.route.assert_not_called()
        self.assertEqual(datetime.fromisoformat(ride["estimated_pickup_at"]), self.departure + timedelta(minutes=3))
        self.assertEqual(datetime.fromisoformat(ride["estimated_dropoff_at"]), self.departure + timedelta(minutes=6))

        response = self.client.post("/matches/", json={"ride_id": ride_id, **trip})
        self.assertEqual(response.status_code, 201, response.text)
        self.route.assert_awaited_once()
        match_id = response.json()["id"]
        self.user_id = 1
        pending = self.client.get(f"/matches/{match_id}").json()
        self.assertIsNone(pending["pickup_street"])
        self.assertIsNone(pending["dropoff_label"])

        accepted = self.client.patch(f"/matches/{match_id}/respond", json={"action": "accept"})
        self.assertEqual(accepted.status_code, 200, accepted.text)
        self.assertEqual(accepted.json()["dropoff_lat"], -30.043243)
        self.assertIn("Campus Saúde", accepted.json()["dropoff_label"])

    def test_single_time_search_request_and_accept(self):
        ride_id = self.create_ride()
        self.user_id = 2
        target = self.departure + timedelta(minutes=10)
        trip = {"pickup_address_id": 1, "dropoff_campus_id": "campus_saude",
                "desired_pickup_at": target.isoformat()}
        response = self.client.get("/rides/search", params=trip)
        self.assertEqual(response.status_code, 200, response.text)
        result, = response.json()
        self.assertEqual(result["pickup_difference_seconds"], -420)
        self.assertGreater(result["match_cost"], 0)
        self.table.assert_awaited_once()
        self.route.assert_not_called()
        response = self.client.post("/matches/", json={"ride_id": ride_id, **trip})
        self.assertEqual(response.status_code, 201, response.text)
        from app.models.match import Match
        match = self.db.get(Match, response.json()["id"])
        self.assertEqual(match.desired_pickup_at, target)
        self.assertEqual(match.pickup_before - match.pickup_after, timedelta(minutes=10))
        self.user_id = 1
        response = self.client.patch(f"/matches/{match.id}/respond", json={"action": "accept"})
        self.assertEqual(response.status_code, 200, response.text)

    def test_single_time_batch_and_changed_pickup_requires_new_request(self):
        ids = [self.create_ride(), self.create_ride()]
        self.user_id = 2
        response = self.client.post("/matches/batch", json={
            "ride_ids": ids, "pickup_address_id": 1,
            "dropoff_campus_id": "campus_saude",
            "desired_pickup_at": self.departure.isoformat(),
        })
        self.assertEqual(response.status_code, 201, response.text)
        created = response.json()["created"]
        self.assertEqual(len(created), 2)

        async def delayed_route(points, with_geometry=False):
            route = await route_through(points, with_geometry)
            route.leg_durations_seconds = (900,) * (len(points) - 1)
            route.duration_seconds = sum(route.leg_durations_seconds)
            return route

        self.route.side_effect = delayed_route
        self.user_id = 1
        response = self.client.patch(f"/matches/{created[0]['id']}/respond", json={"action": "accept"})
        self.assertEqual(response.status_code, 409, response.text)
        self.assertEqual(self.client.get(f"/rides/{ids[0]}").json()["available_seats"], 1)

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

    def test_acceptance_checks_each_detour_against_the_current_route(self):
        combined_distance = 12500

        async def route_with_expensive_second_stop(points, with_geometry=False):
            route = await route_through(points, with_geometry)
            if len(points) == 3:
                route.distance_meters = 2400
                route.leg_distances_meters = (1200, 1200)
                route.duration_seconds = 400
                route.leg_durations_seconds = (180, 220)
            elif len(points) == 4:
                route.distance_meters = combined_distance
                route.leg_distances_meters = (1400, 1600, combined_distance - 3000)
                route.duration_seconds = 810
                route.leg_durations_seconds = (180, 180, 450)
            return route

        self.route.side_effect = route_with_expensive_second_stop
        ride_id = self.create_ride(total_seats=2)
        original = self.client.get(f"/rides/{ride_id}").json()["route_geojson"]
        common = {"dropoff_campus_id": "campus_saude", **self.pickup_window()}
        first_trip = {"pickup_lat": -30.034, "pickup_lng": -51.219, **common}
        second_trip = {"pickup_lat": -30.038, "pickup_lng": -51.213, **common}
        requests = []
        for user_id, trip in ((2, first_trip), (3, second_trip)):
            self.user_id = user_id
            request = self.client.post("/matches/", json={"ride_id": ride_id, **trip})
            self.assertEqual(request.status_code, 201, request.text)
            requests.append(request.json()["id"])

        self.user_id = 1
        first = self.client.patch(f"/matches/{requests[0]}/respond", json={"action": "accept"})
        self.assertEqual(first.status_code, 200, first.text)
        route = self.client.get(f"/rides/{ride_id}").json()["route_geojson"]
        self.assertEqual(route["coordinates"][1], [-51.219, -30.034])
        second = self.client.patch(f"/matches/{requests[1]}/respond", json={"action": "accept"})
        self.assertEqual(second.status_code, 409, second.text)
        self.assertIn("desvio maior", second.json()["detail"])
        self.assertEqual(self.client.get(f"/rides/{ride_id}").json()["available_seats"], 1)

        self.user_id = 3
        self.table.reset_mock()
        search = self.client.get("/rides/search", params=first_trip)
        self.assertEqual(search.status_code, 200, search.text)
        result, = search.json()
        self.assertEqual(result["detour_meters"], 0)
        self.assertEqual(result["detour_seconds"], 0)
        self.assertEqual(result["route_geojson"], original)
        self.table.assert_not_called()

        self.user_id = 1
        combined_distance = 4600
        second = self.client.patch(f"/matches/{requests[1]}/respond", json={"action": "accept"})
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual(second.json()["detour_meters"], 2200)
        self.assertEqual(second.json()["detour_seconds"], 410)
        ride = self.client.get(f"/rides/{ride_id}").json()
        self.assertEqual(ride["route_distance_meters"], 4600)
        self.assertEqual(ride["route_duration_seconds"], 810)
        self.assertIn([-51.219, -30.034], ride["route_geojson"]["coordinates"])
        self.assertIn([-51.213, -30.038], ride["route_geojson"]["coordinates"])

        self.user_id = 2
        self.assertEqual(self.client.patch(f"/matches/{requests[0]}/cancel").status_code, 200)
        self.user_id = 1
        ride = self.client.get(f"/rides/{ride_id}").json()
        self.assertNotIn([-51.219, -30.034], ride["route_geojson"]["coordinates"])
        self.assertIn([-51.213, -30.038], ride["route_geojson"]["coordinates"])
        self.user_id = 3
        self.assertEqual(self.client.patch(f"/matches/{requests[1]}/cancel").status_code, 200)
        self.user_id = 1
        ride = self.client.get(f"/rides/{ride_id}").json()
        self.assertEqual(ride["route_geojson"], original)
        self.assertEqual(ride["available_seats"], 2)

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

    def test_campus_origin_batches_destinations_and_uses_departure_as_pickup(self):
        offer = {
            "origin_campus_id": "campus_centro", "destination_campus_id": None,
            "destination_label": "Rua de chegada", "destination_lat": -30.038, "destination_lng": -51.209,
        }
        self.create_ride(**offer)
        self.create_ride(**offer)
        self.user_id = 2
        trip = {"pickup_campus_id": "campus_centro", "dropoff_address_id": 2, **self.pickup_window()}
        response = self.client.get("/rides/search", params=trip)
        self.table.assert_awaited_once()
        _, sources, destinations = self.table.await_args.args
        self.assertEqual(sources, ((-30.03331, -51.221131), (-30.037, -51.211)))
        self.assertEqual(destinations, ((-30.038, -51.209), (-30.037, -51.211)))
        self.route.assert_not_called()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()), 2)
        ride = response.json()[0]
        self.assertEqual(datetime.fromisoformat(ride["estimated_pickup_at"]), self.departure)
        self.assertEqual(datetime.fromisoformat(ride["estimated_dropoff_at"]), self.departure + timedelta(minutes=3))
        self.assertIsNone(ride["detour_geojson"])

    def test_search_prioritizes_smaller_estimated_detour_over_earlier_pickup(self):
        first_origin = (-30.033, -51.221)
        second_origin = (-30.034, -51.222)
        pickup = (-30.034, -51.219)
        dropoff = (-30.043243, -51.206096)
        earlier_id = self.create_ride()
        smaller_id = self.create_ride(origin_lat=second_origin[0], origin_lng=second_origin[1])
        self.table.side_effect = None
        self.table.return_value = {
            (first_origin, pickup): TravelLeg(1800, 120),
            (second_origin, pickup): TravelLeg(600, 240),
            (pickup, dropoff): TravelLeg(2300, 180),
            (first_origin, dropoff): TravelLeg(2800, 210),
            (second_origin, dropoff): TravelLeg(2600, 390),
        }
        self.user_id = 2
        trip = {"pickup_address_id": 1, "dropoff_campus_id": "campus_saude", **self.pickup_window()}
        response = self.client.get("/rides/search", params=trip)
        self.assertEqual(response.status_code, 200, response.text)
        smaller, earlier = response.json()
        self.assertEqual((smaller["id"], earlier["id"]), (smaller_id, earlier_id))
        self.assertEqual((smaller["detour_meters"], earlier["detour_meters"]), (300, 1300))
        self.assertGreater(smaller["estimated_pickup_at"], earlier["estimated_pickup_at"])
        self.table.assert_awaited_once()
        self.route.assert_not_called()

        # A punctual ride with a larger detour loses to a slightly later one.
        response = self.client.get("/rides/search", params={
            "pickup_address_id": 1, "dropoff_campus_id": "campus_saude",
            "desired_pickup_at": (self.departure + timedelta(minutes=2)).isoformat(),
        })
        self.assertEqual(response.status_code, 200, response.text)
        smaller, punctual = response.json()
        self.assertEqual((smaller["id"], punctual["id"]), (smaller_id, earlier_id))
        self.assertEqual(punctual["pickup_difference_seconds"], 0)
        self.assertLess(smaller["match_cost"], punctual["match_cost"])

    def test_search_allows_estimated_detours_below_ten_kilometers(self):
        first_origin = (-30.033, -51.221)
        second_origin = (-30.034, -51.222)
        pickup = (-30.034, -51.219)
        dropoff = (-30.043243, -51.206096)
        eligible_id = self.create_ride()
        self.create_ride(origin_lat=second_origin[0], origin_lng=second_origin[1])
        self.table.side_effect = None
        self.table.return_value = {
            (first_origin, pickup): TravelLeg(7700, 180),
            (second_origin, pickup): TravelLeg(7701, 180),
            (pickup, dropoff): TravelLeg(3500, 240),
            (first_origin, dropoff): TravelLeg(1200, 180),
            (second_origin, dropoff): TravelLeg(1200, 180),
        }
        self.user_id = 2
        trip = {"pickup_address_id": 1, "dropoff_campus_id": "campus_saude", **self.pickup_window()}
        response = self.client.get("/rides/search", params=trip)
        self.assertEqual(response.status_code, 200, response.text)
        ride, = response.json()
        self.assertEqual(ride["id"], eligible_id)
        self.assertEqual(ride["detour_meters"], 10000)
        self.route.assert_not_called()

    def test_two_campuses_reuse_original_route_without_osrm_calls(self):
        ride_id = self.create_ride(origin_campus_id="campus_centro")
        self.create_ride(origin_campus_id="campus_saude", destination_campus_id="campus_centro")
        self.user_id = 2
        trip = {"pickup_campus_id": "campus_centro", "dropoff_campus_id": "campus_saude", **self.pickup_window()}
        response = self.client.get("/rides/search", params=trip)
        match = self.client.post("/matches/", json={"ride_id": ride_id, **trip})
        self.table.assert_not_called()
        self.route.assert_not_called()
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
