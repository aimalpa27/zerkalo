from django.urls import path

from .views import (
    SubscriptionPlanDetailView,
    SubscriptionPlanListCreateView,
    SuperAdminRestaurantDetailView,
    SuperAdminRestaurantListView,
)

urlpatterns = [
    path('plans/', SubscriptionPlanListCreateView.as_view(), name='subscription-plan-list'),
    path('plans/<uuid:pk>/', SubscriptionPlanDetailView.as_view(), name='subscription-plan-detail'),
    path('restaurants/', SuperAdminRestaurantListView.as_view(), name='superadmin-restaurant-list'),
    path('restaurants/<uuid:rest_id>/', SuperAdminRestaurantDetailView.as_view(), name='superadmin-restaurant-detail'),
]