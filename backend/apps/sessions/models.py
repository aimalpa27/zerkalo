import uuid
from decimal import Decimal

from django.db import models


class TableSession(models.Model):
    STATUSES = [
        ('open', 'Открыт'),
        ('awaiting_payment', 'Ожидает оплату'),
        ('payment_requested', 'Запрошена оплата'),
        ('closed', 'Закрыт'),
    ]

    PAYMENT_METHODS = [
        ('cash', 'Наличные'),
        ('card', 'Карта'),
    ]

    ORDER_TYPES = [
        ('dine_in', 'В заведении'),
        ('delivery', 'Доставка'),
        ('pickup', 'Самовывоз'),
    ]

    DELIVERY_STATUSES = [
        ('new', 'Новый'),
        ('confirmed', 'Подтверждён'),
        ('preparing', 'Готовится'),
        ('on_the_way', 'Курьер в пути'),
        ('ready_for_pickup', 'Готов к выдаче'),
        ('completed', 'Завершён'),
        ('cancelled', 'Отменён'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='sessions',
    )
    table = models.ForeignKey(
        'tables.Table',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sessions',
    )
    table_number = models.PositiveIntegerField(null=True, blank=True)
    table_token = models.CharField(max_length=64, blank=True)
    order_type = models.CharField(max_length=10, choices=ORDER_TYPES, default='dine_in')
    status = models.CharField(max_length=20, choices=STATUSES, default='open')
    subtotal_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    service_charge_percent = models.PositiveIntegerField(default=10)
    service_charge_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHODS, blank=True)
    loyalty_member = models.ForeignKey('loyalty.LoyaltyMember', on_delete=models.SET_NULL, null=True, blank=True, related_name='sessions')
    loyalty_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Доставка / самовывоз
    customer_name = models.CharField(max_length=255, blank=True)
    customer_phone = models.CharField(max_length=32, blank=True)
    delivery_address = models.TextField(blank=True)
    delivery_comment = models.TextField(blank=True)
    delivery_status = models.CharField(max_length=20, choices=DELIVERY_STATUSES, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'table_sessions'
        indexes = [
            models.Index(fields=['restaurant', 'status']),
            models.Index(fields=['table_token', 'status']),
            models.Index(fields=['restaurant', 'closed_at']),
            models.Index(fields=['restaurant', 'order_type', 'delivery_status']),
        ]

    def __str__(self):
        if self.order_type == 'dine_in':
            return f'Стол {self.table_number} — {self.status}'
        return f'{self.get_order_type_display()} — {self.delivery_status or self.status}'

    def recalculate_totals(self):
        # Неподтверждённые позиции не входят в счёт до подтверждения официантом
        # (паритет с frontend/src/lib/itemStatus.ts isBillable)
        items = self.items.exclude(status__in=['cancelled', 'rejected', 'awaiting_confirmation'])
        # Decimal-seed: при пустом наборе sum() иначе вернёт int 0, и total_amount
        # (0 + float service_charge + Decimal delivery_fee) упадёт на float+Decimal.
        subtotal = sum((item.price * item.quantity for item in items), Decimal('0'))
        service_charge = (subtotal * self.service_charge_percent) / 100

        self.subtotal_amount = subtotal
        self.service_charge_amount = service_charge
        gross_total = subtotal + service_charge + self.delivery_fee
        self.total_amount = max(Decimal('0'), gross_total - self.loyalty_discount_amount)
        self.save(
            update_fields=[
                'subtotal_amount',
                'service_charge_amount',
                'total_amount',
                'updated_at',
            ],
        )


class SessionItem(models.Model):
    STATUSES = [
        ('awaiting_confirmation', 'Ожидает подтверждения'),
        ('confirmed', 'Принят'),
        ('ready', 'Готово'),
        ('served', 'Подано'),
        ('rejected', 'Отклонён'),
        ('cancelled', 'Отменён'),
    ]

    ADDED_BY = [
        ('guest', 'Гость'),
        ('waiter', 'Официант'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        TableSession,
        on_delete=models.CASCADE,
        related_name='items',
    )
    menu_item = models.ForeignKey(
        'menu.MenuItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    item_name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    status = models.CharField(max_length=25, choices=STATUSES, default='confirmed')
    preparation_station = models.CharField(max_length=10, default='kitchen')
    note = models.TextField(blank=True)
    added_by = models.CharField(max_length=10, choices=ADDED_BY, default='guest')
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='confirmed_session_items')
    rejected_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    served_at = models.DateTimeField(null=True, blank=True)
    served_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='served_session_items')

    class Meta:
        db_table = 'session_items'
        indexes = [
            models.Index(fields=['session', 'status']),
            models.Index(fields=['session', 'preparation_station']),
        ]

    def __str__(self):
        return f'{self.item_name} x{self.quantity}'

class SLAIncident(models.Model):
    """Durable, tenant-scoped record of an operational SLA breach.

    Incidents are materialized by the lightweight SLA endpoint that operational
    screens already poll. No background worker or external AI/service is needed.
    """
    KINDS = [('preparation', 'Preparation'), ('handoff', 'Ready to served')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='sla_incidents')
    item = models.ForeignKey(SessionItem, on_delete=models.CASCADE, related_name='sla_incidents')
    kind = models.CharField(max_length=20, choices=KINDS)
    station = models.CharField(max_length=10, blank=True, default='')
    target_minutes = models.PositiveSmallIntegerField()
    breached_at = models.DateTimeField()
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sla_incidents'
        constraints = [models.UniqueConstraint(fields=['item', 'kind'], name='unique_sla_incident_item_kind')]
        indexes = [models.Index(fields=['restaurant', 'resolved_at', 'breached_at'])]

class OperationalExceptionState(models.Model):
    """Durable ownership/timing metadata for deterministic operational exceptions."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='operational_exception_states')
    exception_key = models.CharField(max_length=100)
    kind = models.CharField(max_length=20)
    first_seen_at = models.DateTimeField()
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_operational_exceptions')
    resolved_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'operational_exception_states'
        constraints = [models.UniqueConstraint(fields=['restaurant', 'exception_key'], name='uniq_restaurant_exception_key')]
        indexes = [models.Index(fields=['restaurant', 'resolved_at']), models.Index(fields=['restaurant', 'kind'])]

class ServiceRecoveryNote(models.Model):
    """Manager-authored, tenant-scoped record of a real guest service recovery."""
    REASONS = [('delay','Delay'),('quality','Quality'),('wrong_order','Wrong order'),('service','Service'),('payment','Payment'),('other','Other')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='service_recoveries')
    session = models.ForeignKey(TableSession, on_delete=models.CASCADE, related_name='service_recoveries')
    reason = models.CharField(max_length=20, choices=REASONS)
    note = models.TextField(max_length=1000)
    compensation_type = models.CharField(max_length=50, blank=True, default='')
    compensation_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='service_recoveries_created')
    source_exception = models.ForeignKey(OperationalExceptionState, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_recoveries')
    source_sla_incident = models.ForeignKey(SLAIncident, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_recoveries')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'service_recovery_notes'
        indexes = [models.Index(fields=['restaurant','created_at']), models.Index(fields=['restaurant','reason'])]
