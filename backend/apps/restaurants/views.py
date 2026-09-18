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


class RestaurantDiagnosticsView(APIView):
    """
    GET /api/v1/restaurants/<rest_id>/diagnostics/

    Tenant-safe support snapshot for Admin/Manager and Plait superadmin.
    Deliberately excludes secrets, customer PII, raw logs and infrastructure URLs.
    """
    permission_classes = [IsRestaurantAdmin]

    def get(self, request, rest_id):
        from django.db import connections
        from django.core.cache import cache
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from apps.sessions.models import TableSession

        restaurant = get_object_or_404(
            Restaurant.objects.select_related('subscription_plan'), id=rest_id,
        )

        # Dependency checks are intentionally reduced to booleans. Never return
        # exception strings, connection names/URLs, Redis hosts or credentials.
        def safe_check(fn):
            try:
                fn()
                return True
            except Exception:
                return False

        def db_check():
            with connections['default'].cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()

        def cache_check():
            key = f'plait:diag:{restaurant.id}:{timezone.now().timestamp()}'
            cache.set(key, '1', timeout=5)
            if cache.get(key) != '1':
                raise RuntimeError('cache failed')
            cache.delete(key)

        def realtime_check():
            layer = get_channel_layer()
            if layer is None:
                raise RuntimeError('channel layer unavailable')
            channel = async_to_sync(layer.new_channel)('plait.diag.')
            group = 'plait.diagnostics'
            async_to_sync(layer.group_add)(group, channel)
            async_to_sync(layer.group_discard)(group, channel)

        tables = restaurant.tables.all()
        menu_items = restaurant.menu_items.all()
        staff = restaurant.staff.all()
        sessions = TableSession.objects.filter(restaurant=restaurant)

        checks = {
            'database': safe_check(db_check),
            'cache': safe_check(cache_check),
            'realtime': safe_check(realtime_check),
        }
        counts = {
            'tables': tables.count(),
            'active_tables': tables.filter(is_active=True).count(),
            'menu_items': menu_items.count(),
            'available_menu_items': menu_items.filter(is_available=True, is_visible=True).count(),
            'active_staff': staff.filter(is_active=True).count(),
            'open_sessions': sessions.exclude(status='closed').count(),
        }
        warnings = []
        if not restaurant.is_public:
            warnings.append({'code': 'restaurant_not_public', 'message': 'Ресторан не опубликован для гостей.'})
        if counts['active_tables'] == 0:
            warnings.append({'code': 'no_active_tables', 'message': 'Нет активных столов для QR-заказов.'})
        if counts['available_menu_items'] == 0:
            warnings.append({'code': 'no_available_menu', 'message': 'Нет доступных и видимых блюд.'})
        if counts['active_staff'] == 0:
            warnings.append({'code': 'no_active_staff', 'message': 'Нет активных сотрудников.'})
        if not all(checks.values()):
            warnings.append({'code': 'dependency_degraded', 'message': 'Один из системных компонентов временно недоступен.'})

        integration = {
            'iiko_enabled': restaurant.iiko_enabled,
            'iiko_configured': bool(restaurant.iiko_api_key),
        }
        subscription = {
            'status': restaurant.subscription_status,
            'expires_at': restaurant.subscription_expires_at.isoformat() if restaurant.subscription_expires_at else None,
        }
        return Response({
            'status': 'ok' if all(checks.values()) and not warnings else 'attention',
            'generated_at': timezone.now().isoformat(),
            'restaurant': {'id': str(restaurant.id), 'name': restaurant.name, 'slug': restaurant.slug, 'is_public': restaurant.is_public},
            'dependencies': checks,
            'counts': counts,
            'integration': integration,
            'subscription': subscription,
            'warnings': warnings,
        })


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
