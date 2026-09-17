import re

from rest_framework import serializers

from apps.restaurants.models import Promo, Restaurant


class RestaurantSerializer(serializers.ModelSerializer):
    """Публичный вид ресторана (гость, listing, by-slug)."""
    features = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'slug', 'address', 'working_hours',
            'rating', 'tags', 'cover_image_url', 'logo_url', 'theme', 'accent_color',
            'latitude', 'longitude',
            'service_charge_percent', 'allow_waiter_close',
            'kaspi_pay_url', 'panorama_url', 'is_public',
            'delivery_fee', 'delivery_min_order',
            'schedule_visibility',
            'order_confirmation_enabled', 'order_reminder_after_sec',
            'order_escalate_after_sec', 'order_auto_action',
            'features',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'features']

    def get_features(self, obj):
        return {
            'delivery': obj.has_feature('delivery'),
            'online_orders': obj.has_feature('online_orders'),
            'waiter_calls': obj.has_feature('waiter_calls'),
            'analytics': obj.has_feature('analytics'),
            'kaspi_pay': obj.has_feature('kaspi_pay'),
            'schedule': obj.has_feature('schedule'),
            'chat': obj.has_feature('chat'),
        }


class RestaurantSettingsSerializer(serializers.ModelSerializer):
    """
    Самостоятельная настройка ресторана: бренд, оформление, контакты.
    Доступна владельцу/менеджеру ресторана и superadmin (тех-поддержке) —
    см. IsRestaurantAdmin.
    """

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'address', 'working_hours', 'tags',
            'cover_image_url', 'logo_url', 'theme', 'accent_color',
            'latitude', 'longitude', 'service_charge_percent',
            'allow_waiter_close', 'kaspi_pay_url', 'panorama_url', 'is_public',
            'delivery_fee', 'delivery_min_order', 'schedule_visibility',
            'order_confirmation_enabled', 'order_reminder_after_sec',
            'order_escalate_after_sec', 'order_auto_action',
        ]
        read_only_fields = ['id']

    def validate_schedule_visibility(self, value):
        if not self.instance.has_feature('schedule'):
            raise serializers.ValidationError('График смен недоступен на текущем тарифе.')
        return value

    def validate_kaspi_pay_url(self, value):
        if value and not self.instance.has_feature('kaspi_pay'):
            raise serializers.ValidationError('Kaspi Pay недоступен на текущем тарифе.')
        return value

    def validate_delivery_fee(self, value):
        if value and value > 0 and not self.instance.has_feature('delivery'):
            raise serializers.ValidationError('Доставка недоступна на текущем тарифе.')
        return value

    def validate_delivery_min_order(self, value):
        if value and value > 0 and not self.instance.has_feature('delivery'):
            raise serializers.ValidationError('Доставка недоступна на текущем тарифе.')
        return value

    def validate_accent_color(self, value):
        if value and not re.match(r'^#[0-9A-Fa-f]{6}$', value):
            raise serializers.ValidationError('Цвет должен быть в формате HEX, например #FF6B1A.')
        return value

    def validate_tags(self, value):
        # FIX: `tags` is a JSONField with no schema validation — a malicious
        # or buggy admin client could submit an arbitrarily large/nested
        # JSON blob (stored as-is in Postgres jsonb and re-served on every
        # public restaurant page), causing storage bloat and degraded
        # responses for guests. Restrict to a small flat list of short
        # strings.
        if not isinstance(value, list):
            raise serializers.ValidationError('tags должен быть списком строк.')
        if len(value) > 20:
            raise serializers.ValidationError('Не более 20 тегов.')
        for tag in value:
            if not isinstance(tag, str):
                raise serializers.ValidationError('Каждый тег должен быть строкой.')
            if len(tag) > 30:
                raise serializers.ValidationError('Длина тега не должна превышать 30 символов.')
        return value


class RestaurantIikoSettingsSerializer(serializers.ModelSerializer):
    """
    Настройки интеграции iiko Cloud API (admin/manager ресторана + superadmin).
    apiKey — секрет: наружу отдаём маской, принимаем на запись.
    """
    iiko_api_key = serializers.CharField(
        max_length=255, required=False, allow_blank=True, write_only=True,
    )
    iiko_api_key_set = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            'id', 'iiko_enabled', 'iiko_api_key', 'iiko_api_key_set',
            'iiko_organization_id', 'iiko_external_menu_id',
        ]
        read_only_fields = ['id']

    def get_iiko_api_key_set(self, obj) -> bool:
        return bool(obj.iiko_api_key)


class PromoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promo
        fields = ['id', 'title', 'description', 'valid_until', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']