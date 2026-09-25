from django.urls import path
from .views import (
    EarnListView, EarnSubscribeView, EarnMineView, EarnRedeemView,
    ConvertView, ConvertHistoryView, CopyListView, CopyFollowView,
    P2PAdListView, P2PAdCreateView, P2PTakeView, P2PMyOrdersView, P2PReleaseView, P2PCancelView, AnnouncementsView, GridListCreateView, GridStopView, GridFillsView,
)
urlpatterns = [
    path("earn/", EarnListView.as_view()),
    path("earn/subscribe/", EarnSubscribeView.as_view()),
    path("earn/mine/", EarnMineView.as_view()),
    path("earn/<int:pk>/redeem/", EarnRedeemView.as_view()),
    path("convert/", ConvertView.as_view()),
    path("convert/history/", ConvertHistoryView.as_view()),
    path("copy/", CopyListView.as_view()),
    path("copy/<int:pk>/follow/", CopyFollowView.as_view()),
    path("p2p/ads/", P2PAdListView.as_view()),
    path("p2p/ads/create/", P2PAdCreateView.as_view()),
    path("p2p/ads/<int:pk>/take/", P2PTakeView.as_view()),
    path("p2p/orders/", P2PMyOrdersView.as_view()),
    path("p2p/orders/<int:pk>/release/", P2PReleaseView.as_view()),
    path("p2p/orders/<int:pk>/cancel/", P2PCancelView.as_view()),
    path("announcements/", AnnouncementsView.as_view()),
    path("grids/", GridListCreateView.as_view()),
    path("grids/<int:pk>/stop/", GridStopView.as_view()),
    path("grids/<int:pk>/fills/", GridFillsView.as_view()),
]

