from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import AllowAny

from apps.tables.models import Table
from apps.users.permissions import IsRestaurantStaff
from apps.users.throttles import WaiterCallRateThrottle
from .models import WaiterCall
from .serializers import WaiterCallSerializer, WaiterCallStatusUpdateSerializer


class WaiterCallCreateView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [WaiterCallRateThrottle]
    serializer_class = WaiterCallSerializer

    def perform_create(self, serializer):
        token = self.request.data.get('table_token')
        table = get_object_or_404(Table, token=token, is_active=True)
        call = serializer.save(
            restaurant=table.restaurant,
            table=table,
            table_number=table.number,
            table_token=token,
        )
        # D-10: notify staff
        try:
            from apps.websocket.events import notify_staff
            notify_staff(str(table.restaurant_id), 'waiter_call', {
                'call_id': str(call.id),
                'table_id': str(table.id),
                'table_number': table.number,
                'reason': call.reason,
            })
        except Exception:
            pass


class WaiterCallListView(generics.ListAPIView):
    permission_classes = [IsRestaurantStaff]
    serializer_class = WaiterCallSerializer

    def get_queryset(self):
        rest_id = self.kwargs['rest_id']
        queryset = WaiterCall.objects.filter(restaurant_id=rest_id).order_by('-created_at')

        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)

        user = self.request.user
        if user.role == 'waiter' and (user.assigned_tables.exists() or user.assigned_zones.exists()):
            queryset = queryset.filter(table_id__in=user.effective_table_ids)

        # FIX: unbounded list endpoint — cap to the 500 most recent calls so
        # a restaurant with a long history of waiter calls cannot trigger an
        # unbounded-size response (pagination is disabled globally).
        return queryset[:500]


class WaiterCallUpdateView(generics.UpdateAPIView):
    permission_classes = [IsRestaurantStaff]
    # FIX: WaiterCallSerializer marks `status` read-only, which made this
    # endpoint a no-op (200 OK, status never changed). Use the dedicated
    # serializer that allows validated status transitions.
    serializer_class = WaiterCallStatusUpdateSerializer
    http_method_names = ['patch']

    def get_queryset(self):
        rest_id = self.kwargs['rest_id']
        return WaiterCall.objects.filter(restaurant_id=rest_id)
