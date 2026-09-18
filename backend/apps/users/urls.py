from django.urls import path

from apps.users.views import (
    ChangePasswordView,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('refresh/', RefreshView.as_view(), name='auth-refresh'),
    # FIX: logout endpoint added — blacklists the refresh token immediately
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('me/', MeView.as_view(), name='auth-me'),
    path(
        'me/change-password/',
        ChangePasswordView.as_view(),
        name='auth-change-password',
    ),
]