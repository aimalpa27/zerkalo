from django.urls import path

from .views import ShiftDetailView, ShiftListCreateView

urlpatterns = [
    path('restaurants/<uuid:rest_id>/schedule/shifts/', ShiftListCreateView.as_view(), name='shift-list-create'),
    path('restaurants/<uuid:rest_id>/schedule/shifts/<uuid:pk>/', ShiftDetailView.as_view(), name='shift-detail'),
]
