from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tables.models import Table
from apps.users.permissions import IsRestaurantAdmin, IsRestaurantStaff

from .models import Zone
from .serializers import ZoneSerializer


class ZoneListCreateView(generics.ListCreateAPIView):
    serializer_class = ZoneSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsRestaurantStaff()]
        return [IsRestaurantAdmin()]

    def get_queryset(self):
        rest_id = self.kwargs['rest_id']
        return Zone.objects.filter(restaurant_id=rest_id).order_by('sort_order')

    def perform_create(self, serializer):
        serializer.save(restaurant_id=self.kwargs['rest_id'])


class ZoneDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ZoneSerializer
    lookup_url_kwarg = 'zone_id'

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsRestaurantStaff()]
        return [IsRestaurantAdmin()]

    def get_queryset(self):
        return Zone.objects.filter(restaurant_id=self.kwargs['rest_id'])


class ZoneTablesBulkMoveView(APIView):
    """Атомарно переносит список столов в эту зону (сеттит tables.zone для всех table_ids)."""
    permission_classes = [IsRestaurantAdmin]

    def post(self, request, rest_id, zone_id):
        zone = get_object_or_404(Zone, id=zone_id, restaurant_id=rest_id)
        table_ids = request.data.get('table_ids', [])

        with transaction.atomic():
            updated = Table.objects.filter(
                id__in=table_ids, restaurant_id=rest_id,
            ).update(zone=zone)

        return Response({'updated': updated, 'zone_id': str(zone.id)}, status=status.HTTP_200_OK)
