import uuid

from django.db import models


THEME_CHOICES = [
    ('dark', 'Тёмная'),
    ('light', 'Светлая'),
]

SUBSCRIPTION_STATUS_CHOICES = [
    ('trial', 'Триал'),
    ('active', 'Активна'),
    ('past_due', 'Просрочена'),
    ('suspended', 'Приостановлена'),
]

SCHEDULE_VISIBILITY_CHOICES = [
    ('own', 'Только свои смены'),
    ('all', 'Смены всех сотрудников'),
]

# Соответствие "человеческого" названия фичи и поля `<feature>_enabled` на SubscriptionPlan
FEATURE_FIELDS = (
    'delivery',
    'online_orders',
    'waiter_calls',
    'analytics',
    'kaspi_pay',
    'schedule',
    'chat',
)


class Restaurant(models.Model):
    ORDER_AUTO_ACTIONS = [
        ('none', 'Ничего'),
        ('auto_confirm', 'Автоматически принимать'),
        ('auto_reject', 'Автоматически отклонять'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    address = models.TextField(blank=True)
    working_hours = models.CharField(max_length=255, blank=True)
    rating = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    tags = models.JSONField(default=list, blank=True)
    cover_image_url = models.URLField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    service_charge_percent = models.PositiveIntegerField(default=10)
    allow_waiter_close = models.BooleanField(default=False)
    order_confirmation_enabled = models.BooleanField(default=False)
    order_reminder_after_sec = models.PositiveIntegerField(default=60)
    order_escalate_after_sec = models.PositiveIntegerField(default=180)
    order_auto_action = models.CharField(max_length=20, choices=ORDER_AUTO_ACTIONS, default='none')
    # Operational SLA targets (minutes), configurable per tenant.
    kitchen_sla_minutes = models.PositiveSmallIntegerField(default=20)
    bar_sla_minutes = models.PositiveSmallIntegerField(default=10)
    ready_to_served_sla_minutes = models.PositiveSmallIntegerField(default=5)
    kaspi_pay_url = models.URLField(blank=True)
    panorama_url = models.URLField(blank=True)
    is_public = models.BooleanField(default=True)

    # Доставка / самовывоз
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_min_order = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Брендинг / оформление
    logo_url = models.URLField(blank=True)
    theme = models.CharField(max_length=20, choices=THEME_CHOICES, default='dark')
    accent_color = models.CharField(max_length=7, default='#FF6B1A')

    # Подписка
    subscription_plan = models.ForeignKey(
        'billing.SubscriptionPlan',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='restaurants',
    )
    subscription_status = models.CharField(
        max_length=20, choices=SUBSCRIPTION_STATUS_CHOICES, default='trial',
    )
    subscription_expires_at = models.DateTimeField(null=True, blank=True)

    # График смен (Pro): кому видны смены коллег в панели официанта
    schedule_visibility = models.CharField(
        max_length=10, choices=SCHEDULE_VISIBILITY_CHOICES, default='own',
    )

    # Интеграция с iiko (Cloud API, api-ru.iiko.services). app_id/client_secret —
    # общие, в settings. Здесь — apiKey ресторана из iikoWeb → «Настройки Cloud API».
    # organization_id / external_menu_id опциональны: если пусты, берётся первая
    # организация / первое внешнее меню аккаунта.
    iiko_enabled = models.BooleanField(default=False)
    iiko_api_key = models.CharField(max_length=255, blank=True)
    iiko_organization_id = models.CharField(max_length=64, blank=True)
    iiko_external_menu_id = models.CharField(max_length=64, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurants'
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['is_public']),
            models.Index(fields=['subscription_status']),
        ]

    def __str__(self):
        return self.name

    def has_feature(self, feature: str) -> bool:
        """
        Проверяет доступность функции (см. FEATURE_FIELDS) с учётом тарифа.
        - `suspended` подписка — доступ ко всем платным фичам закрыт.
        - Если план не назначен (legacy/новый ресторан до настройки) — ограничений нет.
        """
        if self.subscription_status == 'suspended':
            return False
        if self.subscription_plan_id is None:
            return True
        return getattr(self.subscription_plan, f'{feature}_enabled', False)


class Promo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name='promos',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    valid_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'promos'
        indexes = [
            models.Index(fields=['restaurant', 'is_active']),
        ]

    def __str__(self):
        return self.title
class RestaurantNetwork(models.Model):
    """A tenant-safe group of branches. Membership changes are support-controlled."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    owner_restaurant = models.OneToOneField(
        Restaurant, on_delete=models.CASCADE, related_name='owned_network'
    )
    restaurants = models.ManyToManyField(Restaurant, related_name='networks', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurant_networks'

    def __str__(self):
        return self.name
