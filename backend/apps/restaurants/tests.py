from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.restaurants.models import Promo, Restaurant


class RestaurantListTest(APITestCase):
    def setUp(self):
        self.public = Restaurant.objects.create(name='Public Cafe', slug='public-cafe', is_public=True)
        Restaurant.objects.create(name='Private Cafe', slug='private-cafe', is_public=False)

    def test_lists_only_public_restaurants(self):
        response = self.client.get('/api/v1/restaurants/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['slug'], 'public-cafe')

    def test_get_by_id(self):
        response = self.client.get(f'/api/v1/restaurants/{self.public.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Public Cafe')

    def test_get_by_slug(self):
        response = self.client.get('/api/v1/restaurants/by-slug/public-cafe/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], str(self.public.id))

    def test_unknown_slug_returns_404(self):
        response = self.client.get('/api/v1/restaurants/by-slug/does-not-exist/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_response_fields_present(self):
        response = self.client.get(f'/api/v1/restaurants/{self.public.id}/')
        for field in ('id', 'name', 'slug', 'service_charge_percent', 'allow_waiter_close'):
            self.assertIn(field, response.data)


class PromoListTest(APITestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(name='R', slug='promo-test')
        # FIX: the view filters by timezone.now().date() (TIME_ZONE='UTC'),
        # so test fixtures must use the same "today" — otherwise this test
        # is flaky depending on the local timezone of the machine running it
        # (e.g. local date.today() can be a day ahead of UTC).
        today = timezone.now().date()

        Promo.objects.create(
            restaurant=self.restaurant, title='Future',
            is_active=True, valid_until=today + timedelta(days=5),
        )
        Promo.objects.create(
            restaurant=self.restaurant, title='Ongoing',
            is_active=True, valid_until=None,
        )
        Promo.objects.create(
            restaurant=self.restaurant, title='Inactive',
            is_active=False, valid_until=today + timedelta(days=5),
        )
        Promo.objects.create(
            restaurant=self.restaurant, title='Expired',
            is_active=True, valid_until=today - timedelta(days=1),
        )

    def _url(self):
        return f'/api/v1/restaurants/{self.restaurant.id}/promos/'

    def test_active_future_promo_shown(self):
        response = self.client.get(self._url())
        titles = [p['title'] for p in response.data]
        self.assertIn('Future', titles)

    def test_ongoing_promo_without_expiry_shown(self):
        response = self.client.get(self._url())
        titles = [p['title'] for p in response.data]
        self.assertIn('Ongoing', titles)

    def test_inactive_promo_hidden(self):
        response = self.client.get(self._url())
        titles = [p['title'] for p in response.data]
        self.assertNotIn('Inactive', titles)

    def test_expired_promo_hidden(self):
        response = self.client.get(self._url())
        titles = [p['title'] for p in response.data]
        self.assertNotIn('Expired', titles)

    def test_total_visible_count(self):
        response = self.client.get(self._url())
        self.assertEqual(len(response.data), 2)

class RestaurantOnboardingPublishTest(APITestCase):
    def setUp(self):
        from apps.users.models import User
        self.restaurant = Restaurant.objects.create(
            name='Launch Cafe', slug='launch-cafe', is_public=False,
            address='Алматы, Абая 1', working_hours='09:00–23:00',
        )
        self.admin = User.objects.create_user(email='owner@launch.test', password='x', name='Owner', role='admin', restaurant=self.restaurant)
        self.manager = User.objects.create_user(email='manager@launch.test', password='x', name='Manager', role='manager', restaurant=self.restaurant)
        self.waiter = User.objects.create_user(email='waiter@launch.test', password='x', name='Waiter', role='waiter', restaurant=self.restaurant)
        self.kitchen = User.objects.create_user(email='kitchen@launch.test', password='x', name='Kitchen', role='kitchen', restaurant=self.restaurant)
        self.url = f'/api/v1/restaurants/{self.restaurant.id}/settings/'

    def _make_ready(self):
        from apps.menu.models import MenuItem
        from apps.tables.models import Table
        MenuItem.objects.create(restaurant=self.restaurant, name='Плов', price='2500.00', is_visible=True, is_available=True)
        Table.objects.create(restaurant=self.restaurant, number=1)
        # manager created in setUp is the operational employee required by readiness.

    def test_cannot_publish_until_real_restaurant_primitives_exist(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(self.url, {'is_public': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.restaurant.refresh_from_db()
        self.assertFalse(self.restaurant.is_public)

    def test_admin_can_publish_ready_restaurant(self):
        self._make_ready()
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(self.url, {'is_public': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.restaurant.refresh_from_db()
        self.assertTrue(self.restaurant.is_public)

    def test_manager_can_publish_ready_restaurant(self):
        self._make_ready()
        self.client.force_authenticate(user=self.manager)
        response = self.client.patch(self.url, {'is_public': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_waiter_and_kitchen_cannot_publish(self):
        self._make_ready()
        for user in (self.waiter, self.kitchen):
            self.restaurant.is_public = False
            self.restaurant.save(update_fields=['is_public'])
            self.client.force_authenticate(user=user)
            response = self.client.patch(self.url, {'is_public': True}, format='json')
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
            self.restaurant.refresh_from_db()
            self.assertFalse(self.restaurant.is_public)


class RestaurantDiagnosticsTests(APITestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from apps.users.models import User
        from apps.tables.models import Table
        from apps.menu.models import MenuItem
        self.client = APIClient()
        self.restaurant = Restaurant.objects.create(name='Diag Cafe', slug='diag-cafe', is_public=True)
        self.other = Restaurant.objects.create(name='Other Cafe', slug='other-cafe')
        self.admin = User.objects.create_user(email='diag-admin@test.local', password='x', name='Admin', role='admin', restaurant=self.restaurant)
        self.manager = User.objects.create_user(email='diag-manager@test.local', password='x', name='Manager', role='manager', restaurant=self.restaurant)
        self.waiter = User.objects.create_user(email='diag-waiter@test.local', password='x', name='Waiter', role='waiter', restaurant=self.restaurant)
        Table.objects.create(restaurant=self.restaurant, number=1)
        MenuItem.objects.create(restaurant=self.restaurant, name='Soup', price=1000, is_available=True, is_visible=True)

    def _url(self, restaurant=None):
        return f'/api/v1/restaurants/{(restaurant or self.restaurant).id}/diagnostics/'

    def test_admin_gets_tenant_safe_snapshot(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['restaurant']['name'], 'Diag Cafe')
        self.assertEqual(response.data['counts']['tables'], 1)
        rendered = str(response.data).lower()
        for secret in ('api_key', 'password', 'redis://', 'database_url', 'customer_phone'):
            self.assertNotIn(secret, rendered)

    def test_manager_allowed(self):
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.get(self._url()).status_code, 200)

    def test_waiter_denied(self):
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get(self._url()).status_code, 403)

    def test_cross_tenant_denied(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(self._url(self.other)).status_code, 403)
