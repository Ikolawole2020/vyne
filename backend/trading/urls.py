from django.urls import path
from .views import MarketListView, MarketTickView, FeedStatusView, PlaceOrderView, MyOrdersView, CancelOrderView, MyTradesView, OpenFuturesView, CloseFuturesView, PositionsView, OrderBookView

urlpatterns = [
    path("markets/", MarketListView.as_view()),
    path("tick/", MarketTickView.as_view()),
    path("feed-status/", FeedStatusView.as_view()),
    path("orderbook/", OrderBookView.as_view()),
    path("order/", PlaceOrderView.as_view()),
    path("orders/", MyOrdersView.as_view()),
    path("orders/<int:pk>/cancel/", CancelOrderView.as_view()),
    path("trades/", MyTradesView.as_view()),
    path("futures/", OpenFuturesView.as_view()),
    path("futures/<int:pk>/close/", CloseFuturesView.as_view()),
    path("positions/", PositionsView.as_view()),
]

