from decimal import Decimal
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from apps.restaurants.models import Restaurant
from apps.sessions.models import SessionItem, TableSession, SLAIncident, ServiceRecoveryNote
from apps.tables.models import Table
from apps.users.models import User


def make_restaurant(slug):
    return Restaurant.objects.create(name='R', slug=slug, service_charge_percent=10)


def make_admin(restaurant):
    return User.objects.create_user(
        email=f'admin@{restaurant.slug}.com',
        password='pass1234',
        name='Admin',
        role='admin',
        restaurant=restaurant,
    )


def make_closed_session(restaurant, table, total):
    return TableSession.objects.create(
        restaurant=restaurant,
        table=table,
        table_number=table.number,
        table_token=table.token,
        status='closed',
        subtotal_amount=total,
        service_charge_amount=total * Decimal('0.1'),
        total_amount=total + total * Decimal('0.1'),
        service_charge_percent=10,
    )


class AnalyticsSummaryTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant('analytics-summary')
        self.table = Table.objects.create(restaurant=self.restaurant, number=1)
        self.admin = make_admin(self.restaurant)
        self.session = make_closed_session(self.restaurant, self.table, Decimal('1000.00'))
        SessionItem.objects.create(
            session=self.session,
            item_name='Плов',
            price=Decimal('500.00'),
            quantity=2,
            status='served',
        )

    def _url(self):
        return f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/'

    def test_anonymous_blocked(self):
        self.assertEqual(self.client.get(self._url()).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_summary_revenue_and_count(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sessions_count'], 1)
        self.assertEqual(Decimal(str(response.data['revenue'])), Decimal('1100.00'))

    def test_summary_avg_check(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url())
        self.assertEqual(Decimal(str(response.data['avg_check'])), Decimal('1100.00'))

    def test_top_items_populated(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url())
        self.assertEqual(len(response.data['top_items']), 1)
        self.assertEqual(response.data['top_items'][0]['item_name'], 'Плов')
        self.assertEqual(response.data['top_items'][0]['total_qty'], 2)
        self.assertEqual(
            Decimal(str(response.data['top_items'][0]['total_revenue'])),
            Decimal('1000.00'),
        )

    def test_non_billable_items_excluded_from_top(self):
        for item_status in ('awaiting_confirmation', 'rejected'):
            SessionItem.objects.create(
                session=self.session,
                item_name=f'Не оплачено {item_status}',
                price=Decimal('9999.00'),
                quantity=10,
                status=item_status,
            )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url())
        names = [i['item_name'] for i in response.data['top_items']]
        self.assertFalse(any(name.startswith('Не оплачено') for name in names))

    def test_cancelled_items_excluded_from_top(self):
        SessionItem.objects.create(
            session=self.session,
            item_name='Бургер',
            price=Decimal('800.00'),
            quantity=99,
            status='cancelled',
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url())
        names = [i['item_name'] for i in response.data['top_items']]
        self.assertNotIn('Бургер', names)

    def test_date_filter_future_returns_empty(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url(), {'from': '2099-01-01', 'to': '2099-12-31'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sessions_count'], 0)
        self.assertEqual(response.data['revenue'], 0)

    def test_service_recovery_analytics_has_breakdown_and_drilldown(self):
        ServiceRecoveryNote.objects.create(
            restaurant=self.restaurant, session=self.session, reason='delay',
            note='Гость ждал блюдо', compensation_type='dessert',
            compensation_amount=Decimal('1500.00'), created_by=self.admin,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url())
        recovery = response.data['service_recovery']
        self.assertEqual(recovery['total'], 1)
        self.assertEqual(Decimal(str(recovery['compensation_cost'])), Decimal('1500.00'))
        self.assertEqual(recovery['reasons'][0]['reason'], 'delay')
        self.assertEqual(recovery['recent'][0]['session_id'], str(self.session.id))
        self.assertEqual(recovery['recent'][0]['table_number'], 1)

    def test_service_recovery_coverage_counts_explicit_link_only(self):
        item = self.session.items.first()
        incident = SLAIncident.objects.create(restaurant=self.restaurant, item=item, kind='preparation', station='kitchen', target_minutes=10, breached_at=timezone.now())
        ServiceRecoveryNote.objects.create(restaurant=self.restaurant, session=self.session, reason='delay', note='linked', created_by=self.admin, source_sla_incident=incident)
        self.client.force_authenticate(user=self.admin)
        recovery = self.client.get(self._url()).data['service_recovery']
        self.assertGreaterEqual(recovery['serious_problems'], 1)
        self.assertEqual(recovery['linked_problems'], 1)
        self.assertGreater(recovery['coverage_pct'], 0)

    def test_service_recovery_is_tenant_scoped(self):
        other = make_restaurant('analytics-recovery-other')
        other_table = Table.objects.create(restaurant=other, number=9)
        other_session = make_closed_session(other, other_table, Decimal('100.00'))
        ServiceRecoveryNote.objects.create(
            restaurant=other, session=other_session, reason='quality', note='Other tenant',
            compensation_amount=Decimal('9999.00'), created_by=make_admin(other),
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url())
        self.assertEqual(response.data['service_recovery']['total'], 0)
        self.assertEqual(response.data['service_recovery']['recent'], [])

    def test_open_sessions_not_counted(self):
        TableSession.objects.create(
            restaurant=self.restaurant,
            table=self.table,
            table_number=1,
            table_token=self.table.token,
            status='open',
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url())
        self.assertEqual(response.data['sessions_count'], 1)


class AnalyticsSessionsListTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant('analytics-sessions')
        self.table = Table.objects.create(restaurant=self.restaurant, number=1)
        self.admin = make_admin(self.restaurant)
        self.session = make_closed_session(self.restaurant, self.table, Decimal('500.00'))

    def _url(self):
        return f'/api/v1/restaurants/{self.restaurant.id}/analytics/sessions/'

    def test_anonymous_blocked(self):
        self.assertEqual(self.client.get(self._url()).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_closed_sessions(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_open_sessions_excluded(self):
        TableSession.objects.create(
            restaurant=self.restaurant,
            table=self.table,
            table_number=1,
            table_token=self.table.token,
            status='open',
        )
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(len(self.client.get(self._url()).data), 1)

    def test_date_filter_works(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url(), {'from': '2099-01-01'})
        self.assertEqual(len(response.data), 0)

class UpsellAnalyticsTest(APITestCase):
    def setUp(self):
        from apps.menu.models import MenuItem, UpsellRule
        from apps.analytics.models import UpsellEvent
        self.restaurant = make_restaurant('upsell-analytics')
        self.table = Table.objects.create(restaurant=self.restaurant, number=1)
        self.admin = make_admin(self.restaurant)
        trigger = MenuItem.objects.create(restaurant=self.restaurant, name='Burger', price=2500)
        target = MenuItem.objects.create(restaurant=self.restaurant, name='Cola', price=700)
        rule = UpsellRule.objects.create(restaurant=self.restaurant, trigger_item=trigger, recommended_item=target)
        UpsellEvent.objects.create(restaurant=self.restaurant, rule=rule, table=self.table, event_type='impression')
        UpsellEvent.objects.create(restaurant=self.restaurant, rule=rule, table=self.table, event_type='impression')
        UpsellEvent.objects.create(restaurant=self.restaurant, rule=rule, table=self.table, event_type='add')
        UpsellEvent.objects.create(restaurant=self.restaurant, rule=rule, table=self.table, event_type='conversion', revenue=Decimal('700'))

    def test_owner_summary_contains_upsell_funnel_and_revenue(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['upsell']['impressions'], 2)
        self.assertEqual(response.data['upsell']['adds'], 1)
        self.assertEqual(response.data['upsell']['conversions'], 1)
        self.assertEqual(response.data['upsell']['conversion_rate'], 50.0)
        self.assertEqual(Decimal(str(response.data['upsell']['revenue'])), Decimal('700'))

class OwnerDashboardV2Test(APITestCase):
    def setUp(self):
        from django.utils import timezone
        self.restaurant = make_restaurant('owner-dashboard-v2')
        self.table = Table.objects.create(restaurant=self.restaurant, number=1)
        self.admin = make_admin(self.restaurant)
        self.now = timezone.now()

    def _closed(self, total, created_at, closed_at):
        s = make_closed_session(self.restaurant, self.table, Decimal(str(total)))
        # auto_now_add fields are updated explicitly so period/operational metrics
        # are deterministic and do not depend on the test runner's wall clock.
        TableSession.objects.filter(pk=s.pk).update(created_at=created_at, closed_at=closed_at)
        return s

    def test_period_comparison_and_operational_kpis(self):
        from django.utils import timezone
        current_day = self.now.date()
        previous_day = current_day - __import__('datetime').timedelta(days=1)
        current_start = timezone.make_aware(__import__('datetime').datetime.combine(current_day, __import__('datetime').time(10, 0)))
        current_close = current_start + __import__('datetime').timedelta(minutes=60)
        previous_start = timezone.make_aware(__import__('datetime').datetime.combine(previous_day, __import__('datetime').time(10, 0)))
        previous_close = previous_start + __import__('datetime').timedelta(minutes=30)
        self._closed('2000.00', current_start, current_close)   # total 2200
        self._closed('1000.00', previous_start, previous_close) # total 1100

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/',
            {'from': current_day.isoformat(), 'to': current_day.isoformat()},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['comparison']['revenue_change_pct'], 100.0)
        self.assertEqual(response.data['comparison']['sessions_change_pct'], 0.0)
        self.assertEqual(response.data['operations']['active_tables'], 1)
        self.assertEqual(response.data['operations']['avg_session_minutes'], 60.0)
        self.assertEqual(response.data['operations']['best_hour']['hour'], current_close.hour)
        self.assertIsNotNone(response.data['operations']['best_day'])
        self.assertGreater(response.data['operations']['table_utilization_pct'], 0)

    def test_manager_can_view_but_waiter_cannot(self):
        manager = User.objects.create_user(email='manager@dash.test', password='x', name='M', role='manager', restaurant=self.restaurant)
        waiter = User.objects.create_user(email='waiter@dash.test', password='x', name='W', role='waiter', restaurant=self.restaurant)
        url = f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/'
        self.client.force_authenticate(user=manager)
        self.assertEqual(self.client.get(url).status_code, 200)
        self.client.force_authenticate(user=waiter)
        self.assertEqual(self.client.get(url).status_code, 403)

    def test_cross_tenant_dashboard_is_forbidden(self):
        other = make_restaurant('owner-dashboard-other')
        foreign_admin = make_admin(other)
        self.client.force_authenticate(user=foreign_admin)
        self.assertEqual(self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/').status_code, 403)

class NetworkAnalyticsTests(APITestCase):
    def setUp(self):
        from apps.restaurants.models import Restaurant, RestaurantNetwork
        from apps.users.models import User
        self.owner_rest = Restaurant.objects.create(name='Central', slug='central-network')
        self.branch = Restaurant.objects.create(name='Branch 2', slug='branch-2-network')
        self.foreign = Restaurant.objects.create(name='Foreign', slug='foreign-network')
        self.owner = User.objects.create_user(email='network-owner@test.kz', password='x', name='Owner', role='admin', restaurant=self.owner_rest)
        self.manager = User.objects.create_user(email='network-manager@test.kz', password='x', name='Manager', role='manager', restaurant=self.owner_rest)
        self.foreign_admin = User.objects.create_user(email='foreign-owner@test.kz', password='x', name='Foreign', role='admin', restaurant=self.foreign)
        self.support = User.objects.create_superuser(email='support-network@test.kz', password='x', name='Support', role='superadmin')
        self.network = RestaurantNetwork.objects.create(name='Plait Group', owner_restaurant=self.owner_rest)
        self.network.restaurants.add(self.owner_rest, self.branch)

    def test_owner_sees_only_network_branches(self):
        self.client.force_authenticate(self.owner)
        r = self.client.get(f'/api/v1/restaurants/networks/{self.network.id}/analytics/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual({x['name'] for x in r.data['branches']}, {'Central', 'Branch 2'})
        self.assertNotIn('Foreign', str(r.data))

    def test_manager_and_foreign_admin_denied(self):
        for user in (self.manager, self.foreign_admin):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(f'/api/v1/restaurants/networks/{self.network.id}/analytics/').status_code, 403)

    def test_owner_cannot_claim_foreign_branch(self):
        self.client.force_authenticate(self.owner)
        r = self.client.post(f'/api/v1/restaurants/networks/{self.network.id}/members/', {'restaurant_id': str(self.foreign.id)}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_support_can_link_branch(self):
        self.client.force_authenticate(self.support)
        r = self.client.post(f'/api/v1/restaurants/networks/{self.network.id}/members/', {'restaurant_id': str(self.foreign.id)}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(self.network.restaurants.filter(id=self.foreign.id).exists())

class KitchenSlaAnalyticsTest(APITestCase):
    def setUp(self):
        import datetime
        from django.utils import timezone
        self.restaurant = make_restaurant('kitchen-sla')
        self.table = Table.objects.create(restaurant=self.restaurant, number=1)
        self.admin = make_admin(self.restaurant)
        self.session = make_closed_session(self.restaurant, self.table, Decimal('1000.00'))
        now = timezone.now()
        # Kitchen: one 15m on-time item and one 30m late item.
        for name, prep, handoff in [('Soup', 15, 4), ('Steak', 30, 8)]:
            confirmed = now - datetime.timedelta(minutes=prep + handoff)
            ready = confirmed + datetime.timedelta(minutes=prep)
            SessionItem.objects.create(session=self.session, item_name=name, price=500, quantity=1,
                status='served', preparation_station='kitchen', confirmed_at=confirmed,
                ready_at=ready, served_at=ready + datetime.timedelta(minutes=handoff))
        # Bar target is 10m: 12m must be late.
        confirmed = now - datetime.timedelta(minutes=15)
        SessionItem.objects.create(session=self.session, item_name='Tea', price=300, quantity=1,
            status='served', preparation_station='bar', confirmed_at=confirmed,
            ready_at=confirmed + datetime.timedelta(minutes=12), served_at=now)

    def test_kitchen_sla_summary_and_station_targets(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        self.assertEqual(r.status_code, 200)
        sla = r.data['kitchen_sla']
        self.assertEqual(sla['measured_items'], 3)
        self.assertEqual(sla['late_items'], 2)
        self.assertEqual(sla['sla_met_pct'], 33.3)
        self.assertEqual(sla['p95_prep_minutes'], 30.0)
        stations = {x['station']: x for x in sla['stations']}
        self.assertEqual(stations['kitchen']['target_minutes'], 20.0)
        self.assertEqual(stations['kitchen']['late_items'], 1)
        self.assertEqual(stations['bar']['target_minutes'], 10.0)
        self.assertEqual(stations['bar']['late_items'], 1)

    def test_missing_or_invalid_timestamps_are_not_fake_zeroes(self):
        now = __import__('django.utils.timezone', fromlist=['now']).now()
        SessionItem.objects.create(session=self.session, item_name='Missing', price=100, quantity=1,
            status='confirmed', preparation_station='kitchen', confirmed_at=now)
        SessionItem.objects.create(session=self.session, item_name='Invalid', price=100, quantity=1,
            status='ready', preparation_station='kitchen', confirmed_at=now, ready_at=now - __import__('datetime').timedelta(minutes=1))
        self.client.force_authenticate(user=self.admin)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        self.assertEqual(r.data['kitchen_sla']['measured_items'], 3)

class StaffEfficiencyAnalyticsTest(APITestCase):
    def setUp(self):
        import datetime
        from django.utils import timezone
        self.restaurant = make_restaurant('staff-efficiency')
        self.table = Table.objects.create(restaurant=self.restaurant, number=1)
        self.admin = make_admin(self.restaurant)
        self.waiter = User.objects.create_user(email='waiter@staff.test', password='pass1234', name='Aruzhan', role='waiter', restaurant=self.restaurant)
        self.session = make_closed_session(self.restaurant, self.table, Decimal('3000.00'))
        now = timezone.now()
        for idx in range(3):
            item = SessionItem.objects.create(session=self.session, item_name=f'Item {idx}', price=1000, quantity=1, status='served', preparation_station='kitchen', confirmed_by=self.waiter, served_by=self.waiter, confirmed_at=now-datetime.timedelta(minutes=12-idx), ready_at=now-datetime.timedelta(minutes=5), served_at=now-datetime.timedelta(minutes=2))
            SessionItem.objects.filter(pk=item.pk).update(created_at=now-datetime.timedelta(minutes=14-idx))

    def test_staff_efficiency_uses_server_attributed_actions(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        self.assertEqual(r.status_code, 200)
        staff = r.data['staff_efficiency']
        self.assertEqual(staff['response_samples'], 3)
        self.assertEqual(staff['serve_samples'], 3)
        self.assertEqual(staff['avg_response_minutes'], 2.0)
        self.assertEqual(staff['avg_ready_to_served_minutes'], 3.0)
        self.assertEqual(len(staff['waiters']), 1)
        self.assertEqual(staff['waiters'][0]['name'], 'Aruzhan')

    def test_unattributed_history_is_not_guessed(self):
        from django.utils import timezone
        now = timezone.now()
        SessionItem.objects.create(session=self.session, item_name='Legacy', price=100, quantity=1, status='served', confirmed_at=now, ready_at=now, served_at=now)
        self.client.force_authenticate(self.admin)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        self.assertEqual(r.data['staff_efficiency']['response_samples'], 3)
        self.assertEqual(r.data['staff_efficiency']['serve_samples'], 3)

class ConfigurableSlaTargetsTest(APITestCase):
    def setUp(self):
        import datetime
        from django.utils import timezone
        self.restaurant = make_restaurant('custom-sla')
        self.restaurant.kitchen_sla_minutes = 12
        self.restaurant.bar_sla_minutes = 8
        self.restaurant.ready_to_served_sla_minutes = 3
        self.restaurant.save(update_fields=['kitchen_sla_minutes', 'bar_sla_minutes', 'ready_to_served_sla_minutes'])
        self.table = Table.objects.create(restaurant=self.restaurant, number=1)
        self.admin = make_admin(self.restaurant)
        self.waiter = User.objects.create_user(email='waiter@sla.test', password='pass1234', name='Waiter', role='waiter', restaurant=self.restaurant)
        self.session = make_closed_session(self.restaurant, self.table, Decimal('1000.00'))
        now = timezone.now()
        confirmed = now - datetime.timedelta(minutes=20)
        ready = confirmed + datetime.timedelta(minutes=15)
        SessionItem.objects.create(session=self.session, item_name='Dish', price=1000, quantity=1, status='served', preparation_station='kitchen', confirmed_at=confirmed, ready_at=ready, served_at=ready + datetime.timedelta(minutes=4))

    def test_analytics_uses_restaurant_targets_for_prep_and_handoff(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        self.assertEqual(r.status_code, 200)
        sla = r.data['kitchen_sla']
        self.assertEqual(sla['stations'][0]['target_minutes'], 12.0)
        self.assertEqual(sla['late_items'], 1)
        self.assertEqual(sla['ready_to_served_target_minutes'], 3.0)
        self.assertEqual(sla['handoff_late_items'], 1)
        self.assertEqual(sla['handoff_sla_met_pct'], 0.0)

    def test_admin_can_update_targets_and_waiter_cannot(self):
        url = f'/api/v1/restaurants/{self.restaurant.id}/settings/'
        self.client.force_authenticate(self.admin)
        r = self.client.patch(url, {'kitchen_sla_minutes': 25, 'bar_sla_minutes': 7, 'ready_to_served_sla_minutes': 4}, format='json')
        self.assertEqual(r.status_code, 200)
        self.restaurant.refresh_from_db()
        self.assertEqual(self.restaurant.kitchen_sla_minutes, 25)
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.patch(url, {'kitchen_sla_minutes': 1}, format='json').status_code, 403)

    def test_sla_target_validation(self):
        self.client.force_authenticate(self.admin)
        url = f'/api/v1/restaurants/{self.restaurant.id}/settings/'
        self.assertEqual(self.client.patch(url, {'kitchen_sla_minutes': 0}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url, {'bar_sla_minutes': 181}, format='json').status_code, 400)


class SLAIncidentTrendAnalyticsTest(APITestCase):
    def setUp(self):
        import datetime
        from django.utils import timezone
        self.restaurant = make_restaurant('sla-trends')
        self.table = Table.objects.create(restaurant=self.restaurant, number=1)
        self.admin = make_admin(self.restaurant)
        self.other = make_restaurant('sla-trends-other')
        self.session = make_closed_session(self.restaurant, self.table, Decimal('1000.00'))
        now = timezone.now()
        for idx, (station, resolved) in enumerate([('kitchen', True), ('kitchen', True), ('bar', False)]):
            item = SessionItem.objects.create(session=self.session, item_name=f'SLA {idx}', price=100, quantity=1, status='served', preparation_station=station)
            breached = now - datetime.timedelta(hours=idx + 1)
            SLAIncident.objects.create(restaurant=self.restaurant, item=item, kind='preparation', station=station, target_minutes=10, breached_at=breached, resolved_at=(breached + datetime.timedelta(minutes=4 + idx)) if resolved else None)

    def test_trends_aggregate_breaches_resolution_and_stations(self):
        from django.utils import timezone
        today = timezone.localdate().isoformat()
        self.client.force_authenticate(self.admin)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/?from={today}&to={today}')
        self.assertEqual(r.status_code, 200)
        trends = r.data['sla_incident_trends']
        self.assertEqual(trends['breaches'], 3)
        self.assertEqual(trends['resolved'], 2)
        self.assertEqual(trends['active'], 1)
        self.assertEqual(trends['resolution_rate_pct'], 66.7)
        self.assertEqual(trends['by_station'][0], {'station': 'kitchen', 'breaches': 2})
        self.assertEqual(trends['by_station'][1], {'station': 'bar', 'breaches': 1})

    def test_trends_are_tenant_scoped(self):
        from django.utils import timezone
        other_table = Table.objects.create(restaurant=self.other, number=1)
        other_session = make_closed_session(self.other, other_table, Decimal('1000.00'))
        item = SessionItem.objects.create(session=other_session, item_name='Foreign', price=100, quantity=1, status='served')
        SLAIncident.objects.create(restaurant=self.other, item=item, kind='preparation', station='kitchen', target_minutes=10, breached_at=timezone.now())
        self.client.force_authenticate(self.admin)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        self.assertEqual(r.data['sla_incident_trends']['breaches'], 3)

class ShiftZoneOperationalAnalyticsTest(APITestCase):
    def setUp(self):
        import datetime
        from django.utils import timezone
        from apps.schedule.models import Shift
        from apps.zones.models import Zone
        self.restaurant = make_restaurant('shift-zone-ops')
        self.admin = make_admin(self.restaurant)
        self.waiter = User.objects.create_user(email='shiftwaiter@test.kz', password='pass1234', name='Shift Waiter', role='waiter', restaurant=self.restaurant)
        self.zone = Zone.objects.create(restaurant=self.restaurant, name='Терраса')
        self.table = Table.objects.create(restaurant=self.restaurant, number=1, zone=self.zone)
        now = timezone.localtime(timezone.now())
        start = (now - datetime.timedelta(hours=1)).time().replace(second=0, microsecond=0, tzinfo=None)
        end = (now + datetime.timedelta(hours=1)).time().replace(second=0, microsecond=0, tzinfo=None)
        # Avoid an accidental midnight crossing in this fixture by using a broad daytime window.
        start = datetime.time(0, 0); end = datetime.time(23, 59)
        Shift.objects.create(restaurant=self.restaurant, staff=self.waiter, date=now.date(), start_time=start, end_time=end)
        self.session = make_closed_session(self.restaurant, self.table, Decimal('2000.00'))
        TableSession.objects.filter(pk=self.session.pk).update(closed_at=timezone.now())
        item = SessionItem.objects.create(session=self.session, item_name='Slow dish', price=2000, quantity=1, status='served')
        SLAIncident.objects.create(restaurant=self.restaurant, item=item, kind='preparation', station='kitchen', target_minutes=20, breached_at=timezone.now())

    def test_shift_window_and_zone_aggregate_without_staff_ranking(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        self.assertEqual(r.status_code, 200)
        ops = r.data['shift_zone_operations']
        self.assertEqual(len(ops['shifts']), 1)
        self.assertEqual(ops['shifts'][0]['staff_count'], 1)
        self.assertEqual(ops['shifts'][0]['sessions'], 1)
        self.assertEqual(ops['shifts'][0]['sla_breaches'], 1)
        terrace = next(row for row in ops['zones'] if row['name'] == 'Терраса')
        self.assertEqual(terrace['sessions'], 1)
        self.assertEqual(terrace['sla_breaches'], 1)
        self.assertGreater(float(terrace['revenue']), 0)

    def test_overlapping_same_window_staff_does_not_double_count_revenue(self):
        import datetime
        from django.utils import timezone
        from apps.schedule.models import Shift
        second = User.objects.create_user(email='secondshift@test.kz', password='pass1234', name='Second', role='waiter', restaurant=self.restaurant)
        today = timezone.localdate()
        Shift.objects.create(restaurant=self.restaurant, staff=second, date=today, start_time=datetime.time(0, 0), end_time=datetime.time(23, 59))
        self.client.force_authenticate(self.admin)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        shift = r.data['shift_zone_operations']['shifts'][0]
        self.assertEqual(shift['staff_count'], 2)
        self.assertEqual(shift['sessions'], 1)

class ManagerDailyDigestTest(APITestCase):
    def setUp(self):
        import datetime
        from django.utils import timezone
        from apps.schedule.models import Shift
        from apps.zones.models import Zone
        self.restaurant = make_restaurant('daily-digest')
        self.admin = make_admin(self.restaurant)
        self.manager = User.objects.create_user(email='digestmanager@test.kz', password='pass1234', name='Manager', role='manager', restaurant=self.restaurant)
        self.waiter = User.objects.create_user(email='digestwaiter@test.kz', password='pass1234', name='Waiter', role='waiter', restaurant=self.restaurant)
        self.zone = Zone.objects.create(restaurant=self.restaurant, name='Зал A')
        self.table = Table.objects.create(restaurant=self.restaurant, number=1, zone=self.zone)
        self.session = make_closed_session(self.restaurant, self.table, Decimal('5000.00'))
        TableSession.objects.filter(pk=self.session.pk).update(closed_at=timezone.now(), total_amount=Decimal('5000.00'))
        now = timezone.localtime(timezone.now())
        Shift.objects.create(restaurant=self.restaurant, staff=self.waiter, date=now.date(), start_time=datetime.time(0, 0), end_time=datetime.time(23, 59))
        item = SessionItem.objects.create(session=self.session, item_name='Digest dish', price=5000, quantity=1, status='served')
        self.incident = SLAIncident.objects.create(restaurant=self.restaurant, item=item, kind='preparation', station='kitchen', target_minutes=20, breached_at=timezone.now())

    def test_manager_daily_digest_uses_today_authoritative_data(self):
        from django.utils import timezone
        self.client.force_authenticate(self.manager)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        self.assertEqual(r.status_code, 200)
        digest = r.data['daily_digest']
        self.assertEqual(digest['date'], timezone.localdate().isoformat())
        self.assertEqual(digest['sessions_count'], 1)
        self.assertEqual(Decimal(str(digest['revenue'])), Decimal('5000.00'))
        self.assertEqual(digest['sla_breaches'], 1)
        self.assertEqual(digest['active_incidents'], 1)
        self.assertEqual(digest['scheduled_staff'], 1)
        self.assertEqual(digest['staff_on_shift_now'], 1)
        self.assertEqual(digest['problem_zone']['name'], 'Зал A')
        self.assertEqual(digest['attention'][0]['code'], 'active_sla')
        self.assertEqual(digest['attention'][0]['action']['kind'], 'session')
        self.assertEqual(digest['attention'][0]['action']['session_id'], str(self.session.id))
        zone_attention = next(a for a in digest['attention'] if a['code'] == 'problem_zone')
        self.assertEqual(zone_attention['action'], {'kind': 'zone', 'zone_id': str(self.zone.id)})

    def test_digest_no_current_shift_drills_into_schedule(self):
        from apps.schedule.models import Shift
        Shift.objects.filter(restaurant=self.restaurant).delete()
        import datetime
        from django.utils import timezone
        now_local = timezone.localtime(timezone.now())
        future_start = (now_local + datetime.timedelta(hours=2)).time().replace(tzinfo=None)
        future_end = (now_local + datetime.timedelta(hours=3)).time().replace(tzinfo=None)
        Shift.objects.create(restaurant=self.restaurant, staff=self.waiter, date=timezone.localdate(), start_time=future_start, end_time=future_end)
        self.incident.resolved_at = timezone.now()
        self.incident.save(update_fields=['resolved_at'])
        self.client.force_authenticate(self.manager)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        attention = r.data['daily_digest']['attention']
        row = next(a for a in attention if a['code'] == 'no_current_shift')
        self.assertEqual(row['action'], {'kind': 'schedule'})

    def test_digest_is_tenant_isolated(self):
        from django.utils import timezone
        other = make_restaurant('daily-digest-other')
        table = Table.objects.create(restaurant=other, number=99)
        session = make_closed_session(other, table, Decimal('99000.00'))
        TableSession.objects.filter(pk=session.pk).update(closed_at=timezone.now(), total_amount=Decimal('99000.00'))
        item = SessionItem.objects.create(session=session, item_name='Foreign', price=99000, quantity=1, status='served')
        SLAIncident.objects.create(restaurant=other, item=item, kind='preparation', station='kitchen', target_minutes=20, breached_at=timezone.now())
        self.client.force_authenticate(self.admin)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        digest = r.data['daily_digest']
        self.assertEqual(digest['sessions_count'], 1)
        self.assertEqual(digest['sla_breaches'], 1)

    def test_waiter_cannot_read_manager_digest(self):
        self.client.force_authenticate(self.waiter)
        r = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/')
        self.assertEqual(r.status_code, 403)
