import uuid

from django.utils.text import slugify
from rest_framework import serializers

from apps.restaurants.models import Restaurant
from .models import SubscriptionPlan


def _generate_unique_slug(name: str) -> str:
    base = slugify(name)
    if not base:
        # slugify() выбрасывает кириллицу целиком — для «Кафе Астана» без
        # латинского slug генерируем короткий технический
        base = f'r-{uuid.uuid4().hex[:8]}'
    slug = base
    n = 2
    while Restaurant.objects.filter(slug=slug).exists():
        slug = f'{base}-{n}'
        n += 1
    return slug


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'code', 'name', 'description', 'price', 'billing_period_days',
            'max_tables', 'max_staff',
            'delivery_enabled', 'online_orders_enabled', 'waiter_calls_enabled',
            'analytics_enabled', 'kaspi_pay_enabled',
            'priority_support', 'schedule_enabled', 'chat_enabled', 'is_active', 'sort_order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SubscriptionPlanBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = ['id', 'code', 'name', 'price']


class SuperAdminRestaurantSerializer(serializers.ModelSerializer):
    """
    Полный вид ресторана для тех-команды: бренд + подписка + счётчики.
    `subscription_plan` принимает UUID плана при PATCH, `subscription_plan_detail`
    возвращает развёрнутую информацию для отображения.
    """
    subscription_plan_detail = SubscriptionPlanBriefSerializer(source='subscription_plan', read_only=True)
    tables_count = serializers.IntegerField(source='tables.count', read_only=True)
    staff_count = serializers.IntegerField(source='staff.count', read_only=True)

    class Meta:
        model = Restaurant
        fields = [
            'id', 'name', 'slug', 'address', 'working_hours',
            'cover_image_url', 'logo_url', 'theme', 'accent_color',
            'is_public',
            'subscription_plan', 'subscription_plan_detail',
            'subscription_status', 'subscription_expires_at',
            'tables_count', 'staff_count',
            'kaspi_pay_url',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'tables_count', 'staff_count', 'created_at', 'updated_at']
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        if not validated_data.get('slug'):
            validated_data['slug'] = _generate_unique_slug(validated_data.get('name', ''))
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # slug фиксирован после создания — на него завязаны напечатанные QR-коды столов
        validated_data.pop('slug', None)
        return super().update(instance, validated_data)