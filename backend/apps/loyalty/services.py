from decimal import Decimal
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import LoyaltyMember, LoyaltyProgram, LoyaltyRedemption, LoyaltyVisit

def get_program(restaurant):
    program, _ = LoyaltyProgram.objects.get_or_create(restaurant=restaurant)
    return program

def attach_member(session, token):
    if not token:
        return None
    member, _ = LoyaltyMember.objects.get_or_create(restaurant=session.restaurant, token=token)
    if session.loyalty_member_id != member.id:
        session.loyalty_member = member
        session.save(update_fields=['loyalty_member', 'updated_at'])
    return member

@transaction.atomic
def redeem_reward(session):
    if not session.loyalty_member_id:
        raise ValidationError({'loyalty': 'Профиль лояльности не найден.'})
    existing = LoyaltyRedemption.objects.filter(session=session).first()
    if existing:
        return existing
    program = get_program(session.restaurant)
    if not program.is_enabled or program.reward_points <= 0 or program.reward_discount_amount <= 0:
        raise ValidationError({'loyalty': 'Программа лояльности сейчас недоступна.'})
    member = LoyaltyMember.objects.select_for_update().get(id=session.loyalty_member_id)
    if member.points < program.reward_points:
        raise ValidationError({'loyalty': f'Недостаточно баллов: нужно {program.reward_points}.'})
    member.points = F('points') - program.reward_points
    member.save(update_fields=['points'])
    redemption = LoyaltyRedemption.objects.create(
        member_id=session.loyalty_member_id, session=session,
        points_spent=program.reward_points, discount_amount=program.reward_discount_amount,
    )
    session.loyalty_discount_amount = program.reward_discount_amount
    session.save(update_fields=['loyalty_discount_amount', 'updated_at'])
    return redemption

@transaction.atomic
def reward_closed_session(session):
    if not session.loyalty_member_id or session.status != 'closed':
        return None
    program = get_program(session.restaurant)
    if not program.is_enabled:
        return None
    member = LoyaltyMember.objects.select_for_update().get(id=session.loyalty_member_id)
    points = max(0, int(session.total_amount // Decimal('1000')) * program.points_per_1000)
    visit, created = LoyaltyVisit.objects.get_or_create(
        session=session, defaults={'member': member, 'spend': session.total_amount, 'points_earned': points}
    )
    if created:
        LoyaltyMember.objects.filter(id=member.id).update(
            visits_count=F('visits_count') + 1,
            lifetime_spend=F('lifetime_spend') + session.total_amount,
            points=F('points') + points,
            last_visit_at=timezone.now(),
        )
        member.refresh_from_db()
    return visit
