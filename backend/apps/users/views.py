import logging

from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.exceptions import ValidationError

from apps.restaurants.models import Restaurant
from apps.tables.models import Table
from apps.users.models import User
from apps.users.permissions import IsRestaurantAdmin
from apps.users.serializers import (
    ChangePasswordSerializer,
    CreateUserSerializer,
    CustomTokenObtainPairSerializer,
    MeUpdateSerializer,
    StaffUpdateSerializer,
    UserSerializer,
)
from apps.users.throttles import LoginRateThrottle
from apps.zones.models import Zone

logger = logging.getLogger('apps.users')


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        # FIX: log successful and failed login attempts for audit trail
        email = request.data.get('email', '—')
        if response.status_code == 200:
            logger.info('LOGIN_SUCCESS email=%s ip=%s', email, _get_ip(request))
        return response

    def handle_exception(self, exc):
        email = self.request.data.get('email', '—')
        logger.warning('LOGIN_FAILED email=%s ip=%s', email, _get_ip(self.request))
        return super().handle_exception(exc)


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class LogoutView(APIView):
    """
    FIX: Logout endpoint was missing entirely.
    The simplejwt blacklist app is installed but was never called on logout,
    so stolen refresh tokens remained valid for their full 7-day lifetime.

    POST /api/v1/auth/logout/  { "refresh": "<token>" }
    Blacklists the provided refresh token immediately.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Поле "refresh" обязательно.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            logger.info('LOGOUT user=%s ip=%s', request.user.email, _get_ip(request))
        except (TokenError, InvalidToken):
            # Token already expired or invalid — treat as logged out
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        # FIX: use a dedicated serializer that only allows changing `name`.
        # Previously this used UserSerializer, which had a writable `password`
        # field and a custom update() that called set_password() directly —
        # allowing any authenticated user to change their own password via
        # PATCH /api/v1/auth/me/ without supplying their old password, and to
        # rewrite their own `email`/`is_active`. Password changes must go
        # through ChangePasswordView (which verifies old_password).
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'detail': 'Пароль успешно изменён.'},
            status=status.HTTP_200_OK,
        )


# D7 — Staff Management
class StaffListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsRestaurantAdmin]

    def get_serializer_class(self):
        return CreateUserSerializer if self.request.method == 'POST' else UserSerializer

    def get_queryset(self):
        return User.objects.filter(restaurant_id=self.kwargs['rest_id']).order_by('name')

    def create(self, request, *args, **kwargs):
        # Защита от эскалации привилегий (дублирует CreateUserSerializer.validate_role
        # — defence in depth). Роль superadmin (тех-поддержка Plait) даёт доступ ко
        # ВСЕМ ресторанам, поэтому её нельзя создать через API вообще — только через
        # `manage.py create_superadmin`. Аккаунт admin ресторана может создать только
        # superadmin — иначе admin/manager мог бы плодить привилегированные аккаунты.
        requested_role = request.data.get('role')
        if requested_role == 'superadmin':
            return Response(
                {'role': 'Роль superadmin нельзя назначить через API.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if requested_role == 'admin' and not request.user.is_superadmin:
            return Response(
                {'role': 'Создать администратора может только тех-команда Plait.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        rest_id = self.kwargs['rest_id']
        restaurant = get_object_or_404(Restaurant, id=rest_id)
        plan = restaurant.subscription_plan
        if plan and plan.max_staff is not None:
            current = User.objects.filter(restaurant_id=rest_id).count()
            if current >= plan.max_staff:
                raise ValidationError(
                    {'detail': f'Лимит сотрудников ({plan.max_staff}) для тарифа "{plan.name}" исчерпан.'}
                )
        serializer.save(restaurant_id=rest_id)

class StaffDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsRestaurantAdmin]
    http_method_names = ['get', 'patch', 'delete']
    lookup_url_kwarg = 'user_id'

    def get_serializer_class(self):
        return StaffUpdateSerializer if self.request.method == 'PATCH' else UserSerializer

    def get_queryset(self):
        qs = User.objects.filter(restaurant_id=self.kwargs['rest_id'])
        if self.request.user.role == 'manager':
            qs = qs.exclude(role='admin')
        return qs


class AssignTablesView(APIView):
    """Legacy — назначение только отдельных столов. Оставлено для обратной совместимости,
    новые интеграции должны использовать StaffAssignmentView (гибрид зоны + столы)."""
    permission_classes = [IsRestaurantAdmin]

    def post(self, request, rest_id, user_id):
        user = get_object_or_404(User, id=user_id, restaurant_id=rest_id)
        table_ids = request.data.get('table_ids', [])
        # FIX: always filter by restaurant_id so a manager of restaurant A
        # cannot assign tables from restaurant B to their staff
        tables = Table.objects.filter(id__in=table_ids, restaurant_id=rest_id)
        user.assigned_tables.set(tables)
        return Response(UserSerializer(user).data)


def _get_ip(request) -> str:
    """Extract real client IP, respecting X-Forwarded-For behind a proxy."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '?')


class StaffAssignmentView(APIView):
    """Гибридное назначение: зоны целиком + отдельные столы (эффективные столы —
    их объединение, см. User.effective_table_ids). Сеттит оба поля разом."""
    permission_classes = [IsRestaurantAdmin]

    def post(self, request, rest_id, user_id):
        user = get_object_or_404(User, id=user_id, restaurant_id=rest_id)
        zone_ids = request.data.get('zone_ids', [])
        table_ids = request.data.get('table_ids', [])
        zones = Zone.objects.filter(id__in=zone_ids, restaurant_id=rest_id)
        tables = Table.objects.filter(id__in=table_ids, restaurant_id=rest_id)
        user.assigned_zones.set(zones)
        user.assigned_tables.set(tables)
        return Response(UserSerializer(user).data)
