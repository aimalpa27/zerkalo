import secrets

from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers
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

        return Response({
            'table': {
                'id': str(table.id),
                'number': table.number,
                'token': table.token,
            },
            'restaurant': RestaurantSerializer(restaurant).data,
            'categories': CategorySerializer(categories, many=True).data,
            'menu_items': MenuItemSerializer(menu_items, many=True).data,
        })