import secrets

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsRestaurantAdmin, IsRestaurantStaff
from apps.users.throttles import OrderRateThrottle
from apps.menu.models import Category, MenuItem, UpsellRule
from apps.menu.serializers import CategorySerializer, MenuItemSerializer
from apps.restaurants.models import Restaurant
from apps.restaurants.serializers import RestaurantSerializer
from .models import Table
from .serializers import BulkTableCreateSerializer, TableSerializer


class TableListCreateView(generics.ListCreateAPIView):
    serializer_class = TableSerializer

    def get_permissions(self):
        # FIX: список столов нужен официанту для оформления заказа (выбор
        # стола в "Новый заказ"), но раньше GET был доступен только
        # IsRestaurantAdmin — официант получал 403, и селект стола в
        # NewOrderModal оставался пустым несмотря на настроенные столы.
        # Создание/удаление столов остаётся только для администратора.
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
                raise ValidationError(
                    {'detail': f'Лимит столов ({plan.max_tables}) для тарифа "{plan.name}" исчерпан.'}
                )
        # FIX: Table has unique_together = ('restaurant', 'number'), but
        # `restaurant` isn't part of TableSerializer's fields (it's set
        # here via restaurant_id=rest_id), so DRF's automatic
        # UniqueTogetherValidator never runs. Without this check, creating
        # a table with a number that already exists for this restaurant
        # raised an unhandled IntegrityError (500) instead of a clean 400.
        number = serializer.validated_data.get('number')
        if Table.objects.filter(restaurant_id=rest_id, number=number).exists():
            raise ValidationError(
                {'number': f'Стол с номером {number} уже существует.'}
            )
        serializer.save(restaurant_id=rest_id)


class TableBulkCreateView(APIView):
    """Atomically creates a contiguous table range for one restaurant."""
    permission_classes = [IsRestaurantAdmin]

    def post(self, request, rest_id):
        serializer = BulkTableCreateSerializer(
            data=request.data, context={'request': request, 'view': self}
        )
        serializer.is_valid(raise_exception=True)
        start = serializer.validated_data['start']
        end = serializer.validated_data['end']
        zone = serializer.validated_data.get('zone')
        numbers = list(range(start, end + 1))

        with transaction.atomic():
            # Serialize table-capacity decisions for this restaurant so two
            # concurrent bulk requests cannot both pass the tariff check.
            restaurant = get_object_or_404(
                Restaurant.objects.select_for_update(), id=rest_id
            )
            duplicates = list(
                Table.objects.filter(restaurant=restaurant, number__in=numbers)
                .order_by('number').values_list('number', flat=True)
            )
            if duplicates:
                raise ValidationError({
                    'numbers': [str(number) for number in duplicates],
                    'detail': 'Диапазон не создан: некоторые номера столов уже существуют.',
                })

            plan = restaurant.subscription_plan
            current = Table.objects.filter(restaurant=restaurant).count()
            if plan and plan.max_tables is not None and current + len(numbers) > plan.max_tables:
                available = max(0, plan.max_tables - current)
                raise ValidationError({
                    'detail': (
                        f'Лимит столов ({plan.max_tables}) для тарифа "{plan.name}". '
                        f'Можно создать ещё {available}.'
                    )
                })

            created = Table.objects.bulk_create([
                Table(restaurant=restaurant, number=number, zone=zone)
                for number in numbers
            ])

        return Response(TableSerializer(created, many=True).data, status=201)


class TableDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsRestaurantAdmin]
    serializer_class = TableSerializer
    lookup_field = 'pk'

    def get_queryset(self):
        rest_id = self.kwargs['rest_id']
        return Table.objects.filter(restaurant_id=rest_id)


class TableRegenerateTokenView(APIView):
    """
    POST /api/v1/restaurants/<rest_id>/tables/<pk>/regenerate-token/
    Rotates the table's QR token, invalidating the previously printed QR code.
    Admin/manager of the restaurant only (superadmin allowed).
    """
    permission_classes = [IsRestaurantAdmin]

    def post(self, request, rest_id, pk):
        table = get_object_or_404(Table, id=pk, restaurant_id=rest_id)
        table.token = secrets.token_urlsafe()
        table.save(update_fields=['token'])
        return Response(TableSerializer(table).data)


class GuestTableInfoView(APIView):
    """
    GET /api/v1/guest/<table_token>/
    Public — no auth required.
    Returns table + restaurant + categories + available menu items.
    Used by guest screen.
    """
    permission_classes = [AllowAny]

    def get(self, request, table_token):
        table = get_object_or_404(
            Table.objects.select_related('restaurant', 'restaurant__subscription_plan'),
            token=table_token, is_active=True,
        )
        restaurant = table.restaurant

        categories = Category.objects.filter(
            restaurant=restaurant
        ).order_by('sort_order')

        menu_items = MenuItem.objects.filter(
            restaurant=restaurant,
            is_available=True,
            is_visible=True,
        ).select_related('category').order_by('sort_order')

        upsell_rules = UpsellRule.objects.filter(restaurant=restaurant, is_active=True, trigger_item__is_available=True, trigger_item__is_visible=True, recommended_item__is_available=True, recommended_item__is_visible=True).order_by('priority').values('id', 'trigger_item_id', 'recommended_item_id', 'priority')

        return Response({
            'upsell_rules': [{**rule, 'id': str(rule['id']), 'trigger_item_id': str(rule['trigger_item_id']), 'recommended_item_id': str(rule['recommended_item_id'])} for rule in upsell_rules],
            'table': {
                'id': str(table.id),
                'number': table.number,
                'token': table.token,
            },
            'restaurant': RestaurantSerializer(restaurant).data,
            'categories': CategorySerializer(categories, many=True).data,
            'menu_items': MenuItemSerializer(menu_items, many=True).data,
        })

class GuestUpsellEventView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OrderRateThrottle]

    def post(self, request, table_token):
        from apps.analytics.models import UpsellEvent
        table = get_object_or_404(Table.objects.select_related('restaurant'), token=table_token, is_active=True)
        event_type = request.data.get('event_type')
        if event_type not in ('impression', 'add'):
            raise ValidationError({'event_type': 'Разрешены только impression или add.'})
        rule = get_object_or_404(
            UpsellRule.objects.filter(
                restaurant=table.restaurant, is_active=True,
                trigger_item__is_available=True, trigger_item__is_visible=True,
                recommended_item__is_available=True, recommended_item__is_visible=True,
            ), id=request.data.get('rule_id')
        )
        UpsellEvent.objects.create(restaurant=table.restaurant, rule=rule, table=table, event_type=event_type)
        return Response(status=status.HTTP_204_NO_CONTENT)
