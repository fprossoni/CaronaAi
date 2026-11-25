"""Authentication delivery and recovery checks; isolated PostGIS schema."""
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import Settings, settings
from app.core.database import Base, engine, get_db
from app.core.email import send_code_email
from app.core.security import hash_password
from app.main import app
from app.models.user import EmailVerificationToken, User


class EmailDeliveryTest(unittest.TestCase):
    def test_debug_is_the_master_switch_for_dev_accounts(self):
        config = Settings(_env_file=None, DEBUG=False, DEV_ACCOUNTS_ENABLED=True)
        self.assertFalse(config.DEV_ACCOUNTS_ENABLED)

    def test_debug_never_connects_to_smtp(self):
        with patch.object(settings, "DEBUG", True), patch("app.core.email.smtplib.SMTP") as smtp:
            send_code_email("student@ufrgs.br", "123456")
            smtp.assert_not_called()

    def test_production_requires_credentials(self):
        with patch.object(settings, "DEBUG", False), patch.object(settings, "SMTP_USER", ""):
            with self.assertRaises(HTTPException) as error:
                send_code_email("student@ufrgs.br", "123456")
            self.assertEqual(error.exception.status_code, 503)

    def test_real_delivery_and_sender_fallback(self):
        with patch.object(settings, "DEBUG", False), patch.object(settings, "SMTP_USER", "sender@example.com"), patch.object(settings, "SMTP_PASSWORD", "test"), patch.object(settings, "EMAIL_FROM", ""), patch("app.core.email.smtplib.SMTP") as smtp:
            send_code_email("student@ufrgs.br", "123456", recovery=True)
            connection = smtp.return_value.__enter__.return_value
            connection.starttls.assert_called_once()
            message = connection.send_message.call_args.args[0]
            self.assertEqual(message["From"], "sender@example.com")
            self.assertEqual(message["To"], "student@ufrgs.br")
            self.assertIn("123456", message.get_content())

    def test_smtp_failure_is_reported(self):
        with patch.object(settings, "DEBUG", False), patch.object(settings, "SMTP_USER", "sender@example.com"), patch.object(settings, "SMTP_PASSWORD", "test"), patch("app.core.email.smtplib.SMTP", side_effect=OSError):
            with self.assertRaises(HTTPException) as error:
                send_code_email("student@ufrgs.br", "123456")
            self.assertEqual(error.exception.status_code, 503)


class AuthTest(unittest.TestCase):
    def setUp(self):
        connection = engine.connect()
        transaction = connection.begin()
        self.addCleanup(connection.close)
        self.addCleanup(transaction.rollback)
        schema = "test_auth_" + uuid4().hex
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
        Base.metadata.create_all(connection, checkfirst=False)
        self.db = Session(bind=connection, join_transaction_mode="create_savepoint")
        self.addCleanup(self.db.close)
        self.db.add(User(email="student@ufrgs.br", name="Student", hashed_password=hash_password("password1"), is_active=True, is_verified=True))
        self.db.commit()
        def session():
            yield self.db
        app.dependency_overrides[get_db] = session
        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        debug = patch.object(settings, "DEBUG", True)
        debug.start()
        self.addCleanup(debug.stop)

    def recover(self):
        return self.client.post("/auth/forgot-password", json={"email": "STUDENT@ufrgs.br"})

    def reset(self, token):
        return self.client.post("/auth/reset-password", json={"email": "student@ufrgs.br", "token": token, "password": "newpassword1"})

    def test_recovery_single_use_and_session_revocation(self):
        old = self.client.post("/auth/login", json={"email": "student@ufrgs.br", "password": "password1"}).json()
        response = self.recover()
        self.assertEqual(response.status_code, 200)
        code = response.json()["dev_token"]
        self.assertEqual(self.reset(code).status_code, 200)
        self.assertEqual(self.reset(code).status_code, 400)
        self.assertEqual(self.client.post("/auth/login", json={"email": "student@ufrgs.br", "password": "password1"}).status_code, 401)
        self.assertEqual(self.client.post("/auth/login", json={"email": "student@ufrgs.br", "password": "newpassword1"}).status_code, 200)
        self.assertEqual(self.client.get("/users/me", headers={"Authorization": "Bearer " + old["access_token"]}).status_code, 401)
        self.assertEqual(self.client.post("/auth/refresh", json={"refresh_token": old["refresh_token"]}).status_code, 401)

    def test_attempt_limit_cooldown_expiry_and_purpose(self):
        code = self.recover().json()["dev_token"]
        self.assertEqual(self.recover().status_code, 429)
        self.assertEqual(self.client.post("/auth/verify-email", json={"email": "student@ufrgs.br", "token": code}).status_code, 400)
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            self.assertEqual(self.reset(wrong).status_code, 400)
        self.assertEqual(self.reset(code).status_code, 400)
        saved = self.db.scalar(select(EmailVerificationToken).where(EmailVerificationToken.purpose == "password_reset"))
        saved.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        self.db.commit()
        fresh = self.recover().json()["dev_token"]
        self.assertNotEqual(saved.used, False)
        self.assertEqual(self.reset(fresh).status_code, 200)

    def test_registration_resend_without_login(self):
        response = self.client.post("/auth/register", json={"email": "new@ufrgs.br", "name": "New", "password": "password1"})
        self.assertEqual(response.status_code, 201)
        code = self.db.scalar(select(EmailVerificationToken).join(User).where(User.email == "new@ufrgs.br"))
        code.expires_at -= timedelta(minutes=2)
        self.db.commit()
        response = self.client.post("/auth/resend-verification", json={"email": "new@ufrgs.br"})
        self.assertEqual(response.status_code, 200)
        response = self.client.post("/auth/verify-email", json={"email": "new@ufrgs.br", "token": response.json()["dev_token"]})
        self.assertEqual(response.status_code, 200)

    def test_production_does_not_expose_codes(self):
        with patch.object(settings, "DEBUG", False), patch("app.api.auth.send_code_email") as send:
            response = self.recover()
            self.assertNotIn("dev_token", response.json())
            send.assert_called_once()
        response = self.client.post("/auth/forgot-password", json={"email": "absent@ufrgs.br"})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("dev_token", response.json())

    def test_delivery_failure_does_not_create_account(self):
        with patch.object(settings, "DEBUG", False), patch.object(settings, "SMTP_USER", ""):
            response = self.client.post("/auth/register", json={"email": "new@ufrgs.br", "name": "New", "password": "password1"})
            self.assertEqual(response.status_code, 503)
        self.db.rollback()
        self.assertIsNone(self.db.scalar(select(User).where(User.email == "new@ufrgs.br")))
