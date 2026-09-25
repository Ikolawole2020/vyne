"""Authentication, lockout and account security tests."""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import LoginAttempt

User = get_user_model()


class AuthTests(APITestCase):
    def setUp(self):
        self.client.logout()
        self.user = User.objects.create_user("alice", "alice@vyne.test", "Str0ngPass123")

    def login(self, username="alice", password="Str0ngPass123"):
        return self.client.post("/api/auth/login/", {"username": username, "password": password}, format="json")

    def test_login_success_returns_tokens(self):
        resp = self.login()
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertEqual(resp.data["user"]["username"], "alice")

    def test_login_with_email(self):
        resp = self.login(username="alice@vyne.test")
        self.assertEqual(resp.status_code, 200)

    def test_wrong_password_is_rejected(self):
        self.assertEqual(self.login(password="wrong").status_code, 400)

    def test_account_locks_after_repeated_failures(self):
        for _ in range(LoginAttempt.MAX_FAILED):
            self.login(password="wrong")
        resp = self.login(password="wrong")
        self.assertEqual(resp.status_code, 429)
        # Correct password is also blocked while locked out
        self.assertEqual(self.login().status_code, 429)

    def test_successful_login_resets_the_counter(self):
        for _ in range(LoginAttempt.MAX_FAILED - 1):
            self.login(password="wrong")
        self.assertEqual(self.login().status_code, 200)
        self.assertEqual(LoginAttempt.recent_failures("alice"), 0)

    def test_frozen_account_cannot_log_in(self):
        self.user.is_frozen = True
        self.user.freeze_reason = "Under review"
        self.user.save()
        resp = self.login()
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Under review", resp.data["detail"])

    def test_disabled_account_cannot_log_in(self):
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.login().status_code, 403)

    def test_refresh_token_issues_new_access_token(self):
        token = self.login().data["refresh"]
        resp = self.client.post("/api/auth/refresh/", {"refresh": token}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)

    def test_weak_password_is_rejected_on_register(self):
        resp = self.client.post("/api/auth/register/", {
            "username": "weakling", "email": "w@vyne.test", "password": "12345",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_registration_creates_wallets(self):
        resp = self.client.post("/api/auth/register/", {
            "username": "newbie", "email": "n@vyne.test", "password": "Str0ngPass123",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        newbie = User.objects.get(username="newbie")
        self.assertTrue(newbie.wallets.filter(asset="USDT").exists())
        self.assertTrue(newbie.wallets.filter(asset="BTC").exists())

    def test_unauthenticated_requests_are_denied(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/wallet/balances/").status_code, 401)
