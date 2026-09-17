from rest_framework import status
from rest_framework.test import APITestCase

from apps.restaurants.models import Restaurant
from apps.tables.models import Table
from apps.users.models import User


def make_restaurant(slug):
    return Restaurant.objects.create(name='R', slug=slug)


def make_user(restaurant, role='admin'):
    return User.objects.create_user(email=f'{role}@{restaurant.slug}.com', password='pass1234', name=role.capitalize(), role=role, restaurant=restaurant)


class TableListCreateTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant('tables-create'); self.admin = make_user(self.restaurant, 'admin')
        self.other_restaurant = make_restaurant('tables-other'); self.other_admin = make_user(self.other_restaurant, 'admin')
    def _url(self): return f'/api/v1/restaurants/{self.restaurant.id}/tables/'
    def test_anonymous_blocked(self): self.assertEqual(self.client.get(self._url()).status_code, 401)
    def test_other_restaurant_admin_blocked(self): self.client.force_authenticate(user=self.other_admin); self.assertEqual(self.client.post(self._url(), {'number':1}).status_code,403)
    def test_admin_creates_table(self): self.client.force_authenticate(user=self.admin); r=self.client.post(self._url(),{'number':1}); self.assertEqual(r.status_code,201); self.assertEqual(Table.objects.count(),1)
    def test_created_table_belongs_to_restaurant(self): self.client.force_authenticate(user=self.admin); self.client.post(self._url(),{'number':1}); self.assertEqual(Table.objects.first().restaurant,self.restaurant)
    def test_token_and_qr_url_in_response(self): self.client.force_authenticate(user=self.admin); r=self.client.post(self._url(),{'number':1}); self.assertIn('token',r.data); self.assertIn('token=',r.data['qr_url'])
    def test_admin_lists_tables(self): Table.objects.create(restaurant=self.restaurant,number=1); self.client.force_authenticate(user=self.admin); self.assertEqual(len(self.client.get(self._url()).data),1)
    def test_duplicate_number_rejected(self): self.client.force_authenticate(user=self.admin); self.client.post(self._url(),{'number':5}); self.assertEqual(self.client.post(self._url(),{'number':5}).status_code,400)
    def test_waiter_cannot_create_table(self): self.client.force_authenticate(user=make_user(self.restaurant,'waiter')); self.assertEqual(self.client.post(self._url(),{'number':1}).status_code,403)


class TableBulkCreateTest(APITestCase):
    def setUp(self):
        self.restaurant=make_restaurant('bulk-tables'); self.admin=make_user(self.restaurant,'admin')
        self.other=make_restaurant('bulk-other'); self.other_admin=make_user(self.other,'admin')
    def _url(self): return f'/api/v1/restaurants/{self.restaurant.id}/tables/bulk/'
    def test_admin_creates_range_atomically(self):
        self.client.force_authenticate(user=self.admin); r=self.client.post(self._url(),{'start':1,'end':10},format='json')
        self.assertEqual(r.status_code,201); self.assertEqual(r.data['count'],10); self.assertEqual(list(Table.objects.filter(restaurant=self.restaurant).values_list('number',flat=True)),list(range(1,11)))
        self.assertTrue(all(x.get('token') and x.get('qr_url') for x in r.data['created']))
    def test_duplicate_aborts_entire_batch(self):
        Table.objects.create(restaurant=self.restaurant,number=5); self.client.force_authenticate(user=self.admin)
        r=self.client.post(self._url(),{'start':1,'end':10},format='json')
        self.assertEqual(r.status_code,400)
        self.assertEqual(Table.objects.filter(restaurant=self.restaurant).count(),1)
        self.assertIn('5', [str(value) for value in r.data['duplicates']])
    def test_invalid_range_rejected(self):
        self.client.force_authenticate(user=self.admin); self.assertEqual(self.client.post(self._url(),{'start':10,'end':1},format='json').status_code,400)
        self.assertEqual(self.client.post(self._url(),{'start':1,'end':201},format='json').status_code,400)
    def test_waiter_and_kitchen_cannot_bulk_create(self):
        for role in ('waiter','kitchen'):
            self.client.force_authenticate(user=make_user(self.restaurant,role)); self.assertEqual(self.client.post(self._url(),{'start':1,'end':2},format='json').status_code,403)
    def test_cross_tenant_admin_blocked(self):
        self.client.force_authenticate(user=self.other_admin); self.assertEqual(self.client.post(self._url(),{'start':1,'end':2},format='json').status_code,403)


class TableDeleteTest(APITestCase):
    def setUp(self): self.restaurant=make_restaurant('tables-delete'); self.admin=make_user(self.restaurant); self.table=Table.objects.create(restaurant=self.restaurant,number=1)
    def _url(self): return f'/api/v1/restaurants/{self.restaurant.id}/tables/{self.table.id}/'
    def test_admin_deletes_table(self): self.client.force_authenticate(user=self.admin); self.assertEqual(self.client.delete(self._url()).status_code,204)
    def test_anonymous_blocked(self): self.assertEqual(self.client.delete(self._url()).status_code,401)
    def test_cannot_delete_other_restaurant_table(self):
        other=make_restaurant('tables-delete-other'); self.client.force_authenticate(user=make_user(other)); self.assertEqual(self.client.delete(self._url()).status_code,403)


class GuestTableQrFlowTest(APITestCase):
    def setUp(self): self.restaurant=make_restaurant('guest-qr-flow'); self.admin=make_user(self.restaurant); self.table=Table.objects.create(restaurant=self.restaurant,number=7)
    def _guest_url(self,token=None): return f'/api/v1/guest/{token or self.table.token}/'
    def test_active_table_token_resolves_public_guest_context(self):
        r=self.client.get(self._guest_url()); self.assertEqual(r.status_code,200); self.assertEqual(r.data['table']['number'],7); self.assertIn('menu_items',r.data)
    def test_inactive_table_token_is_rejected(self): self.table.is_active=False; self.table.save(update_fields=['is_active']); self.assertEqual(self.client.get(self._guest_url()).status_code,404)
    def test_regenerate_token_invalidates_old_qr_and_new_token_works(self):
        old=self.table.token; self.client.force_authenticate(user=self.admin); r=self.client.post(f'/api/v1/restaurants/{self.restaurant.id}/tables/{self.table.id}/regenerate-token/'); self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self._guest_url(old)).status_code,404); self.assertEqual(self.client.get(self._guest_url(r.data['token'])).status_code,200)
    def test_generated_qr_url_contains_restaurant_slug_and_table_token(self): self.assertIn(f'slug={self.restaurant.slug}',self.table.qr_url); self.assertIn(f'token={self.table.token}',self.table.qr_url)
