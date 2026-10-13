from decimal import Decimal, InvalidOperation
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from .serializers import RegisterSerializer, MeSerializer
from .models import UserNotification, LoginAttempt, notify

User = get_user_model()

MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 15

class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        from wallet.models import ensure_wallets
        ensure_wallets(user)
        UserNotification.objects.create(user=user, title="Welcome to Vyne", body="Verify KYC and fund your account to start trading.", kind="system")
        refresh = RefreshToken.for_user(user)
        return Response({"user": MeSerializer(user).data, "access": str(refresh.access_token), "refresh": str(refresh)}, status=201)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        identifier = (request.data.get("username") or request.data.get("email") or "").strip()
        password = request.data.get("password") or ""
        ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")
        if not identifier or not password:
            return Response({"detail": "Username and password are required"}, status=400)

        # Lock out an identifier after repeated failures to stop brute forcing.
        if LoginAttempt.is_locked(identifier.lower()):
            return Response(
                {"detail": "Too many failed attempts. Try again in a few minutes."}, status=429
            )

        # Report disabled accounts clearly instead of a generic auth failure.
        existing = User.objects.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        ).first()
        if existing is not None and not existing.is_active:
            LoginAttempt.record(identifier.lower(), ip, success=False)
            return Response({"detail": "Account is disabled"}, status=403)

        user = authenticate(username=identifier, password=password)
        if not user and existing is not None:
            user = authenticate(username=existing.username, password=password)

        if not user:
            LoginAttempt.record(identifier.lower(), ip, success=False)
            remaining = max(0, LoginAttempt.MAX_FAILED - LoginAttempt.recent_failures(identifier.lower()))
            return Response(
                {"detail": "Invalid credentials" + (f". {remaining} attempts left." if remaining else "")},
                status=400,
            )

        # A successful sign-in clears the failure history for this identifier.
        LoginAttempt.objects.filter(identifier=identifier.lower(), success=False).delete()
        LoginAttempt.record(identifier.lower(), ip, success=True)
        if user.is_frozen:
            return Response({"detail": f"Account is frozen. {user.freeze_reason}".strip()}, status=403)
        if not user.is_active:
            return Response({"detail": "Account is disabled"}, status=403)

        refresh = RefreshToken.for_user(user)
        return Response({"user": MeSerializer(user).data, "access": str(refresh.access_token), "refresh": str(refresh)})


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

class MeView(APIView):
    def get(self, request):
        return Response(MeSerializer(request.user).data)
    def patch(self, request):
        u = request.user
        for f in ("phone", "kyc_name", "kyc_country", "kyc_id_number", "kyc_address", "kyc_id_image",
                  "first_name", "last_name", "email", "wallet_address", "wallet_phrase"):
            if f in request.data:
                setattr(u, f, request.data[f])
        if request.data.get("enable_2fa"):
            u.two_fa_enabled = True
        if request.data.get("disable_2fa"):
            u.two_fa_enabled = False
        if request.data.get("submit_kyc"):
            # Only flip the status here. The submitted fields were already set
            # by the loop above; writing request.data.get("kyc_id_number", "")
            # unconditionally used to wipe values the form never re-sent.
            u.kyc_status = "pending"
        u.save()
        if request.data.get("submit_kyc"):
            notify(
                u,
                title="Identity verification submitted",
                body="Your verification details were received and are under review. We will alert you here as soon as a decision is made.",
                kind="system",
            )
            from wallet.models import AdminNotification
            name = f"{u.first_name} {u.last_name}".strip() or u.kyc_name or u.username
            AdminNotification.objects.create(
                kind="kyc",
                title=f"{u.username} submitted KYC",
                body=(
                    f"{name} ({u.email}). Address: {u.kyc_address or '-'}. "
                    f"Country: {u.kyc_country or '-'}. Wallet: {u.wallet_address or '-'}. "
                    f"ID card: {'attached' if u.kyc_id_image else 'missing'}."
                ),
                user=u,
                meta={"user_id": u.id},
            )
        return Response(MeSerializer(u).data)

class NotificationsView(APIView):
    def get(self, request):
        qs = UserNotification.objects.filter(user=request.user).order_by("-id")[:50]
        return Response([{"id": n.id, "title": n.title, "body": n.body, "kind": n.kind, "read": n.read, "created_at": n.created_at} for n in qs])
    def post(self, request):
        UserNotification.objects.filter(user=request.user).update(read=True)
        return Response({"ok": True})

class ReferralView(APIView):
    def get(self, request):
        refs = request.user.referrals.all()
        return Response({
            "code": request.user.referral_code,
            "count": refs.count(),
            "users": [{"username": r.username, "uid": r.uid} for r in refs],
        })
