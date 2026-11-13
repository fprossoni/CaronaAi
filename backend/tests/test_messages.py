"""PostgreSQL/PostGIS integration tests; all data and DDL are rolled back.

Run from backend: python -m unittest discover -s tests -p test_messages.py -v
Uses the configured DATABASE_URL, but only writes to a temporary schema.
"""

import importlib.util
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from geoalchemy2 import WKTElement
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import Base, engine, get_db
from app.main import app
from app.models import Block, Match, MatchStatus, Ride, RideStatus, User


class RideMessagesTest(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.addCleanup(self.connection.close)
        self.addCleanup(self.transaction.rollback)
        schema = "test_chat_" + uuid4().hex
        self.connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        self.connection.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
        # Test the actual new migration against a pre-chat schema.
        tables = [t for t in Base.metadata.sorted_tables if t.name not in ("conversations", "chat_messages")]
        Base.metadata.create_all(self.connection, tables=tables, checkfirst=False)
        path = Path(__file__).resolve().parents[1] / "alembic/versions/e9f4a5b6c7d8_ride_messages.py"
        spec = importlib.util.spec_from_file_location("chat_migration", path)
        self.migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.migration)
        with Operations.context(MigrationContext.configure(self.connection)):
            self.migration.upgrade()
        self.db = Session(bind=self.connection, join_transaction_mode="create_savepoint")
        self.addCleanup(self.db.close)
        for id in range(1, 6):
            self.db.add(User(id=id, email=f"test{id}@ufrgs.br", name=f"Pessoa {id}",
                             hashed_password="unused", is_verified=True, is_active=True, is_driver=id == 1))
        self.db.flush()
        self.ride = Ride(id=1, driver_id=1, origin_label="Campus", destination_label="Casa",
                         campus_point="campus_vale", departure_at=datetime.now(UTC) - timedelta(minutes=10),
                         status=RideStatus.ACTIVE, total_seats=4, available_seats=2,
                         origin_point=WKTElement("POINT(-51.1 -30.1)", srid=4326),
                         destination_point=WKTElement("POINT(-51.2 -30.2)", srid=4326))
        self.db.add(self.ride)
        self.db.flush()
        for id in (2, 3, 4):
            self.db.add(Match(id=id, ride_id=1, passenger_id=id,
                              status=MatchStatus.PENDING if id == 4 else MatchStatus.ACCEPTED,
                              pickup_point=WKTElement("POINT(-51.1 -30.1)", srid=4326),
                              pickup_label="Campus", pickup_region="Campus"))
        self.db.commit()
        self.user_id = 1

        def session():
            self.db.expire_all()
            yield self.db

        app.dependency_overrides[get_db] = session
        app.dependency_overrides[get_current_user] = lambda: self.db.get(User, self.user_id)
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def open(self, passenger_id=None):
        response = self.client.post("/messages", json={"ride_id": 1, "passenger_id": passenger_id})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["id"]

    def test_group_private_authorization_and_validation(self):
        group = self.open()
        self.assertEqual(group, self.open())
        private = self.open(2)
        self.assertNotEqual(group, private)
        self.assertEqual(private, self.open(2))
        url = f"/messages/{private}/items"
        self.assertEqual(self.client.post(url, json={"body": "   "}).status_code, 422)
        self.assertEqual(self.client.post(url, json={"body": "x" * 2001}).status_code, 422)
        response = self.client.post(url, json={"body": "  Cheguei!  ", "sender_id": 3})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["sender_id"], 1)
        self.assertEqual(response.json()["body"], "Cheguei!")
        self.user_id = 2
        self.assertEqual(len(self.client.get(url).json()), 1)
        self.assertEqual(self.client.post(url, json={"body": "Estou indo"}).status_code, 201)
        self.user_id = 3
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.client.post(url, json={"body": "intrusão"}).status_code, 403)
        self.assertEqual([c["id"] for c in self.client.get("/messages").json()], [group])
        self.assertEqual(self.client.post("/messages", json={"ride_id": 1, "passenger_id": 2}).status_code, 403)
        for user_id in (4, 5):
            self.user_id = user_id
            self.assertEqual(self.client.get(f"/messages/{group}/items").status_code, 403)
            self.assertEqual(self.client.get("/messages").json(), [])
            self.assertEqual(self.client.post("/messages", json={"ride_id": 1}).status_code, 403)

    def test_dynamic_membership_cancellation_and_blocks(self):
        group = self.open()
        private = self.open(2)
        self.db.add(Block(blocker_id=2, blocked_id=1))
        self.db.commit()
        self.assertEqual(self.client.get(f"/messages/{private}/items").status_code, 403)
        self.user_id = 2
        self.assertEqual(self.client.patch("/matches/2/cancel").status_code, 200)
        self.assertEqual(self.client.get(f"/messages/{group}/items").status_code, 403)
        self.assertEqual(self.client.get("/messages").json(), [])
        self.user_id = 1
        self.assertEqual([p["id"] for p in self.client.get("/messages").json()[0]["participants"]], [1, 3])
        pending = self.db.get(Match, 4)
        pending.status = MatchStatus.ACCEPTED
        self.db.commit()
        self.user_id = 4
        self.assertEqual(self.client.get(f"/messages/{group}/items").status_code, 200)

    def test_lifecycle_and_history(self):
        group = self.open()
        self.assertEqual(self.client.get("/rides/history").json(), [])  # Departed != completed
        self.user_id = 2
        self.assertEqual(self.client.patch("/rides/1/complete").status_code, 403)
        self.user_id = 1
        self.assertEqual(self.client.patch("/rides/1/complete").status_code, 409)
        self.assertEqual(self.client.patch("/rides/1/start").status_code, 200)
        self.assertEqual(self.client.get("/messages").json()[0]["id"], group)
        self.assertEqual(self.client.post(f"/messages/{group}/items", json={"body": "A caminho"}).status_code, 201)
        self.assertEqual(self.client.patch("/matches/4/respond", json={"action": "accept"}).status_code, 409)
        self.assertEqual(self.client.patch("/rides/1/complete").status_code, 200)
        self.assertEqual(self.client.get("/messages").json(), [])
        self.assertEqual(self.client.get("/rides/history").json()[0]["status"], "completed")
        self.assertEqual(self.client.post(f"/messages/{group}/items", json={"body": "Tarde"}).status_code, 409)
        self.assertEqual(self.client.get(f"/messages/{group}/items").status_code, 409)
        self.assertEqual(self.client.post("/messages", json={"ride_id": 1}).status_code, 409)

    def test_cancel_ride_closes_all_conversations(self):
        group = self.open()
        self.open(2)
        self.assertEqual(self.client.patch("/rides/1/cancel").status_code, 200)
        self.assertEqual(self.client.get("/messages").json(), [])
        self.assertEqual(self.client.get(f"/messages/{group}/items").status_code, 409)

    def test_message_pagination_and_downgrade(self):
        group = self.open()
        url = f"/messages/{group}/items"
        for i in range(55):
            self.assertEqual(self.client.post(url, json={"body": str(i)}).status_code, 201)
        latest = self.client.get(url).json()
        self.assertEqual(len(latest), 50)
        older = self.client.get(url, params={"before": latest[0]["id"]}).json()
        self.assertEqual([m["body"] for m in older], [str(i) for i in range(5)])
        new = self.client.get(url, params={"after": latest[-2]["id"]}).json()
        self.assertEqual([m["body"] for m in new], ["54"])
        self.assertEqual(self.client.get(url, params={"after": 1, "before": 5}).status_code, 400)
        self.db.close()
        with Operations.context(MigrationContext.configure(self.connection)):
            self.migration.downgrade()
        self.assertIsNone(self.connection.scalar(text("SELECT to_regclass(current_schema() || '.chat_messages')")))
