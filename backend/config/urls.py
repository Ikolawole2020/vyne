from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/wallet/", include("wallet.urls")),
    path("api/trading/", include("trading.urls")),
    path("api/admin/", include("adminpanel.urls")),
    path("api/products/", include("products.urls")),
]
