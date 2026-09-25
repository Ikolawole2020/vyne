from django.urls import path
from .views import (
    UsersView, UserActionView, DepositAddressesAdminView, DepositsAdminView,
    CreditDepositView, WithdrawalsAdminView, ProcessWithdrawView, NotificationsView, StatsView,
)

urlpatterns = [
    path("users/", UsersView.as_view()),
    path("users/<int:user_id>/", UserActionView.as_view()),
    path("deposit-addresses/", DepositAddressesAdminView.as_view()),
    path("deposits/", DepositsAdminView.as_view()),
    path("deposits/<int:pk>/", CreditDepositView.as_view()),
    path("withdrawals/", WithdrawalsAdminView.as_view()),
    path("withdrawals/<int:pk>/", ProcessWithdrawView.as_view()),
    path("notifications/", NotificationsView.as_view()),
    path("stats/", StatsView.as_view()),
]
