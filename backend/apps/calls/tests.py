from rest_framework import status
from rest_framework.test import APITestCase

from apps.calls.models import WaiterCall
from apps.restaurants.models import Restaurant
from apps.tables.models import Table
from apps.users.models import User


def make_restaurant(slug):
    return Restaurant.objects.create(name='R', slug=slug)


def make_table(restaurant, number=1):
    return Table.objects.create(restaurant=restaurant, number=number)


def make_staff(restaurant, role='waiter'):
    return User.objects.create_user(
        email=f'{role}@{restaurant.slug}.com',
        password='pass1234',
        name=role.capitalize(),
        role=role,
        restaurant=restaurant,
    )


class WaiterCallCreateTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant('calls-create')
        self.table = make_table(self.restaurant)

    def test_guest_creates_call(self):
        response = self.client.post('/api/v1/waiter-calls/', {
            'table_token': self.table.token,
            'reason': 'Нужна вода',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WaiterCall.objects.count(), 1)
        call = WaiterCall.objects.first()
        self.assertEqual(call.table_number, self.table.number)
        self.assertEqual(call.restaurant, self.restaurant)

    def test_reason_saved(self):
        self.client.post('/api/v1/waiter-calls/', {
            'table_token': self.table.token,
            'reason': 'Принесите меню',
        })
        self.assertEqual(WaiterCall.objects.first().reason, 'Принесите меню')

    def test_invalid_token_returns_404(self):
        response = self.client.post('/api/v1/waiter-calls/', {
            'table_token': 'nonexistent-token-xyz',
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_inactive_table_returns_404(self):
        self.table.is_active = False
        self.table.save()
        response = self.client.post('/api/v1/waiter-calls/', {
            'table_token': self.table.token,
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_new_call_has_status_new(self):
        self.client.post('/api/v1/waiter-calls/', {'table_token': self.table.token})
        self.assertEqual(WaiterCall.objects.first().status, 'new')


class WaiterCallListTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant('calls-list')
        self.table = make_table(self.restaurant)
        self.staff = make_staff(self.restaurant, role='waiter')
        self.other_restaurant = make_restaurant('calls-other')
        self.other_staff = make_staff(self.other_restaurant, role='waiter')

    def _create_call(self, status_val='new'):
        return WaiterCall.objects.create(
            restaurant=self.restaurant,
            table=self.table,
            table_number=self.table.number,
            table_token=self.table.token,
            status=status_val,
        )

    def _url(self):
        return f'/api/v1/restaurants/{self.restaurant.id}/waiter-calls/'

    def test_anonymous_blocked(self):
        self.assertEqual(self.client.get(self._url()).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_other_restaurant_staff_blocked(self):
        self.client.force_authenticate(user=self.other_staff)
        self.assertEqual(self.client.get(self._url()).status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_sees_all_calls(self):
        self._create_call('new')
        self._create_call('closed')
        self.client.force_authenticate(user=self.staff)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_status_filter(self):
        self._create_call('new')
        self._create_call('closed')
        self.client.force_authenticate(user=self.staff)
        response = self.client.get(self._url(), {'status': 'new'})
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['status'], 'new')


class WaiterCallUpdateTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant('calls-update')
        self.table = make_table(self.restaurant)
        self.staff = make_staff(self.restaurant, role='waiter')
        self.call = WaiterCall.objects.create(
            restaurant=self.restaurant,
            table=self.table,
            table_number=self.table.number,
            table_token=self.table.token,
            status='new',
        )

    def _url(self):
        return f'/api/v1/restaurants/{self.restaurant.id}/waiter-calls/{self.call.id}/'

    def test_staff_accepts_call(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.patch(self._url(), {'status': 'accepted'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.call.refresh_from_db()
        self.assertEqual(self.call.status, 'accepted')

    def test_staff_closes_call(self):
        self.client.force_authenticate(user=self.staff)
        self.client.patch(self._url(), {'status': 'accepted'})
        response = self.client.patch(self._url(), {'status': 'closed'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.call.refresh_from_db()
        self.assertEqual(self.call.status, 'closed')

    def test_anonymous_blocked(self):
        self.assertEqual(
            self.client.patch(self._url(), {'status': 'accepted'}).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
