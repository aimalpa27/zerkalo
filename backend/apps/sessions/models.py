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
        self.total_amount = subtotal + service_charge + self.delivery_fee
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
    rejected_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    served_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'session_items'
        indexes = [
            models.Index(fields=['session', 'status']),
            models.Index(fields=['session', 'preparation_station']),
        ]

    def __str__(self):
        return f'{self.item_name} x{self.quantity}'
