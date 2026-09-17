from rest_framework import status
from rest_framework.test import APITestCase

from apps.restaurants.models import Restaurant
from apps.tables.models import Table
from apps.users.models import User


def make_restaurant(slug):
    return Restaurant.objects.create(name='R', slug=slug)


def make_user(restaurant, role='admin'):
    return User.objects.create_user(
        email=f'{role}@{restaurant.slug}.com',
        password='pass1234',
        name=role.capitalize(),
        role=role,
        restaurant=restaurant,
    )


class TableListCreateTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant('tables-create')
        self.admin = make_user(self.restaurant, role='admin')
        self.other_restaurant = make_restaurant('tables-other')
        self.other_admin = make_user(self.other_restaurant, role='admin')

    def _url(self):
        return f'/api/v1/restaurants/{self.restaurant.id}/tables/'

    def test_anonymous_blocked(self):
        self.assertEqual(self.client.get(self._url()).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_other_restaurant_admin_blocked(self):
        self.client.force_authenticate(user=self.other_admin)
        self.assertEqual(self.client.post(self._url(), {'number': 1}).status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_creates_table(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._url(), {'number': 1})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Table.objects.count(), 1)

    def test_created_table_belongs_to_restaurant(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(self._url(), {'number': 1})
        self.assertEqual(Table.objects.first().restaurant, self.restaurant)

    def test_token_and_qr_url_in_response(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._url(), {'number': 1})
        self.assertIn('token', response.data)
        self.assertIn('qr_url', response.data)
        self.assertIn('token=', response.data['qr_url'])

    def test_admin_lists_tables(self):
        Table.objects.create(restaurant=self.restaurant, number=1)
        Table.objects.create(restaurant=self.restaurant, number=2)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_duplicate_number_rejected(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(self._url(), {'number': 5})
        response = self.client.post(self._url(), {'number': 5})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_waiter_cannot_create_table(self):
        waiter = make_user(self.restaurant, role='waiter')
        self.client.force_authenticate(user=waiter)
        response = self.client.post(self._url(), {'number': 1})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TableDeleteTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant('tables-delete')
        self.admin = make_user(self.restaurant, role='admin')
        self.table = Table.objects.create(restaurant=self.restaurant, number=1)

    def _url(self):
        return f'/api/v1/restaurants/{self.restaurant.id}/tables/{self.table.id}/'

    def test_admin_deletes_table(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(self._url())
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Table.objects.count(), 0)

    def test_anonymous_blocked(self):
        self.assertEqual(self.client.delete(self._url()).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cannot_delete_other_restaurant_table(self):
        other = make_restaurant('tables-delete-other')
        other_admin = make_user(other, role='admin')
        self.client.force_authenticate(user=other_admin)
        self.assertEqual(self.client.delete(self._url()).status_code, status.HTTP_403_FORBIDDEN)


class GuestTableQrFlowTest(APITestCase):
    """Critical public QR flow: token -> active table -> restaurant/menu context."""

    def setUp(self):
        self.restaurant = make_restaurant('guest-qr-flow')
        self.admin = make_user(self.restaurant, role='admin')
        self.table = Table.objects.create(restaurant=self.restaurant, number=7)

    def _guest_url(self, token=None):
        return f'/api/v1/guest/{token or self.table.token}/'

    def test_active_table_token_resolves_public_guest_context(self):
        response = self.client.get(self._guest_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['table']['number'], 7)
        self.assertEqual(response.data['table']['token'], self.table.token)
        self.assertEqual(response.data['restaurant']['slug'], self.restaurant.slug)
        self.assertIn('categories', response.data)
        self.assertIn('menu_items', response.data)

    def test_inactive_table_token_is_rejected(self):
        self.table.is_active = False
        self.table.save(update_fields=['is_active'])

        response = self.client.get(self._guest_url())
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_regenerate_token_invalidates_old_qr_and_new_token_works(self):
        old_token = self.table.token
        regenerate_url = (
            f'/api/v1/restaurants/{self.restaurant.id}/tables/'
            f'{self.table.id}/regenerate-token/'
        )

        self.client.force_authenticate(user=self.admin)
        rotate_response = self.client.post(regenerate_url)
        self.assertEqual(rotate_response.status_code, status.HTTP_200_OK)

        new_token = rotate_response.data['token']
        self.assertNotEqual(old_token, new_token)

        # Public requests must not inherit the admin auth requirement/state.
        self.client.force_authenticate(user=None)
        old_response = self.client.get(self._guest_url(old_token))
        new_response = self.client.get(self._guest_url(new_token))

        self.assertEqual(old_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(new_response.status_code, status.HTTP_200_OK)
        self.assertEqual(new_response.data['table']['number'], 7)

    def test_generated_qr_url_contains_restaurant_slug_and_table_token(self):
        qr_url = self.table.qr_url
        self.assertIn(f'slug={self.restaurant.slug}', qr_url)
        self.assertIn(f'token={self.table.token}', qr_url)
