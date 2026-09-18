import uuid
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from apps.loyalty.models import LoyaltyMember, LoyaltyVisit
from apps.loyalty.services import attach_member, reward_closed_session
from apps.restaurants.models import Restaurant
from apps.sessions.models import TableSession
from apps.tables.models import Table
from apps.users.models import User

class LoyaltyRegressionTests(TestCase):
    def setUp(self):
        self.rest = Restaurant.objects.create(name='Loyalty Test', slug='loyalty-test')
        self.other = Restaurant.objects.create(name='Other', slug='other-loyalty')
        self.table = Table.objects.create(restaurant=self.rest, number=1)
        self.admin = User.objects.create_user(email='loyalty-admin@test.local', password='StrongPass123!', role='admin', restaurant=self.rest)
        self.waiter = User.objects.create_user(email='loyalty-waiter@test.local', password='StrongPass123!', role='waiter', restaurant=self.rest)
        self.client = APIClient()

    def test_anonymous_member_reward_is_idempotent(self):
        session = TableSession.objects.create(restaurant=self.rest, table=self.table, table_number=1, table_token=self.table.token,
            status='closed', total_amount=Decimal('3500'), closed_at='2026-09-18T00:00:00Z')
        token = uuid.uuid4(); member = attach_member(session, token)
        reward_closed_session(session); reward_closed_session(session)
        member.refresh_from_db()
        self.assertEqual(member.visits_count, 1); self.assertEqual(member.points, 3); self.assertEqual(member.lifetime_spend, Decimal('3500'))
        self.assertEqual(LoyaltyVisit.objects.filter(session=session).count(), 1)

    def test_guest_status_is_restaurant_scoped(self):
        member = LoyaltyMember.objects.create(restaurant=self.rest)
        ok = self.client.get(f'/api/v1/guest/{self.table.token}/loyalty/{member.token}/')
        self.assertEqual(ok.status_code, 200)
        foreign_table = Table.objects.create(restaurant=self.other, number=1)
        denied = self.client.get(f'/api/v1/guest/{foreign_table.token}/loyalty/{member.token}/')
        self.assertEqual(denied.status_code, 404)

    def test_admin_dashboard_and_waiter_denial(self):
        LoyaltyMember.objects.create(restaurant=self.rest, visits_count=2, lifetime_spend=5000, points=5)
        self.client.force_authenticate(self.admin)
        response = self.client.get(f'/api/v1/restaurants/{self.rest.id}/loyalty/')
        self.assertEqual(response.status_code, 200); self.assertEqual(response.data['repeat_rate'], 100.0)
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get(f'/api/v1/restaurants/{self.rest.id}/loyalty/').status_code, 403)

    def test_admin_cannot_read_foreign_loyalty(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(f'/api/v1/restaurants/{self.other.id}/loyalty/').status_code, 403)

    def test_program_settings_admin_and_waiter_denied(self):
        self.client.force_authenticate(self.admin)
        url = f'/api/v1/restaurants/{self.rest.id}/loyalty/program/'
        response = self.client.patch(url, {'reward_points': 7, 'reward_discount_amount': 1500, 'points_per_1000': 2}, format='json')
        self.assertEqual(response.status_code, 200); self.assertEqual(response.data['reward_points'], 7)
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.patch(url, {'reward_points': 1}, format='json').status_code, 403)

    def test_redemption_spends_points_once_and_discount_survives_recalc(self):
        from apps.loyalty.models import LoyaltyProgram, LoyaltyRedemption
        from apps.loyalty.services import redeem_reward
        member = LoyaltyMember.objects.create(restaurant=self.rest, points=12)
        session = TableSession.objects.create(restaurant=self.rest, table=self.table, table_number=1, table_token=self.table.token, loyalty_member=member)
        LoyaltyProgram.objects.create(restaurant=self.rest, reward_points=10, reward_discount_amount=1000)
        redeem_reward(session); redeem_reward(session)
        member.refresh_from_db(); session.refresh_from_db(); session.recalculate_totals(); session.refresh_from_db()
        self.assertEqual(member.points, 2); self.assertEqual(LoyaltyRedemption.objects.filter(session=session).count(), 1)
        self.assertEqual(session.loyalty_discount_amount, Decimal('1000')); self.assertEqual(session.total_amount, Decimal('0'))

    def test_guest_status_exposes_progress_not_pii(self):
        from apps.loyalty.models import LoyaltyProgram
        member = LoyaltyMember.objects.create(restaurant=self.rest, points=8)
        LoyaltyProgram.objects.create(restaurant=self.rest, reward_points=10, reward_discount_amount=1200)
        response = self.client.get(f'/api/v1/guest/{self.table.token}/loyalty/{member.token}/')
        self.assertEqual(response.status_code, 200); self.assertFalse(response.data['can_redeem']); self.assertEqual(response.data['points_to_reward'], 2)
        self.assertNotIn('email', response.data); self.assertNotIn('phone', response.data)
