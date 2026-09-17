from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.restaurants.models import Restaurant
from apps.tables.models import Table
from apps.users.models import User
from apps.zones.models import Zone


class ZoneEndpointTests(APITestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(
            name='Test Cafe',
            slug='test-cafe',
            is_public=True,
        )
        self.other_restaurant = Restaurant.objects.create(
            name='Other Cafe',
            slug='other-cafe',
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
        self.waiter_user = User.objects.create_user(
            email='waiter@example.com',
            password='password123',
            name='Waiter',
            role='waiter',
            restaurant=self.restaurant,
            is_active=True,
        )
        self.other_admin = User.objects.create_user(
            email='otheradmin@example.com',
            password='password123',
            name='Other Admin',
            role='admin',
            restaurant=self.other_restaurant,
            is_active=True,
        )

        self.zone = Zone.objects.create(
            restaurant=self.restaurant, name='Терраса', color='#FF6B1A', sort_order=1,
        )
        self.table1 = Table.objects.create(restaurant=self.restaurant, number=1, zone=self.zone)
        self.table2 = Table.objects.create(restaurant=self.restaurant, number=2)

    # ── чтение ──────────────────────────────────────────────────────────────

    def test_anonymous_cannot_list_zones(self):
        response = self.client.get(reverse('zone-list-create', kwargs={'rest_id': self.restaurant.id}))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_waiter_can_list_zones(self):
        self.client.force_authenticate(user=self.waiter_user)
        response = self.client.get(reverse('zone-list-create', kwargs={'rest_id': self.restaurant.id}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Пагинация в проекте отключена глобально — list-вью отдают plain array
        self.assertEqual(len(response.data), 1)

    def test_staff_of_other_restaurant_cannot_read(self):
        self.client.force_authenticate(user=self.other_admin)
        response = self.client.get(reverse('zone-list-create', kwargs={'rest_id': self.restaurant.id}))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_other_restaurant_cannot_access_zone_detail(self):
        self.client.force_authenticate(user=self.other_admin)
        response = self.client.get(reverse('zone-detail', kwargs={
            'rest_id': self.other_restaurant.id, 'zone_id': self.zone.id,
        }))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── запись (только админ) ───────────────────────────────────────────────

    def test_waiter_cannot_create_zone(self):
        self.client.force_authenticate(user=self.waiter_user)
        response = self.client.post(reverse('zone-list-create', kwargs={'rest_id': self.restaurant.id}), {
            'name': 'Летняя терраса',
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_zone(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(reverse('zone-list-create', kwargs={'rest_id': self.restaurant.id}), {
            'name': 'Летняя терраса', 'color': '#4CAF50', 'sort_order': 2,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Zone.objects.count(), 2)

    def test_admin_cannot_create_duplicate_zone_name(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(reverse('zone-list-create', kwargs={'rest_id': self.restaurant.id}), {
            'name': 'терраса',  # регистронезависимое совпадение с self.zone.name
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Zone.objects.count(), 1)

    def test_admin_can_rename_zone(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.patch(reverse('zone-detail', kwargs={
            'rest_id': self.restaurant.id, 'zone_id': self.zone.id,
        }), {'name': 'Терраса (обновлено)'})
        self.zone.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.zone.name, 'Терраса (обновлено)')

    def test_admin_can_delete_zone_and_tables_become_unzoned(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.delete(reverse('zone-detail', kwargs={
            'rest_id': self.restaurant.id, 'zone_id': self.zone.id,
        }))
        self.table1.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNone(self.table1.zone)

    # ── bulk move ────────────────────────────────────────────────────────────

    def test_admin_can_bulk_move_tables_to_zone(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(reverse('zone-tables-bulk-move', kwargs={
            'rest_id': self.restaurant.id, 'zone_id': self.zone.id,
        }), {'table_ids': [str(self.table2.id)]}, format='json')
        self.table2.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.table2.zone_id, self.zone.id)

    def test_waiter_cannot_bulk_move_tables(self):
        self.client.force_authenticate(user=self.waiter_user)
        response = self.client.post(reverse('zone-tables-bulk-move', kwargs={
            'rest_id': self.restaurant.id, 'zone_id': self.zone.id,
        }), {'table_ids': [str(self.table2.id)]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ── effective_table_ids (гибрид зон + отдельных столов) ─────────────────

    def test_effective_table_ids_union(self):
        table3 = Table.objects.create(restaurant=self.restaurant, number=3)
        self.waiter_user.assigned_zones.set([self.zone])   # покрывает table1
        self.waiter_user.assigned_tables.set([table3])      # + отдельный стол
        self.assertEqual(self.waiter_user.effective_table_ids, {self.table1.id, table3.id})

    def test_effective_table_ids_empty_when_unassigned(self):
        self.assertEqual(self.waiter_user.effective_table_ids, set())

    # ── assignment endpoint (зеркало AssignTablesView, гибридный) ───────────

    def test_admin_can_set_assignment(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(reverse('staff-assignment', kwargs={
            'rest_id': self.restaurant.id, 'user_id': self.waiter_user.id,
        }), {
            'zone_ids': [str(self.zone.id)],
            'table_ids': [str(self.table2.id)],
        }, format='json')
        self.waiter_user.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(self.waiter_user.assigned_zones.values_list('id', flat=True)), {self.zone.id})
        self.assertEqual(set(self.waiter_user.assigned_tables.values_list('id', flat=True)), {self.table2.id})

    def test_waiter_cannot_set_assignment(self):
        self.client.force_authenticate(user=self.waiter_user)
        response = self.client.post(reverse('staff-assignment', kwargs={
            'rest_id': self.restaurant.id, 'user_id': self.waiter_user.id,
        }), {'zone_ids': [], 'table_ids': []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
