from django.urls import path

from .views import ZoneDetailView, ZoneListCreateView, ZoneTablesBulkMoveView

urlpatterns = [
    path(
        'restaurants/<uuid:rest_id>/zones/',
        ZoneListCreateView.as_view(),
        name='zone-list-create',
    ),
    path(
        'restaurants/<uuid:rest_id>/zones/<uuid:zone_id>/',
        ZoneDetailView.as_view(),
        name='zone-detail',
    ),
    path(
        'restaurants/<uuid:rest_id>/zones/<uuid:zone_id>/tables/',
        ZoneTablesBulkMoveView.as_view(),
        name='zone-tables-bulk-move',
    ),
]
