from decimal import Decimal, InvalidOperation
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.throttling import ScopedRateThrottle
from wallet.models import (
    Wallet, PlatformDepositAddress, DepositRequest, WithdrawalRequest,
    AdminNotification, ensure_wallets, listed_assets, archive_wallet, restore_wallet,
)
from wallet.serializers import WalletSerializer, PlatformAddressSerializer, DepositSerializer, WithdrawalSerializer, NotificationSerializer
from accounts.serializers import MeSerializer

User = get_user_model()

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


class AdminBase(APIView):
    """Base for every admin endpoint: staff-only, and deliberately given its
    own throttle bucket instead of the shared `user` one.

    The console polls /stats, /users, /notifications, /deposits, /withdrawals
    and /deposit-addresses every 8 seconds, which is ~2,700 requests/hour per
    admin session. Left on the default `user` rate (600/hour) every admin
    action starts returning 429 about 90 seconds after the page opens --
    including the edit-balance save. Access is already gated by is_staff plus a
    JWT, so a tight per-request budget buys nothing here.
    """

    permission_classes = [IsAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "admin"


class UsersView(AdminBase):
    def get(self, request):
        users = User.objects.all().order_by("-id")
        out = []
        for u in users:
            ensure_wallets(u)
            wallets = Wallet.objects.filter(user=u, archived=False)
            bals = {w.asset: str(w.available) for w in wallets}
            deleted = list(
                Wallet.objects.filter(user=u, archived=True)
                .values_list("asset", flat=True)
                .order_by("asset")
            )
            out.append({
                **MeSerializer(u).data,
                "balances": bals,
                "deleted_wallets": deleted,
                "is_frozen": u.is_frozen,
                "freeze_reason": u.freeze_reason,
            })
        return Response(out)

class UserActionView(AdminBase):
    @transaction.atomic
    def post(self, request, user_id):
        action = request.data.get("action")
        try:
            user = User.objects.select_for_update().get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=404)
        if action == "freeze":
            user.is_frozen = True
            user.freeze_reason = request.data.get("reason", "Frozen by admin")
            user.save(update_fields=["is_frozen", "freeze_reason"])
        elif action == "unfreeze":
            user.is_frozen = False
            user.freeze_reason = ""
            user.save(update_fields=["is_frozen", "freeze_reason"])
        elif action == "edit_account":
            editable = ("username", "email", "first_name", "last_name", "phone", "kyc_name", "kyc_country")
            for field in editable:
                if field in request.data:
                    setattr(user, field, str(request.data[field]).strip())
            try:
                user.full_clean()
            except Exception as exc:
                return Response({"detail": getattr(exc, "message_dict", None) or str(exc)}, status=400)
            user.save()
        elif action == "delete":
            if user.is_staff:
                return Response({"detail": "Cannot delete admin"}, status=400)
            user.delete()
            return Response({"ok": True})
        elif action in {"set_balance", "adjust_balance"}:
            asset = request.data.get("asset", "USDT")
            if not asset or asset not in listed_assets():
                return Response({"detail": "Invalid asset"}, status=400)
            try:
                ensure_wallets(user)
                w = Wallet.objects.select_for_update().get(user=user, asset=asset)
                if action == "set_balance":
                    available = Decimal(str(request.data.get("available", "0")))
                    frozen = Decimal(str(request.data.get("frozen", w.frozen)))
                    if available < 0 or frozen < 0:
                        return Response({"detail": "Balances cannot be negative"}, status=400)
                    w.available, w.frozen = available, frozen
                else:
                    delta = Decimal(str(request.data.get("delta", "0")))
                    if w.available + delta < 0:
                        return Response({"detail": "Adjustment would make balance negative"}, status=400)
                    w.available += delta
                w.save(update_fields=["available", "frozen"])
            except (InvalidOperation, Wallet.DoesNotExist):
                return Response({"detail": "Invalid balance or asset"}, status=400)
        elif action in {"delete_wallet", "restore_wallet"}:
            asset = request.data.get("asset", "USDT")
            if not asset or asset not in listed_assets():
                return Response({"detail": "Invalid asset"}, status=400)
            try:
                # The row may not exist yet for a user who has never opened the
                # wallet screen, so materialise it before looking it up.
                ensure_wallets(user)
                w = Wallet.objects.select_for_update().get(user=user, asset=asset)
            except Wallet.DoesNotExist:
                return Response({"detail": "Wallet not found"}, status=404)
            if action == "delete_wallet":
                error = archive_wallet(w, request.user)
                if error:
                    return Response({"detail": error}, status=400)
            else:
                error = restore_wallet(w)
                if error:
                    return Response({"detail": error}, status=400)
            # Return early: the trailing ensure_wallets() below would recreate
            # the row we just archived, undoing the delete immediately.
            bals = {x.asset: str(x.available) for x in Wallet.objects.filter(user=user, archived=False)}
            deleted = list(
                Wallet.objects.filter(user=user, archived=True)
                .values_list("asset", flat=True).order_by("asset")
            )
            return Response({**MeSerializer(user).data, "balances": bals, "deleted_wallets": deleted})
        elif action == "verify_kyc":
            user.kyc_status = "verified"
            user.save()
        elif action == "reject_kyc":
            user.kyc_status = "rejected"
            user.save()
        elif action == "set_vip":
            user.vip_level = int(request.data.get("vip_level", 0))
            user.save()
        else:
            return Response({"detail": "Unknown action"}, status=400)
        ensure_wallets(user)
        bals = {w.asset: str(w.available) for w in Wallet.objects.filter(user=user, archived=False)}
        return Response({**MeSerializer(user).data, "balances": bals})

