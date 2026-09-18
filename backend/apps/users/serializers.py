from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.users.models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # FIX: only non-sensitive fields go into the JWT payload.
        # Secrets (e.g. the password hash) are never included.
        token['name'] = user.name
        token['role'] = user.role
        token['restaurant_id'] = str(user.restaurant_id) if user.restaurant_id else None
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': str(self.user.id),
            'email': self.user.email,
            'name': self.user.name,
            'role': self.user.role,
            'restaurant_id': str(self.user.restaurant_id) if self.user.restaurant_id else None,
            'assigned_tables': [str(t.id) for t in self.user.assigned_tables.all()],
            'assigned_zones': [str(z.id) for z in self.user.assigned_zones.all()],
        }
        return data


class RestaurantBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    slug = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    restaurant = RestaurantBriefSerializer(read_only=True)
    assigned_tables = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    assigned_zones = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    effective_table_ids = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'name', 'role',
            'restaurant', 'assigned_tables', 'assigned_zones', 'effective_table_ids',
            'is_active', 'created_at',
        ]
        # SECURITY FIX: this serializer is read-only for `email`/`is_active`/`role`.
        # It used to expose a writable `password` field with a custom `update()`
        # that called `instance.set_password()` directly, which meant
        # `PATCH /api/v1/auth/me/` (MeView, see apps/users/views.py) could change
        # a user's own password WITHOUT verifying the old password — completely
        # bypassing ChangePasswordSerializer's old_password check. It also let a
        # user flip their own `email`/`is_active` via the same endpoint.
        # Password changes must always go through ChangePasswordView
        # (PATCH /api/v1/auth/me/change-password/), which validates old_password.
        # Self profile edits (name only) go through MeUpdateSerializer below.
        read_only_fields = ['id', 'email', 'role', 'is_active', 'created_at']

    def get_effective_table_ids(self, obj):
        return [str(pk) for pk in obj.effective_table_ids]


class MeUpdateSerializer(serializers.ModelSerializer):
    """
    FIX: dedicated serializer for `PATCH /api/v1/auth/me/` (self-service
    profile edits). Only the display name can be changed here — email,
    role, is_active and password are intentionally excluded so this
    endpoint cannot be used to escalate privileges, disable/enable the
    account, change the login email, or bypass old-password verification.
    """

    class Meta:
        model = User
        fields = ['name']


class StaffUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'role', 'is_active', 'created_at']
        read_only_fields = ['id', 'email', 'created_at']

    def validate_role(self, value):
        # Защита от эскалации привилегий — единая политика назначения ролей
        # (та же, что и при создании: см. _validate_assignable_role).
        return _validate_assignable_role(value, self.context.get('request'))


class CreateUserSerializer(serializers.ModelSerializer):
    # FIX: added min_length and password validator pipeline
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'},
    )

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'role', 'password']
        read_only_fields = ['id']

    def validate_role(self, value):
        # Защита от эскалации привилегий — единая политика назначения ролей
        # (defence in depth: view тоже проверяет, но сериализатор может
        # вызываться напрямую из management-команд / тестов).
        return _validate_assignable_role(value, self.context.get('request'))

    def validate_password(self, value):
        _run_password_validators(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'},
    )
    new_password_confirm = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'},
    )

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Старый пароль указан неверно.')
        return value

    def validate_new_password(self, value):
        _run_password_validators(value, user=self.context['request'].user)
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': 'Пароли не совпадают.',
            })
        if attrs['old_password'] == attrs['new_password']:
            raise serializers.ValidationError({
                'new_password': 'Новый пароль не должен совпадать со старым.',
            })
        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


# ── helpers ───────────────────────────────────────────────────────────────────

def _validate_assignable_role(value: str, request) -> str:
    """
    Единая политика назначения ролей для staff-эндпоинтов
    (POST /staff/, PATCH /staff/<id>/). Защита от эскалации привилегий.

    * ``superadmin`` (тех-поддержка Plait) — платформенная роль с доступом ко
      ВСЕМ ресторанам (см. apps.users.permissions.IsRestaurantAdmin /
      IsRestaurantStaff). Её нельзя назначить через API вообще: супер-админ
      создаётся только командой ``manage.py create_superadmin``. Иначе
      admin/manager одного ресторана мог бы выписать себе (или сотруднику)
      аккаунт с полным кросс-ресторанным доступом.
    * ``admin`` — администратора ресторана может создать/назначить только
      супер-админ (тех-команда Plait).

    Остальные роли (manager/waiter/cashier/kitchen) назначаются штатно.
    """
    if value == 'superadmin':
        raise serializers.ValidationError(
            'Роль superadmin нельзя назначить через API — '
            'супер-админ создаётся командой manage.py create_superadmin.'
        )
    if value == 'admin':
        if request is None or not getattr(request.user, 'is_superadmin', False):
            raise serializers.ValidationError(
                'Создать администратора может только тех-команда Plait.'
            )
    return value


def _run_password_validators(password: str, user=None) -> None:
    """Run Django's AUTH_PASSWORD_VALIDATORS and re-raise as DRF ValidationError."""
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages))
