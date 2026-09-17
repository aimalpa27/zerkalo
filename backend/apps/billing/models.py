import uuid

from django.db import models


class SubscriptionPlan(models.Model):
    """
    Тарифный план Plait (Тест / Старт / Pro и т.д.).
    Поля `*_enabled` определяют, какие функции доступны ресторану на этом
    тарифе. `max_tables` / `max_staff` = None означает «без ограничений».
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    billing_period_days = models.PositiveIntegerField(default=30)

    # Лимиты
    max_tables = models.PositiveIntegerField(null=True, blank=True)
    max_staff = models.PositiveIntegerField(null=True, blank=True)

    # Фичи
    delivery_enabled = models.BooleanField(default=False)
    online_orders_enabled = models.BooleanField(default=True)
    waiter_calls_enabled = models.BooleanField(default=True)
    analytics_enabled = models.BooleanField(default=False)
    kaspi_pay_enabled = models.BooleanField(default=False)
    priority_support = models.BooleanField(default=False)
    schedule_enabled = models.BooleanField(default=False)
    chat_enabled = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscription_plans'
        ordering = ['sort_order', 'price']

    def __str__(self):
        return f'{self.name} ({self.price}₸)'