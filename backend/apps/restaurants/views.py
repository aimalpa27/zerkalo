import cloudinary.uploader
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsRestaurantAdmin
from apps.integrations.iiko import IikoError
from apps.integrations.tasks import sync_restaurant_menu
from .models import Promo, Restaurant
from .serializers import (
    PromoSerializer,
    RestaurantIikoSettingsSerializer,
    RestaurantSerializer,
    RestaurantSettingsSerializer,
)


class RestaurantListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = RestaurantSerializer
    queryset = Restaurant.objects.filter(is_public=True).select_related('subscription_plan')


class RestaurantDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = RestaurantSerializer
    queryset = Restaurant.objects.select_related('subscription_plan')


class RestaurantBySlugView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = RestaurantSerializer
    lookup_field = 'slug'
    queryset = Restaurant.objects.select_related('subscription_plan')


class RestaurantSettingsView(generics.RetrieveUpdateAPIView):
    """
    GET/PATCH /api/v1/restaurants/<rest_id>/settings/
    Бренд и оформление ресторана: лого, обложка, цвет темы, адрес, контакты.
    Доступно admin/manager этого ресторана и superadmin (тех-поддержка).
    """
    permission_classes = [IsRestaurantAdmin]
    serializer_class = RestaurantSettingsSerializer

    def get_object(self):
        return get_object_or_404(Restaurant, id=self.kwargs['rest_id'])


# FIX (IMPORTANT): RestaurantLogoUploadView/RestaurantCoverUploadView previously
# accepted any file under the field name "image" with no content-type or size
# check, unlike apps.menu.views.MenuItemImageUploadView. An admin (or anyone
# with a leaked admin token) could upload arbitrarily large files or
# non-image content (e.g. HTML/SVG with embedded scripts) straight to
# Cloudinary, which is then served back to every guest visiting the
# restaurant's public page — a stored-content / bandwidth-cost risk.
# Mirrors the validation already used by MenuItemImageUploadView.
_MAX_BRANDING_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
_ALLOWED_BRANDING_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}


def _validate_branding_image(uploaded_file):
    """Returns an error Response if the file is invalid, else None."""
    if uploaded_file.content_type not in _ALLOWED_BRANDING_IMAGE_TYPES:
        return Response(
            {'detail': 'Недопустимый тип файла. Разрешены: JPEG, PNG, WEBP.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if uploaded_file.size > _MAX_BRANDING_IMAGE_SIZE:
        return Response(
            {'detail': 'Файл слишком большой. Максимальный размер — 10MB.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


class RestaurantLogoUploadView(APIView):
    """POST /api/v1/restaurants/<rest_id>/upload-logo/ — аватар/лого ресторана."""
    permission_classes = [IsRestaurantAdmin]

    def post(self, request, rest_id):
        restaurant = get_object_or_404(Restaurant, id=rest_id)
        uploaded_file = request.FILES.get('image')
        if not uploaded_file:
            return Response({'detail': 'Файл "image" обязателен.'}, status=status.HTTP_400_BAD_REQUEST)

        error = _validate_branding_image(uploaded_file)
        if error:
            return error

        result = cloudinary.uploader.upload(
            uploaded_file,
            folder=f'plait/restaurants/{rest_id}/logo',
            transformation=[
                {'width': 400, 'height': 400, 'crop': 'fill', 'quality': 'auto', 'fetch_format': 'auto'},
            ],
        )
        restaurant.logo_url = result['secure_url']
        restaurant.save(update_fields=['logo_url', 'updated_at'])
        return Response(RestaurantSerializer(restaurant).data)


class RestaurantCoverUploadView(APIView):
    """POST /api/v1/restaurants/<rest_id>/upload-cover/ — обложка ресторана."""
    permission_classes = [IsRestaurantAdmin]

    def post(self, request, rest_id):
        restaurant = get_object_or_404(Restaurant, id=rest_id)
        uploaded_file = request.FILES.get('image')
        if not uploaded_file:
            return Response({'detail': 'Файл "image" обязателен.'}, status=status.HTTP_400_BAD_REQUEST)

        error = _validate_branding_image(uploaded_file)
        if error:
            return error

        result = cloudinary.uploader.upload(
            uploaded_file,
            folder=f'plait/restaurants/{rest_id}/cover',
            transformation=[
                {'width': 1200, 'height': 600, 'crop': 'fill', 'quality': 'auto', 'fetch_format': 'auto'},
            ],
        )
        restaurant.cover_image_url = result['secure_url']
        restaurant.save(update_fields=['cover_image_url', 'updated_at'])
        return Response(RestaurantSerializer(restaurant).data)


class RestaurantIikoSettingsView(generics.RetrieveUpdateAPIView):
    """
    GET/PATCH /api/v1/restaurants/<rest_id>/iiko/
    Настройки интеграции iiko Cloud API: вкл/выкл, apiKey, organization/menu id.
    """
    permission_classes = [IsRestaurantAdmin]
    serializer_class = RestaurantIikoSettingsSerializer

    def get_object(self):
        return get_object_or_404(Restaurant, id=self.kwargs['rest_id'])


class RestaurantIikoSyncView(APIView):
    """
    POST /api/v1/restaurants/<rest_id>/iiko/sync/
    Ручной импорт меню из iiko прямо сейчас (кнопка «Синхронизировать»).
    """
    permission_classes = [IsRestaurantAdmin]

    def post(self, request, rest_id):
        restaurant = get_object_or_404(Restaurant, id=rest_id)
        if not restaurant.iiko_enabled or not restaurant.iiko_api_key:
            return Response(
                {'detail': 'Интеграция iiko выключена или не заполнен API-ключ.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            created, updated = sync_restaurant_menu(restaurant)
        except IikoError as exc:
            return Response({'detail': f'Ошибка iiko: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({'created': created, 'updated': updated})


class RestaurantPromoListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PromoSerializer

    def get_queryset(self):
        today = timezone.now().date()
        return Promo.objects.filter(
            restaurant_id=self.kwargs['rest_id'],
            is_active=True,
        ).filter(
            Q(valid_until__isnull=True) | Q(valid_until__gte=today),
        )
