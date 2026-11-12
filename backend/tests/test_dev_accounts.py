"""Integration coverage for development sessions and regular API access."""

import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.main import app
from app.models import User
from test_ride_routes import route_through


class DevAccountsTest(unittest.TestCase):
    def setUp(self):
        connection = engine.connect()
        transaction = connection.begin()
        self.addCleanup(connection.close)
        self.addCleanup(transaction.rollback)
        schema = "test_dev_" + uuid4().hex
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
        Base.metadata.create_all(connection, checkfirst=False)
        self.db = Session(bind=connection, join_transaction_mode="create_savepoint")
        self.addCleanup(self.db.close)
        app.dependency_overrides[get_db] = lambda: self.db
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.browser = {"X-Dev-Workspace": uuid4().hex}
        flag = patch.object(settings, "DEV_ACCOUNTS_ENABLED", True)
        flag.start()
        self.addCleanup(flag.stop)

    def create_account(self, name, gender):
        response = self.client.post("/dev/accounts", headers=self.browser, json={"name": name, "gender": gender})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def bearer(self, session):
        return {"Authorization": f"Bearer {session['access_token']}"}

    def test_create_switch_and_use_regular_ride_api(self):
        driver = self.create_account("  Luísa  ", "female")
        passenger = self.create_account("Rafael", "male")
        self.assertEqual(driver["user"]["name"], "Luísa")
        self.assertTrue(driver["user"]["is_verified"])
        self.assertTrue(driver["user"]["profile_complete"])
        self.assertIsNone(driver["user"]["birth_date"])
        self.assertIsNone(driver["user"]["course"])
        self.assertNotEqual(driver["user"]["id"], passenger["user"]["id"])

        driver_headers = self.bearer(driver)
        response = self.client.patch("/users/me", headers=driver_headers, json={"is_driver": True})
        self.assertEqual(response.status_code, 200, response.text)
        departure = datetime.now(UTC) + timedelta(hours=1)
        trip = {
            "origin_label": "Origem", "origin_lat": -30.033, "origin_lng": -51.221,
            "destination_campus_id": "campus_saude",
            "departure_at": departure.isoformat(),
        }
        with patch("app.api.rides.get_route", route_through):
            response = self.client.post("/rides/", headers=driver_headers, json=trip)
        self.assertEqual(response.status_code, 201, response.text)
        ride_id = response.json()["id"]

        driver_id = driver["user"]["id"]
        accounts = self.client.get("/dev/accounts", headers=self.browser).json()
        self.assertEqual([account["id"] for account in accounts], [driver_id, passenger["user"]["id"]])
        self.assertTrue(accounts[0]["is_driver"])
        self.assertEqual(self.client.get("/rides/my", headers=self.bearer(passenger)).json(), [])
        with patch("app.services.matching.get_route", route_through):
            search = self.client.get("/rides/search", headers=self.bearer(passenger), params={
                "pickup_lat": trip["origin_lat"], "pickup_lng": trip["origin_lng"],
                "dropoff_campus_id": trip["destination_campus_id"],
                "pickup_after": departure.isoformat(),
                "pickup_before": (departure + timedelta(minutes=10)).isoformat(),
            })
        self.assertEqual(search.status_code, 200, search.text)
        self.assertEqual([ride["id"] for ride in search.json()], [ride_id])

        switched = self.client.post(f"/dev/accounts/{driver_id}/session", headers=self.browser)
        self.assertEqual(switched.status_code, 200, switched.text)
        me = self.client.get("/users/me", headers=self.bearer(switched.json()))
        self.assertEqual(me.json()["id"], driver_id)
        self.assertEqual(self.client.get("/rides/my", headers=self.bearer(switched.json())).json()[0]["id"], ride_id)

    def test_switch_is_scoped_and_disabled_sessions_cannot_authenticate(self):
        session = self.create_account("Luísa", "female")
        account_id = session["user"]["id"]
        other_browser = {"X-Dev-Workspace": uuid4().hex}
        self.assertEqual(self.client.get("/dev/accounts", headers=other_browser).json(), [])
        self.assertEqual(self.client.post(f"/dev/accounts/{account_id}/session", headers=other_browser).status_code, 404)

        ordinary = User(email="regular@ufrgs.br", name="Conta regular", hashed_password="unused", is_verified=True)
        self.db.add(ordinary)
        self.db.commit()
        self.assertFalse(ordinary.profile_complete)
        self.assertEqual(self.client.post(f"/dev/accounts/{ordinary.id}/session", headers=self.browser).status_code, 404)

        with patch.object(settings, "DEV_ACCOUNTS_ENABLED", False):
            self.assertEqual(self.client.get("/dev/accounts", headers=self.browser).status_code, 404)
            self.assertEqual(self.client.get("/users/me", headers=self.bearer(session)).status_code, 401)
            refresh = self.client.post("/auth/refresh", json={"refresh_token": session["refresh_token"]})
            self.assertEqual(refresh.status_code, 401)
