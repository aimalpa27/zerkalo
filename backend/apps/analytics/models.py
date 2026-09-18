import uuid
from django.db import models


class UpsellEvent(models.Model):
    """Privacy-safe funnel event for deterministic upsell rules."""
    EVENT_TYPES = [('impression', 'Impression'), ('add', 'Add'), ('conversion', 'Conversion')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='upsell_events')
    rule = models.ForeignKey('menu.UpsellRule', on_delete=models.CASCADE, related_name='events')
    table = models.ForeignKey('tables.Table', on_delete=models.SET_NULL, null=True, blank=True, related_name='upsell_events')
    session = models.ForeignKey('sessions.TableSession', on_delete=models.SET_NULL, null=True, blank=True, related_name='upsell_events')
    event_type = models.CharField(max_length=16, choices=EVENT_TYPES)
    revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'upsell_events'
        indexes = [
            models.Index(fields=['restaurant', 'created_at']),
            models.Index(fields=['rule', 'event_type', 'created_at']),
        ]
