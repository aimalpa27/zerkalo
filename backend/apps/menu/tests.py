from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.menu.models import Category, MenuItem
from apps.restaurants.models import Restaurant
from apps.users.models import User


class MenuEndpointTests(APITestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(
            name='Test Cafe',
            slug='test-cafe',
            is_public=True,
        )

        self.admin_user = User.objects.create_user(
            email='admin@example.com',
            password='password123',
            name='Admin',
            role='admin',
            restaurant=self.restaurant,
            is_active=True,
        )

        self.category = Category.objects.create(
            restaurant=self.restaurant,
            name='Burgers',
            sort_order=1,
        )

        self.menu_item = MenuItem.objects.create(
            restaurant=self.restaurant,
            category=self.category,
            name='Cheeseburger',
            price=2500,
            is_available=True,
            is_visible=True,
        )

    def test_get_categories(self):
        response = self.client.get(reverse('category-list', kwargs={
            'rest_id': self.restaurant.id,
        }))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_get_menu_items(self):
        response = self.client.get(reverse('menu-list', kwargs={
            'rest_id': self.restaurant.id,
        }))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_anonymous_cannot_create_category(self):
        response = self.client.post(reverse('category-list', kwargs={
            'rest_id': self.restaurant.id,
        }), {
            'name': 'Drinks',
            'sort_order': 2,
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_create_category(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(reverse('category-list', kwargs={
            'rest_id': self.restaurant.id,
        }), {
            'name': 'Drinks',
            'sort_order': 2,
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Category.objects.count(), 2)

    def test_admin_can_update_category(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(reverse('category-detail', kwargs={
            'rest_id': self.restaurant.id,
            'category_id': self.category.id,
        }), {
            'name': 'Updated Burgers',
        })

        self.category.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.category.name, 'Updated Burgers')

    def test_admin_can_delete_category(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(reverse('category-detail', kwargs={
            'rest_id': self.restaurant.id,
            'category_id': self.category.id,
        }))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Category.objects.count(), 0)

    def test_anonymous_cannot_create_menu_item(self):
        response = self.client.post(reverse('menu-list', kwargs={
            'rest_id': self.restaurant.id,
        }), {
            'name': 'Pizza',
            'price': 3000,
            'category_id': str(self.category.id),
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_create_menu_item(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(reverse('menu-list', kwargs={
            'rest_id': self.restaurant.id,
        }), {
            'name': 'Pizza',
            'price': 3000,
            'category_id': str(self.category.id),
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MenuItem.objects.count(), 2)

    def test_admin_can_update_menu_item(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.patch(reverse('menu-item-detail', kwargs={
            'rest_id': self.restaurant.id,
            'item_id': self.menu_item.id,
        }), {
            'name': 'Updated Cheeseburger',
        })

        self.menu_item.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.menu_item.name, 'Updated Cheeseburger')

    def test_admin_can_delete_menu_item(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(reverse('menu-item-detail', kwargs={
            'rest_id': self.restaurant.id,
            'item_id': self.menu_item.id,
        }))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(MenuItem.objects.count(), 0)

class MenuTenantIsolationTests(APITestCase):
    """P0 regression: writable relations must never cross restaurant boundary."""

    def setUp(self):
        self.restaurant_a = Restaurant.objects.create(name='Cafe A', slug='cafe-a-tenant')
        self.restaurant_b = Restaurant.objects.create(name='Cafe B', slug='cafe-b-tenant')
        self.admin_a = User.objects.create_user(
            email='admin-a-tenant@example.com', password='password123',
            name='Admin A', role='admin', restaurant=self.restaurant_a, is_active=True,
        )
        self.category_a = Category.objects.create(restaurant=self.restaurant_a, name='A category')
        self.category_b = Category.objects.create(restaurant=self.restaurant_b, name='B category')
        self.item_a = MenuItem.objects.create(
            restaurant=self.restaurant_a, category=self.category_a,
            name='A item', price=1000,
        )
        self.client.force_authenticate(user=self.admin_a)

    def test_admin_cannot_create_item_with_foreign_restaurant_category(self):
        response = self.client.post(reverse('menu-list', kwargs={
            'rest_id': self.restaurant_a.id,
        }), {
            'name': 'Cross tenant item',
            'price': 2500,
            'category_id': str(self.category_b.id),
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('category_id', response.data)
        self.assertFalse(MenuItem.objects.filter(name='Cross tenant item').exists())

    def test_admin_cannot_move_item_to_foreign_restaurant_category(self):
        response = self.client.patch(reverse('menu-item-detail', kwargs={
            'rest_id': self.restaurant_a.id,
            'item_id': self.item_a.id,
        }), {
            'category_id': str(self.category_b.id),
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.item_a.refresh_from_db()
        self.assertEqual(self.item_a.category_id, self.category_a.id)

    def test_admin_cannot_access_foreign_restaurant_menu_admin_endpoint(self):
        response = self.client.post(reverse('menu-list', kwargs={
            'rest_id': self.restaurant_b.id,
        }), {
            'name': 'Unauthorized item',
            'price': 3000,
            'category_id': str(self.category_b.id),
        })

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(MenuItem.objects.filter(name='Unauthorized item').exists())

    def test_valid_same_restaurant_category_still_works(self):
        response = self.client.post(reverse('menu-list', kwargs={
            'rest_id': self.restaurant_a.id,
        }), {
            'name': 'Safe item',
            'price': 1800,
            'category_id': str(self.category_a.id),
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = MenuItem.objects.get(name='Safe item')
        self.assertEqual(created.restaurant_id, self.restaurant_a.id)
        self.assertEqual(created.category_id, self.category_a.id)

class MenuImportTests(APITestCase):
    def setUp(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.Upload = SimpleUploadedFile
        self.restaurant = Restaurant.objects.create(name='Import Cafe', slug='import-cafe')
        self.admin = User.objects.create_user(email='import-admin@example.com', password='x', name='Admin', role='admin', restaurant=self.restaurant, is_active=True)
        self.manager = User.objects.create_user(email='import-manager@example.com', password='x', name='Manager', role='manager', restaurant=self.restaurant, is_active=True)
        self.waiter = User.objects.create_user(email='import-waiter@example.com', password='x', name='Waiter', role='waiter', restaurant=self.restaurant, is_active=True)
        self.other = Restaurant.objects.create(name='Other', slug='import-other')

    def csv(self, text):
        return self.Upload('menu.csv', text.encode('utf-8'), content_type='text/csv')

    def test_preview_does_not_write_and_commit_creates_categories_and_items(self):
        self.client.force_authenticate(self.admin)
        content = 'Название;Категория;Цена;Станция\nБургер;Горячее;2500;Кухня\nЛимонад;Напитки;1200;Бар\n'
        url = reverse('menu-import', kwargs={'rest_id': self.restaurant.id})
        preview = self.client.post(url, {'file': self.csv(content), 'dry_run': 'true'}, format='multipart')
        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        self.assertEqual(preview.data['will_create'], 2)
        self.assertEqual(MenuItem.objects.filter(restaurant=self.restaurant).count(), 0)
        committed = self.client.post(url, {'file': self.csv(content), 'dry_run': 'false'}, format='multipart')
        self.assertEqual(committed.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MenuItem.objects.filter(restaurant=self.restaurant).count(), 2)
        self.assertEqual(Category.objects.filter(restaurant=self.restaurant).count(), 2)
        self.assertEqual(MenuItem.objects.get(name='Лимонад').preparation_station, 'bar')

    def test_validation_error_is_atomic(self):
        self.client.force_authenticate(self.admin)
        content = 'Название;Цена\nНормальное;1000\nПлохое;не-цена\n'
        response = self.client.post(reverse('menu-import', kwargs={'rest_id': self.restaurant.id}), {'file': self.csv(content), 'dry_run': 'false'}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MenuItem.objects.filter(restaurant=self.restaurant).count(), 0)

    def test_existing_item_is_skipped_not_duplicated(self):
        MenuItem.objects.create(restaurant=self.restaurant, name='Бургер', price=1000)
        self.client.force_authenticate(self.manager)
        content = 'Name,Price\nБургер,2000\nСуп,900\n'
        response = self.client.post(reverse('menu-import', kwargs={'rest_id': self.restaurant.id}), {'file': self.csv(content), 'dry_run': 'false'}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['created'], 1)
        self.assertEqual(MenuItem.objects.filter(restaurant=self.restaurant, name='Бургер').count(), 1)

    def test_waiter_cannot_import(self):
        self.client.force_authenticate(self.waiter)
        response = self.client.post(reverse('menu-import', kwargs={'rest_id': self.restaurant.id}), {'file': self.csv('Name,Price\nSoup,100\n')}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cannot_import_into_foreign_restaurant(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('menu-import', kwargs={'rest_id': self.other.id}), {'file': self.csv('Name,Price\nSoup,100\n')}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

class UpsellRuleTests(APITestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(name='Upsell Cafe', slug='upsell-cafe', is_public=True)
        self.admin = User.objects.create_user(email='upsell-admin@example.com', password='password123', name='Admin', role='admin', restaurant=self.restaurant, is_active=True)
        self.waiter = User.objects.create_user(email='upsell-waiter@example.com', password='password123', name='Waiter', role='waiter', restaurant=self.restaurant, is_active=True)
        self.burger = MenuItem.objects.create(restaurant=self.restaurant, name='Burger', price=2500, is_available=True, is_visible=True)
        self.drink = MenuItem.objects.create(restaurant=self.restaurant, name='Cola', price=700, is_available=True, is_visible=True)

    def test_admin_crud_rule(self):
        self.client.force_authenticate(self.admin)
        url = reverse('upsell-rule-list', kwargs={'rest_id': self.restaurant.id})
        created = self.client.post(url, {'trigger_item': str(self.burger.id), 'recommended_item': str(self.drink.id), 'priority': 10}, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        detail = reverse('upsell-rule-detail', kwargs={'rest_id': self.restaurant.id, 'rule_id': created.data['id']})
        patched = self.client.patch(detail, {'is_active': False}, format='json')
        self.assertEqual(patched.status_code, status.HTTP_200_OK)
        self.assertFalse(patched.data['is_active'])
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_204_NO_CONTENT)

    def test_waiter_cannot_manage_rules(self):
        self.client.force_authenticate(self.waiter)
        response = self.client.get(reverse('upsell-rule-list', kwargs={'rest_id': self.restaurant.id}))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_tenant_items_rejected(self):
        other = Restaurant.objects.create(name='Other', slug='upsell-other')
        foreign = MenuItem.objects.create(restaurant=other, name='Foreign', price=100)
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('upsell-rule-list', kwargs={'rest_id': self.restaurant.id}), {'trigger_item': str(self.burger.id), 'recommended_item': str(foreign.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

class NetworkMenuTemplateTests(APITestCase):
    def setUp(self):
        from apps.restaurants.models import Restaurant, RestaurantNetwork
        from apps.users.models import User
        self.owner = Restaurant.objects.create(name='Owner', slug='owner-net')
        self.branch = Restaurant.objects.create(name='Branch', slug='branch-net')
        self.foreign = Restaurant.objects.create(name='Foreign', slug='foreign-net')
        self.network = RestaurantNetwork.objects.create(name='Group', owner_restaurant=self.owner)
        self.network.restaurants.add(self.owner, self.branch)
        self.admin = User.objects.create_user(email='owner-menu@test.kz', password='x', role='admin', restaurant=self.owner)
        self.branch_manager = User.objects.create_user(email='branch-menu@test.kz', password='x', role='manager', restaurant=self.branch)
        self.waiter = User.objects.create_user(email='waiter-menu@test.kz', password='x', role='waiter', restaurant=self.branch)

    def test_owner_crud_publish_and_branch_override(self):
        self.client.force_authenticate(self.admin)
        base = f'/api/v1/restaurants/networks/{self.network.id}/menu-template/'
        r = self.client.post(base, {'name':'Burger','category_name':'Food','price':'3000.00','preparation_station':'kitchen'}, format='json')
        self.assertEqual(r.status_code, 201); item_id = r.data['id']
        self.client.force_authenticate(self.branch_manager)
        over = f'/api/v1/restaurants/networks/{self.network.id}/branches/{self.branch.id}/menu-overrides/{item_id}/'
        self.assertEqual(self.client.put(over, {'price':'3500.00','is_available':False}, format='json').status_code, 200)
        self.client.force_authenticate(self.admin)
        pub = self.client.post(base + 'publish/', {}, format='json')
        self.assertEqual(pub.status_code, 200)
        self.assertEqual(str(MenuItem.objects.get(restaurant=self.owner, name='Burger').price), '3000.00')
        branch_item = MenuItem.objects.get(restaurant=self.branch, name='Burger')
        self.assertEqual(str(branch_item.price), '3500.00'); self.assertFalse(branch_item.is_available)
        self.assertEqual(self.client.post(base + 'publish/', {}, format='json').data['created'], 0)

    def test_manager_cannot_edit_canonical_and_waiter_cannot_override(self):
        self.client.force_authenticate(self.branch_manager)
        base = f'/api/v1/restaurants/networks/{self.network.id}/menu-template/'
        self.assertEqual(self.client.post(base, {'name':'X','price':'1'}, format='json').status_code, 403)
        self.client.force_authenticate(self.waiter)
        url = f'/api/v1/restaurants/networks/{self.network.id}/branches/{self.branch.id}/menu-overrides/'
        self.assertEqual(self.client.get(url).status_code, 403)

    def test_branch_cannot_override_foreign_restaurant(self):
        self.client.force_authenticate(self.branch_manager)
        url = f'/api/v1/restaurants/networks/{self.network.id}/branches/{self.foreign.id}/menu-overrides/'
        self.assertEqual(self.client.get(url).status_code, 403)
