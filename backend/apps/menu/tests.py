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
