from django.urls import path

from .views import (
    WaiterCallCreateView,
    WaiterCallListView,
    WaiterCallUpdateView,
)

urlpatterns = [
    path(
        'waiter-calls/',
        WaiterCallCreateView.as_view(),
        name='waiter-call-create',
    ),
    path(
        'restaurants/<uuid:rest_id>/waiter-calls/',
        WaiterCallListView.as_view(),
        name='waiter-call-list',
    ),
    path(
        'restaurants/<uuid:rest_id>/waiter-calls/<uuid:pk>/',
        WaiterCallUpdateView.as_view(),
        name='waiter-call-update',
    ),
]