import uuid
from django.db import models

class LoyaltyProgram(models.Model):
    """Restaurant-controlled deterministic loyalty configuration. No external AI/services."""
    restaurant = models.OneToOneField('restaurants.Restaurant', on_delete=models.CASCADE, related_name='loyalty_program')
    is_enabled = models.BooleanField(default=True)
    points_per_1000 = models.PositiveIntegerField(default=1)
    reward_points = models.PositiveIntegerField(default=10)
    reward_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=1000)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'loyalty_programs'

class LoyaltyMember(models.Model):
    """Anonymous restaurant-scoped guest identity. No phone/email is required or stored."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='loyalty_members')
    token = models.UUIDField(default=uuid.uuid4, editable=False)
    visits_count = models.PositiveIntegerField(default=0)
    lifetime_spend = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    points = models.PositiveIntegerField(default=0)
    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_visit_at = models.DateTimeField(null=True, blank=True)
    class Meta:
        db_table = 'loyalty_members'
        constraints = [models.UniqueConstraint(fields=['restaurant', 'token'], name='uniq_loyalty_restaurant_token')]
        indexes = [models.Index(fields=['restaurant', 'last_visit_at'])]

class LoyaltyVisit(models.Model):
    """Idempotent earn ledger: one closed bill can reward a member once."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(LoyaltyMember, on_delete=models.CASCADE, related_name='visits')
    session = models.OneToOneField('order_sessions.TableSession', on_delete=models.CASCADE, related_name='loyalty_visit')
    spend = models.DecimalField(max_digits=12, decimal_places=2)
    points_earned = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'loyalty_visits'
        indexes = [models.Index(fields=['member', 'created_at'])]

class LoyaltyRedemption(models.Model):
    """Idempotent spend ledger: a session can consume a reward at most once."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    member = models.ForeignKey(LoyaltyMember, on_delete=models.PROTECT, related_name='redemptions')
    session = models.OneToOneField('order_sessions.TableSession', on_delete=models.PROTECT, related_name='loyalty_redemption')
    points_spent = models.PositiveIntegerField()
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'loyalty_redemptions'
        indexes = [models.Index(fields=['member', 'created_at'])]
