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
