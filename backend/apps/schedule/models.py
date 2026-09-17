import uuid

from django.db import models


class Shift(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='shifts',
    )
    staff = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='shifts',
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shifts'
        ordering = ['date', 'start_time']
        indexes = [
            models.Index(fields=['restaurant', 'date']),
            models.Index(fields=['staff', 'date']),
        ]

    def __str__(self):
        return f'{self.staff.name} — {self.date} {self.start_time}-{self.end_time}'
