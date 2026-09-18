import uuid

from django.db import models


class WaiterCall(models.Model):
    STATUSES = [
        ('new', 'Новый'),
        ('accepted', 'Принят'),
        ('closed', 'Закрыт'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='waiter_calls',
    )
    table = models.ForeignKey(
        'tables.Table',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    table_number = models.PositiveIntegerField()
    table_token = models.CharField(max_length=64)
    status = models.CharField(max_length=10, choices=STATUSES, default='new')
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'waiter_calls'
        indexes = [
            models.Index(fields=['restaurant', 'status']),
        ]

    def __str__(self):
        return f'Вызов официанта — стол {self.table_number}'
