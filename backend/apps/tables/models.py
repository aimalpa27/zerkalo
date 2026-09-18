import secrets
import uuid

from django.conf import settings
from django.db import models


class Table(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='tables',
    )
    number = models.PositiveIntegerField()
    token = models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)
    is_active = models.BooleanField(default=True)
    zone = models.ForeignKey(
        'zones.Zone',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tables',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tables'
        unique_together = [('restaurant', 'number')]
        indexes = [
            models.Index(fields=['token']),
        ]

    def __str__(self):
        return f'{self.restaurant.name} — стол {self.number}'

    @property
    def qr_url(self):
        base = settings.FRONTEND_BASE_URL.rstrip('/')
        return f'{base}/?slug={self.restaurant.slug}&token={self.token}'
