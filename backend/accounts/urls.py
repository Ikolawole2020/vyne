from django.urls import path
from .views import RegisterView, LoginView, RefreshView, MeView, NotificationsView, ReferralView

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", LoginView.as_view()),
    path("refresh/", RefreshView.as_view()),
    path("me/", MeView.as_view()),
    path("notifications/", NotificationsView.as_view()),
    path("referrals/", ReferralView.as_view()),
]
