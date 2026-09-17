from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.restaurants.models import Restaurant
from apps.sessions.models import SessionItem, TableSession
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