class DepositAddressesAdminView(AdminBase):
    def get(self, request):
        return Response(PlatformAddressSerializer(PlatformDepositAddress.objects.all(), many=True).data)
    def post(self, request):
        asset = request.data.get("asset")
        network = request.data.get("network")
        address = request.data.get("address")
        memo = request.data.get("memo", "")
        obj, _ = PlatformDepositAddress.objects.update_or_create(
            asset=asset, network=network,
            defaults={"address": address, "memo": memo, "is_active": True},
        )
        return Response(PlatformAddressSerializer(obj).data)

class DepositsAdminView(AdminBase):
    def get(self, request):
        return Response(DepositSerializer(DepositRequest.objects.select_related("user").order_by("-id"), many=True).data)

class CreditDepositView(AdminBase):
    @transaction.atomic
    def post(self, request, pk):
        try:
            dep = DepositRequest.objects.select_for_update().select_related("user").get(pk=pk)
        except DepositRequest.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        action = request.data.get("action", "credit")
        if dep.status != "pending":
            return Response({"detail": "Deposit has already been processed"}, status=400)
        if action == "credit":
            ensure_wallets(dep.user)
            w = Wallet.objects.select_for_update().get(user=dep.user, asset=dep.asset)
            try:
                amount = Decimal(str(request.data.get("amount", dep.amount)))
            except InvalidOperation:
                return Response({"detail": "Invalid amount"}, status=400)
            if amount <= 0:
                return Response({"detail": "Amount must be positive"}, status=400)
            w.available += amount
            w.save(update_fields=["available"])
            dep.status = "credited"
            dep.processed_at = timezone.now()
            dep.note = request.data.get("note", "Credited by admin")
            dep.save(update_fields=["status", "processed_at", "note"])
        elif action == "reject":
            dep.status = "rejected"
            dep.processed_at = timezone.now()
            dep.note = request.data.get("note", "Rejected")
            dep.save(update_fields=["status", "processed_at", "note"])
        else:
            return Response({"detail": "Unknown action"}, status=400)
        return Response(DepositSerializer(dep).data)

class WithdrawalsAdminView(AdminBase):
    def get(self, request):
        return Response(WithdrawalSerializer(WithdrawalRequest.objects.select_related("user").order_by("-id"), many=True).data)

class ProcessWithdrawView(AdminBase):
    @transaction.atomic
    def post(self, request, pk):
        try:
            wr = WithdrawalRequest.objects.select_for_update().select_related("user").get(pk=pk)
        except WithdrawalRequest.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        action = request.data.get("action")
        if wr.status != "pending":
            return Response({"detail": "Withdrawal has already been processed"}, status=400)
        total = wr.amount + wr.fee
        w = Wallet.objects.select_for_update().get(user=wr.user, asset=wr.asset)
        if w.frozen < total:
            return Response({"detail": "Reserved withdrawal balance is unavailable"}, status=400)
        if action == "approve":
            w.frozen -= total
            w.save(update_fields=["frozen"])
            wr.status = "sent"
            wr.save(update_fields=["status"])
        elif action == "reject":
            w.frozen -= total
            w.available += total
            w.save(update_fields=["frozen", "available"])
            wr.status = "rejected"
            wr.save(update_fields=["status"])
        else:
            return Response({"detail": "Unknown action"}, status=400)
        return Response(WithdrawalSerializer(wr).data)

class NotificationsView(AdminBase):
    def get(self, request):
        qs = AdminNotification.objects.select_related("user").order_by("-id")[:200]
        unread = AdminNotification.objects.filter(read=False).count()
        return Response({"unread": unread, "items": NotificationSerializer(qs, many=True).data})
    def post(self, request):
        AdminNotification.objects.filter(id__in=request.data.get("ids", [])).update(read=True)
        if request.data.get("all"):
            AdminNotification.objects.update(read=True)
        return Response({"ok": True})

class StatsView(AdminBase):
    def get(self, request):
        return Response({
            "users": User.objects.count(),
            "frozen": User.objects.filter(is_frozen=True).count(),
            "pending_deposits": DepositRequest.objects.filter(status="pending").count(),
            "pending_withdrawals": WithdrawalRequest.objects.filter(status="pending").count(),
            "unread": AdminNotification.objects.filter(read=False).count(),
        })
