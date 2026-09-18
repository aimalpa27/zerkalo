import uuid

from django.db import models


class Zone(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='zones',
    )
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=9, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'zones'
        ordering = ['sort_order']
        unique_together = [('restaurant', 'name')]
        indexes = [
            models.Index(fields=['restaurant', 'sort_order']),
        ]

    def __str__(self):
        return f'{self.restaurant.name} → {self.name}'
