from rest_framework import serializers
from .models import EarnProduct, EarnPosition, ConvertTrade, CopyTrader, CopyFollow, P2PAd, P2POrder, Announcement, Testimonial, GridBot, GridFill

class EarnProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = EarnProduct
        fields = "__all__"

class EarnPositionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    asset = serializers.CharField(source="product.asset", read_only=True)
    apy = serializers.DecimalField(source="product.apy", max_digits=8, decimal_places=2, read_only=True)
    unlock_at = serializers.DateTimeField(read_only=True)
    is_unlocked = serializers.BooleanField(read_only=True)
    pending_interest = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()

    class Meta:
        model = EarnPosition
        fields = "__all__"

    def get_pending_interest(self, obj):
        return str(obj.pending_interest())

    def get_total(self, obj):
        return str(obj.amount + obj.accrued + obj.pending_interest())

class ConvertSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConvertTrade
        fields = "__all__"

class CopyTraderSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    class Meta:
        model = CopyTrader
        fields = "__all__"

class P2PAdSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    class Meta:
        model = P2PAd
        fields = "__all__"

class P2POrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = P2POrder
        fields = "__all__"

class TestimonialSerializer(serializers.ModelSerializer):
    initials = serializers.SerializerMethodField()

    class Meta:
        model = Testimonial
        fields = ("id", "name", "role", "quote", "rating", "highlight", "initials")

    def get_initials(self, obj):
        parts = [p for p in obj.name.replace(".", " ").split() if p]
        return "".join(p[0] for p in parts[:2]).upper() or "V"

    def to_representation(self, instance):
        # The template renders exactly five stars, so a rating stored above 5
        # (easy to do through the API or a data import) would silently render as
        # five filled stars and misreport the value in the aria-label.
        row = super().to_representation(instance)
        row["rating"] = max(1, min(5, row["rating"]))
        return row


class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = "__all__"

class GridBotSerializer(serializers.ModelSerializer):
    class Meta:
        model = GridBot
        fields = "__all__"
        read_only_fields = ("user", "profit", "status")

class GridFillSerializer(serializers.ModelSerializer):
    class Meta:
        model = GridFill
        fields = "__all__"
