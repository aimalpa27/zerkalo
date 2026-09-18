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


class TableBulkCreateTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant('tables-bulk')
        self.admin = make_user(self.restaurant, role='admin')
        self.manager = make_user(self.restaurant, role='manager')
        self.url = f'/api/v1/restaurants/{self.restaurant.id}/tables/bulk/'

    def test_admin_creates_contiguous_range(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {'start': 1, 'end': 10}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 10)
        self.assertEqual(list(Table.objects.values_list('number', flat=True).order_by('number')), list(range(1, 11)))
        self.assertTrue(all(row.get('token') and row.get('qr_url') for row in response.data))

    def test_manager_can_bulk_create(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(self.url, {'start': 20, 'end': 22}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_duplicate_aborts_entire_batch(self):
        Table.objects.create(restaurant=self.restaurant, number=5)
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {'start': 1, 'end': 10}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('5', [str(v) for v in response.data['numbers']])
        self.assertEqual(Table.objects.filter(restaurant=self.restaurant).count(), 1)
        self.assertFalse(Table.objects.filter(restaurant=self.restaurant, number=1).exists())

    def test_invalid_or_oversized_range_rejected(self):
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.post(self.url, {'start': 10, 'end': 1}, format='json').status_code, 400)
        self.assertEqual(self.client.post(self.url, {'start': 1, 'end': 201}, format='json').status_code, 400)
        self.assertEqual(Table.objects.count(), 0)

    def test_waiter_and_kitchen_cannot_bulk_create(self):
        for role in ('waiter', 'kitchen'):
            self.client.force_authenticate(user=make_user(self.restaurant, role=role))
            self.assertEqual(self.client.post(self.url, {'start': 1, 'end': 2}, format='json').status_code, 403)

    def test_other_restaurant_admin_cannot_bulk_create(self):
        other = make_restaurant('tables-bulk-other')
        self.client.force_authenticate(user=make_user(other, role='admin'))
        self.assertEqual(self.client.post(self.url, {'start': 1, 'end': 2}, format='json').status_code, 403)

    def test_tariff_limit_aborts_entire_batch(self):
        from apps.billing.models import SubscriptionPlan
        plan = SubscriptionPlan.objects.create(code='starter-bulk-test', name='Starter bulk test', price=0, max_tables=3)
        self.restaurant.subscription_plan = plan
        self.restaurant.save(update_fields=['subscription_plan'])
        Table.objects.create(restaurant=self.restaurant, number=9)
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {'start': 1, 'end': 3}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Table.objects.filter(restaurant=self.restaurant).count(), 1)
        self.assertFalse(Table.objects.filter(restaurant=self.restaurant, number=1).exists())

    def test_zone_from_other_restaurant_rejected(self):
        from apps.zones.models import Zone
        other = make_restaurant('tables-bulk-zone-other')
        zone = Zone.objects.create(restaurant=other, name='Other')
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {'start': 1, 'end': 2, 'zone': str(zone.id)}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Table.objects.count(), 0)

class GuestUpsellRulesTest(APITestCase):
    def setUp(self):
        from apps.menu.models import MenuItem, UpsellRule
        self.restaurant = Restaurant.objects.create(name='Rule Cafe', slug='rule-cafe', is_public=True)
        self.table = Table.objects.create(restaurant=self.restaurant, number=1, is_active=True)
        self.trigger = MenuItem.objects.create(restaurant=self.restaurant, name='Burger', price=2500, is_available=True, is_visible=True)
        self.target = MenuItem.objects.create(restaurant=self.restaurant, name='Cola', price=700, is_available=True, is_visible=True)
        self.rule = UpsellRule.objects.create(restaurant=self.restaurant, trigger_item=self.trigger, recommended_item=self.target, priority=5)

    def test_guest_gets_only_active_sellable_rules(self):
        response = self.client.get(f'/api/v1/guest/{self.table.token}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['upsell_rules']), 1)
        self.assertEqual(response.data['upsell_rules'][0]['recommended_item_id'], str(self.target.id))
        self.target.is_available = False
        self.target.save(update_fields=['is_available'])
        response = self.client.get(f'/api/v1/guest/{self.table.token}/')
        self.assertEqual(response.data['upsell_rules'], [])

class GuestUpsellEventTests(APITestCase):
    def setUp(self):
        from apps.menu.models import MenuItem, UpsellRule
        self.restaurant = Restaurant.objects.create(name='Event Cafe', slug='event-cafe', is_public=True)
        self.table = Table.objects.create(restaurant=self.restaurant, number=1, is_active=True)
        trigger = MenuItem.objects.create(restaurant=self.restaurant, name='Burger', price=2500, is_available=True, is_visible=True)
        target = MenuItem.objects.create(restaurant=self.restaurant, name='Cola', price=700, is_available=True, is_visible=True)
        self.rule = UpsellRule.objects.create(restaurant=self.restaurant, trigger_item=trigger, recommended_item=target)

    def test_guest_tracks_impression_and_add_without_auth(self):
        from apps.analytics.models import UpsellEvent
        url = f'/api/v1/guest/{self.table.token}/upsell-events/'
        self.assertEqual(self.client.post(url, {'rule_id': str(self.rule.id), 'event_type': 'impression'}, format='json').status_code, 204)
        self.assertEqual(self.client.post(url, {'rule_id': str(self.rule.id), 'event_type': 'add'}, format='json').status_code, 204)
        self.assertEqual(UpsellEvent.objects.filter(restaurant=self.restaurant).count(), 2)

    def test_foreign_rule_cannot_be_tracked(self):
        from apps.menu.models import MenuItem, UpsellRule
        other = Restaurant.objects.create(name='Other Event', slug='other-event')
        a = MenuItem.objects.create(restaurant=other, name='A', price=1)
        b = MenuItem.objects.create(restaurant=other, name='B', price=2)
        foreign = UpsellRule.objects.create(restaurant=other, trigger_item=a, recommended_item=b)
        response = self.client.post(f'/api/v1/guest/{self.table.token}/upsell-events/', {'rule_id': str(foreign.id), 'event_type': 'impression'}, format='json')
        self.assertEqual(response.status_code, 404)
