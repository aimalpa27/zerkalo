from django.urls import path
from .views import GuestLoyaltyStatusView, LoyaltyDashboardView, LoyaltyProgramView
urlpatterns = [
    path('guest/<str:table_token>/loyalty/<uuid:member_token>/', GuestLoyaltyStatusView.as_view(), name='guest-loyalty-status'),
    path('restaurants/<uuid:rest_id>/loyalty/', LoyaltyDashboardView.as_view(), name='loyalty-dashboard'),
    path('restaurants/<uuid:rest_id>/loyalty/program/', LoyaltyProgramView.as_view(), name='loyalty-program'),
]
