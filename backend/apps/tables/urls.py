from django.urls import path

from .views import (
    GuestTableInfoView,
    TableDetailView,
    TableListCreateView,
    TableRegenerateTokenView,
)


urlpatterns = [
    # Public guest endpoint — no auth required
    path(
        'guest/<str:table_token>/',
        GuestTableInfoView.as_view(),
        name='guest-table-info',
    ),
    path(
        'restaurants/<uuid:rest_id>/tables/',
        TableListCreateView.as_view(),
        name='table-list-create',
    ),
    path(
        'restaurants/<uuid:rest_id>/tables/<uuid:pk>/',
        TableDetailView.as_view(),
        name='table-detail',
    ),
    path(
        'restaurants/<uuid:rest_id>/tables/<uuid:pk>/regenerate-token/',
        TableRegenerateTokenView.as_view(),
        name='table-regenerate-token',
    ),
]
