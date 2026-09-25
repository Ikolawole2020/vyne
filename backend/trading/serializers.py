from rest_framework import serializers
from .models import Market, Order, Trade

class MarketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Market
        fields = "__all__"

class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = "__all__"
        read_only_fields = ("user", "filled_qty", "status")

class TradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trade
        fields = "__all__"

from .models import Position
class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = "__all__"
