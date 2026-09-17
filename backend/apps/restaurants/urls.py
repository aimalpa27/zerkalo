from django.urls import path

from apps.users.views import (
    AssignTablesView,
    StaffAssignmentView,
    StaffDetailView,
    StaffListCreateView,
)
from apps.analytics.views import AnalyticsSessionsView, AnalyticsSummaryView
from .views import (
    RestaurantBySlugView,
    RestaurantCoverUploadView,
    RestaurantDetailView,
    RestaurantIikoSettingsView,
    RestaurantIikoSyncView,
    RestaurantListView,
    RestaurantLogoUploadView,
    RestaurantPromoListView,
    RestaurantSettingsView,
)

urlpatterns = [
    # Public restaurant endpoints
    path('', RestaurantListView.as_view()),
    path('<uuid:pk>/', RestaurantDetailView.as_view()),
    path('by-slug/<slug:slug>/', RestaurantBySlugView.as_view()),
    path('<uuid:rest_id>/promos/', RestaurantPromoListView.as_view()),

    # Бренд / оформление (IsRestaurantAdmin — admin/manager своего ресторана + superadmin)
    path('<uuid:rest_id>/settings/', RestaurantSettingsView.as_view(), name='restaurant-settings'),
    path('<uuid:rest_id>/upload-logo/', RestaurantLogoUploadView.as_view(), name='restaurant-upload-logo'),
    path('<uuid:rest_id>/upload-cover/', RestaurantCoverUploadView.as_view(), name='restaurant-upload-cover'),

    # Интеграция iiko Cloud API (IsRestaurantAdmin)
    path('<uuid:rest_id>/iiko/', RestaurantIikoSettingsView.as_view(), name='restaurant-iiko-settings'),
    path('<uuid:rest_id>/iiko/sync/', RestaurantIikoSyncView.as_view(), name='restaurant-iiko-sync'),

    # D7 — Staff management (IsRestaurantAdmin)
    path('<uuid:rest_id>/staff/', StaffListCreateView.as_view(), name='staff-list-create'),
    path('<uuid:rest_id>/staff/<uuid:user_id>/', StaffDetailView.as_view(), name='staff-detail'),
    path('<uuid:rest_id>/staff/<uuid:user_id>/assign-tables/', AssignTablesView.as_view(), name='staff-assign-tables'),
    path('<uuid:rest_id>/staff/<uuid:user_id>/assignment/', StaffAssignmentView.as_view(), name='staff-assignment'),

    # D9 — Analytics (IsRestaurantAdmin)
    path('<uuid:rest_id>/analytics/summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
    path('<uuid:rest_id>/analytics/sessions/', AnalyticsSessionsView.as_view(), name='analytics-sessions'),
]