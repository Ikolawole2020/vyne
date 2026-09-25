from rest_framework import serializers
from .models import Wallet, PlatformDepositAddress, UserWalletAddress, DepositRequest, WithdrawalRequest, AdminNotification

class WalletSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=28, decimal_places=8, read_only=True)
    class Meta:
        model = Wallet
        fields = ("asset", "available", "frozen", "total")

class PlatformAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformDepositAddress
        fields = "__all__"

class UserAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserWalletAddress
        fields = "__all__"
        read_only_fields = ("user",)

class DepositSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    class Meta:
        model = DepositRequest
        fields = "__all__"
        read_only_fields = ("user", "status", "to_address", "processed_at")

class WithdrawalSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    class Meta:
        model = WithdrawalRequest
        fields = "__all__"
        read_only_fields = ("user", "status", "fee")

class NotificationSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    class Meta:
        model = AdminNotification
        fields = "__all__"
