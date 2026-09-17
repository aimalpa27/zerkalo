from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import ValidationError

from apps.restaurants.models import Restaurant
from apps.users.permissions import IsRestaurantAdmin, IsRestaurantStaff
from .models import Shift
from .serializers import ShiftSerializer


class ShiftListCreateView(generics.ListCreateAPIView):
    serializer_class = ShiftSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsRestaurantAdmin()]
        return [IsRestaurantStaff()]

    def get_queryset(self):
        rest_id = self.kwargs['rest_id']
        restaurant = get_object_or_404(Restaurant, id=rest_id)

        if not restaurant.has_feature('schedule'):
            return Shift.objects.none()

        qs = Shift.objects.filter(restaurant_id=rest_id).select_related('staff')

        date_from = self.request.query_params.get('from')
        date_to = self.request.query_params.get('to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        user = self.request.user
        if not user.is_admin_or_manager and not user.is_superadmin:
            if restaurant.schedule_visibility != 'all':
                qs = qs.filter(staff=user)

        return qs

    def perform_create(self, serializer):
        rest_id = self.kwargs['rest_id']
        restaurant = get_object_or_404(Restaurant, id=rest_id)
        if not restaurant.has_feature('schedule'):
            raise ValidationError({'detail': 'График смен недоступен на текущем тарифе.'})
        serializer.save(restaurant=restaurant)


class ShiftDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsRestaurantAdmin]
    serializer_class = ShiftSerializer
    http_method_names = ['get', 'patch', 'delete']

    def get_queryset(self):
        return Shift.objects.filter(restaurant_id=self.kwargs['rest_id'])
