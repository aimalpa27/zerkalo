import secrets

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsRestaurantAdmin, IsRestaurantStaff
from apps.menu.models import Category, MenuItem
from apps.menu.serializers import CategorySerializer, MenuItemSerializer
from apps.restaurants.models import Restaurant
from apps.restaurants.serializers import RestaurantSerializer
from .models import Table
from .serializers import TableSerializer


class TableListCreateView(generics.ListCreateAPIView):
    serializer_class = TableSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsRestaurantAdmin()]
        return [IsRestaurantStaff()]

    def get_queryset(self):
        rest_id = self.kwargs['rest_id']
        return Table.objects.filter(restaurant_id=rest_id).order_by('number')

    def perform_create(self, serializer):
        rest_id = self.kwargs['rest_id']
        restaurant = get_object_or_404(Restaurant, id=rest_id)
        plan = restaurant.subscription_plan
        if plan and plan.max_tables is not None:
            current = Table.objects.filter(restaurant_id=rest_id).count()
            if current >= plan.max_tables:
                raise ValidationError({'detail': f'Лимит столов ({plan.max_tables}) для тарифа "{plan.name}" исчерпан.'})
        number = serializer.validated_data.get('number')
        if Table.objects.filter(restaurant_id=rest_id, number=number).exists():
            raise ValidationError({'number': f'Стол с номером {number} уже существует.'})
        serializer.save(restaurant_id=rest_id)


class TableBulkCreateView(APIView):
    """Atomically create a numeric range of tables for one restaurant."""
    permission_classes = [IsRestaurantAdmin]
    MAX_BATCH = 200

    def post(self, request, rest_id):
        restaurant = get_object_or_404(Restaurant, id=rest_id)
        try:
            start = int(request.data.get('start'))
            end = int(request.data.get('end'))
        except (TypeError, ValueError):
            raise ValidationError({'detail': 'Укажите целые номера start и end.'})

        if start < 1 or end < start:
            raise ValidationError({'detail': 'Диапазон должен начинаться с 1, а end должен быть не меньше start.'})
        count = end - start + 1
        if count > self.MAX_BATCH:
            raise ValidationError({'detail': f'За один раз можно создать не более {self.MAX_BATCH} столов.'})

        numbers = list(range(start, end + 1))
        duplicates = list(Table.objects.filter(restaurant_id=rest_id, number__in=numbers).values_list('number', flat=True))
        if duplicates:
            raise ValidationError({'duplicates': sorted(duplicates), 'detail': 'В диапазоне уже есть существующие столы.'})

        plan = restaurant.subscription_plan
        current = Table.objects.filter(restaurant_id=rest_id).count()
        if plan and plan.max_tables is not None and current + count > plan.max_tables:
            available = max(plan.max_tables - current, 0)
            raise ValidationError({'detail': f'Лимит тарифа — {plan.max_tables} столов. Можно добавить ещё {available}.'})

        zone = None
        zone_id = request.data.get('zone')
        if zone_id:
            from apps.zones.models import Zone
            zone = get_object_or_404(Zone, id=zone_id, restaurant_id=rest_id)

        with transaction.atomic():
            created = [Table.objects.create(restaurant=restaurant, number=number, zone=zone) for number in numbers]

        return Response({'created': TableSerializer(created, many=True).data, 'count': len(created)}, status=status.HTTP_201_CREATED)


class TableDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsRestaurantAdmin]
    serializer_class = TableSerializer
    lookup_field = 'pk'

    def get_queryset(self):
        return Table.objects.filter(restaurant_id=self.kwargs['rest_id'])


class TableRegenerateTokenView(APIView):
    permission_classes = [IsRestaurantAdmin]

    def post(self, request, rest_id, pk):
        table = get_object_or_404(Table, id=pk, restaurant_id=rest_id)
        table.token = secrets.token_urlsafe()
        table.save(update_fields=['token'])
        return Response(TableSerializer(table).data)


class GuestTableInfoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, table_token):
        table = get_object_or_404(Table.objects.select_related('restaurant', 'restaurant__subscription_plan'), token=table_token, is_active=True)
        restaurant = table.restaurant
        categories = Category.objects.filter(restaurant=restaurant).order_by('sort_order')
        menu_items = MenuItem.objects.filter(restaurant=restaurant, is_available=True, is_visible=True).select_related('category').order_by('sort_order')
        return Response({
            'table': {'id': str(table.id), 'number': table.number, 'token': table.token},
            'restaurant': RestaurantSerializer(restaurant).data,
            'categories': CategorySerializer(categories, many=True).data,
            'menu_items': MenuItemSerializer(menu_items, many=True).data,
        })
