from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import (
    Wallet, PlatformDepositAddress, UserWalletAddress, DepositRequest,
    WithdrawalRequest, AdminNotification, listed_assets, networks_for,
    ensure_wallets, ensure_wallet,
)
from .serializers import (
    WalletSerializer, PlatformAddressSerializer, UserAddressSerializer,
    DepositSerializer, WithdrawalSerializer,
)

class WalletListView(APIView):
    def get(self, request):
        ensure_wallets(request.user)
        qs = Wallet.objects.filter(user=request.user)
        # Opt-in filter for the overview screen: only the coins the user
        # actually holds. Kept opt-in because the trade and withdraw screens
        # resolve a single asset by name and still need zero balances.
        if str(request.query_params.get("held", "")).lower() in {"1", "true", "yes"}:
            qs = qs.filter(Q(available__gt=0) | Q(frozen__gt=0))
        qs = qs.order_by("-available", "-frozen", "asset")
        return Response(WalletSerializer(qs, many=True).data)

class PlatformAddressesView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        qs = PlatformDepositAddress.objects.filter(is_active=True)
        asset = request.query_params.get("asset")
        if asset:
            qs = qs.filter(asset=asset)
        return Response(PlatformAddressSerializer(qs, many=True).data)

class UserAddressListCreate(generics.ListCreateAPIView):
    serializer_class = UserAddressSerializer
    def get_queryset(self):
        return UserWalletAddress.objects.filter(user=self.request.user).order_by("-id")
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class UserAddressDelete(generics.DestroyAPIView):
    serializer_class = UserAddressSerializer
    def get_queryset(self):
        return UserWalletAddress.objects.filter(user=self.request.user)

class CreateDepositView(APIView):
    @transaction.atomic
    def post(self, request):
        if request.user.is_frozen:
            return Response({"detail": "Account frozen"}, status=403)
        asset = request.data.get("asset", "USDT")
        network = request.data.get("network", "TRC20")
        if asset not in listed_assets() or network not in networks_for(asset):
            return Response({"detail": "Unsupported asset or network"}, status=400)
        try:
            amount = Decimal(str(request.data.get("amount", "0")))
        except (InvalidOperation, TypeError):
            return Response({"detail": "Invalid amount"}, status=400)
        if amount <= 0 or amount > Decimal("1000000000"):
            return Response({"detail": "Invalid amount"}, status=400)
        txid = str(request.data.get("txid", "")).strip()
        if not txid:
            return Response({"detail": "Transaction ID is required"}, status=400)
        addr = PlatformDepositAddress.objects.filter(asset=asset, network=network, is_active=True).first()
        if not addr:
            return Response({"detail": "No deposit address is configured for this network"}, status=400)
        if DepositRequest.objects.filter(user=request.user, txid=txid, status="pending").exists():
            return Response({"detail": "This transaction is already under review"}, status=400)
        dep = DepositRequest.objects.create(
            user=request.user, asset=asset, network=network, amount=amount,
            txid=txid, to_address=addr.address if addr else "",
        )
        AdminNotification.objects.create(
            kind="deposit",
            title=f"{request.user.username} deposited {amount} {asset}",
            body=f"User {request.user.username} (UID {request.user.uid}) submitted a deposit of {amount} {asset} on {network}. Credit after you confirm funds arrived at {dep.to_address}.",
            user=request.user,
            meta={"deposit_id": dep.id, "amount": str(amount), "asset": asset, "network": network, "txid": txid},
        )
        return Response(DepositSerializer(dep).data, status=201)

class MyDepositsView(generics.ListAPIView):
    serializer_class = DepositSerializer
    def get_queryset(self):
        return DepositRequest.objects.filter(user=self.request.user).order_by("-id")

class CreateWithdrawView(APIView):
    @transaction.atomic
    def post(self, request):
        if request.user.is_frozen:
            return Response({"detail": "Account frozen"}, status=403)
        if request.user.kyc_status != "verified":
            return Response(
                {"detail": "Complete identity verification before withdrawing funds."}, status=403
            )
        asset = request.data.get("asset", "USDT")
        network = request.data.get("network", "TRC20")
        if asset not in listed_assets() or network not in networks_for(asset):
            return Response({"detail": "Unsupported asset or network"}, status=400)
        try:
            amount = Decimal(str(request.data.get("amount", "0")))
        except (InvalidOperation, TypeError):
            return Response({"detail": "Invalid amount"}, status=400)
        address = str(request.data.get("address", "")).strip()
        memo = str(request.data.get("memo", "")).strip()
        if amount <= 0 or not address:
            return Response({"detail": "Amount and address required"}, status=400)
        fee = Decimal("1") if asset in {"USDT", "USDC"} else Decimal("0.0001")
        total = amount + fee
        w = ensure_wallet(request.user, asset)
        w = Wallet.objects.select_for_update().get(pk=w.pk)
        if w.available < total:
            return Response({"detail": "Insufficient balance"}, status=400)
        w.available -= total
        w.frozen += total
        w.save()
        wr = WithdrawalRequest.objects.create(
            user=request.user, asset=asset, network=network, amount=amount,
            fee=fee, address=address, memo=memo,
        )
        AdminNotification.objects.create(
            kind="withdraw",
            title=f"{request.user.username} requested withdraw {amount} {asset}",
            body=f"Send {amount} {asset} ({network}) to {address}. Fee {fee}.",
            user=request.user,
            meta={"withdrawal_id": wr.id, "amount": str(amount), "asset": asset, "address": address},
        )
        return Response(WithdrawalSerializer(wr).data, status=201)

class MyWithdrawalsView(generics.ListAPIView):
    serializer_class = WithdrawalSerializer
    def get_queryset(self):
        return WithdrawalRequest.objects.filter(user=self.request.user).order_by("-id")

class NetworksView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        return Response({
            "assets": listed_assets(),
            "networks": {a: networks_for(a) for a in listed_assets()},
        })
