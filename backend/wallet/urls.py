from django.urls import path
from .views import (
    WalletListView, PlatformAddressesView, UserAddressListCreate, UserAddressDelete,
    CreateDepositView, MyDepositsView, CreateWithdrawView, MyWithdrawalsView, NetworksView,
)

urlpatterns = [
    path("balances/", WalletListView.as_view()),
    path("deposit-addresses/", PlatformAddressesView.as_view()),
    path("addresses/", UserAddressListCreate.as_view()),
    path("addresses/<int:pk>/", UserAddressDelete.as_view()),
    path("deposit/", CreateDepositView.as_view()),
    path("deposits/", MyDepositsView.as_view()),
    path("withdraw/", CreateWithdrawView.as_view()),
    path("withdrawals/", MyWithdrawalsView.as_view()),
    path("networks/", NetworksView.as_view()),
]
