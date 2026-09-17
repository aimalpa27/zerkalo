from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.restaurants.models import Restaurant
from apps.users.models import User
from apps.users.serializers import CreateUserSerializer


class AuthEndpointTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com',
            password='oldpassword123',
            name='Test User',
            role='admin',
            is_active=True,
        )

    def test_login_success(self):
        response = self.client.post(reverse('auth-login'), {
            'email': 'test@example.com',
            'password': 'oldpassword123',
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_wrong_password(self):
        response = self.client.post(reverse('auth-login'), {
            'email': 'test@example.com',
            'password': 'wrongpassword',
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token(self):
        login_response = self.client.post(reverse('auth-login'), {
            'email': 'test@example.com',
            'password': 'oldpassword123',
        })

        response = self.client.post(reverse('auth-refresh'), {
            'refresh': login_response.data['refresh'],
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_get_me(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse('auth-me'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'test@example.com')

    def test_patch_me_only_name(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(reverse('auth-me'), {
            'name': 'Updated Name',
            'role': 'waiter',
        })

        self.user.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.user.name, 'Updated Name')
        self.assertEqual(self.user.role, 'admin')

    def test_change_password(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.patch(reverse('auth-change-password'), {
            'old_password': 'oldpassword123',
            'new_password': 'newpassword123',
            'new_password_confirm': 'newpassword123',
        })

        self.user.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(self.user.check_password('newpassword123'))


class MeSelfServiceHardeningTests(APITestCase):
    """PATCH /api/v1/auth/me/ — самообслуживание. Пользователь может менять
    только своё имя; роль, привилегии (is_staff/is_superuser) и email через
    этот эндпоинт менять нельзя (см. MeUpdateSerializer)."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email='self@example.com',
            password='selfpass123',
            name='Self User',
            role='waiter',
            is_active=True,
        )
        self.client.force_authenticate(user=self.user)

    def test_patch_me_cannot_escalate_role_or_privileges(self):
        response = self.client.patch(reverse('auth-me'), {
            'name': 'Renamed',
            'role': 'superadmin',
            'is_staff': True,
            'is_superuser': True,
            'email': 'hacked@example.com',
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, 'Renamed')
        self.assertEqual(self.user.role, 'waiter')
        self.assertFalse(self.user.is_staff)
        self.assertFalse(self.user.is_superuser)
        self.assertEqual(self.user.email, 'self@example.com')


class StaffRoleEscalationTests(APITestCase):
    """
    Регресс на эскалацию привилегий через staff-эндпоинты
    (POST /api/v1/restaurants/<id>/staff/, PATCH .../staff/<uid>/).

    Роль `superadmin` (тех-поддержка Plait) даёт доступ ко ВСЕМ ресторанам
    (см. apps.users.permissions.IsRestaurantAdmin / IsRestaurantStaff), поэтому
    admin/manager ресторана не должен уметь ни создать такого пользователя,
    ни повысить кого-либо (в т.ч. себя) до этой роли. Также через staff-API
    нельзя выставить is_staff / is_superuser.
    """

    def setUp(self):
        cache.clear()
        self.restaurant = Restaurant.objects.create(
            name='Escalation Test Cafe',
            slug='escalation-test-cafe',
        )
        self.admin = User.objects.create_user(
            email='cafe-admin@example.com',
            password='cafeadminpass123',
            name='Cafe Admin',
            role='admin',
            restaurant=self.restaurant,
            is_active=True,
        )
        self.manager = User.objects.create_user(
            email='cafe-manager@example.com',
            password='cafemanagerpass123',
            name='Cafe Manager',
            role='manager',
            restaurant=self.restaurant,
            is_active=True,
        )
        # Супер-админ провижинится только через manage.py create_superadmin;
        # здесь эмулируем его для проверки позитивных сценариев.
        self.superadmin = User.objects.create_user(
            email='plait-tech@example.com',
            password='plaittechpass123',
            name='Plait Tech',
            role='superadmin',
            is_staff=True,
            is_active=True,
        )

    def _staff_list_url(self):
        return reverse('staff-list-create', kwargs={'rest_id': self.restaurant.id})

    def _staff_detail_url(self, user_id):
        return reverse(
            'staff-detail',
            kwargs={'rest_id': self.restaurant.id, 'user_id': user_id},
        )

    # ── создание (POST) ──────────────────────────────────────────────────────

    def test_restaurant_admin_cannot_create_superadmin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._staff_list_url(), {
            'email': 'sneaky-super@example.com',
            'name': 'Sneaky Super',
            'role': 'superadmin',
            'password': 'sneakypass123',
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email='sneaky-super@example.com').exists())

    def test_manager_cannot_create_superadmin(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(self._staff_list_url(), {
            'email': 'sneaky-super2@example.com',
            'name': 'Sneaky Super 2',
            'role': 'superadmin',
            'password': 'sneakypass123',
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email='sneaky-super2@example.com').exists())

    def test_restaurant_admin_cannot_create_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._staff_list_url(), {
            'email': 'new-admin@example.com',
            'name': 'New Admin',
            'role': 'admin',
            'password': 'newadminpass123',
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email='new-admin@example.com').exists())

    def test_superadmin_cannot_create_superadmin_via_api(self):
        # Даже тех-команда Plait не создаёт супер-админов через API — только CLI.
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.post(self._staff_list_url(), {
            'email': 'another-super@example.com',
            'name': 'Another Super',
            'role': 'superadmin',
            'password': 'anothersuperpass123',
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email='another-super@example.com').exists())

    def test_superadmin_can_create_admin(self):
        # Позитивный контроль: тех-команда Plait создаёт admin ресторана.
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.post(self._staff_list_url(), {
            'email': 'legit-admin@example.com',
            'name': 'Legit Admin',
            'role': 'admin',
            'password': 'legitadminpass123',
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.get(email='legit-admin@example.com').role, 'admin')

    def test_admin_can_create_normal_staff(self):
        # Позитивный контроль: обычного сотрудника admin создаёт штатно.
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._staff_list_url(), {
            'email': 'new-waiter@example.com',
            'name': 'New Waiter',
            'role': 'waiter',
            'password': 'newwaiterpass123',
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(email='new-waiter@example.com')
        self.assertEqual(created.role, 'waiter')
        self.assertEqual(created.restaurant_id, self.restaurant.id)

    def test_cannot_set_is_staff_is_superuser_via_create(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._staff_list_url(), {
            'email': 'privesc@example.com',
            'name': 'Priv Esc',
            'role': 'waiter',
            'password': 'privescpass123',
            'is_staff': True,
            'is_superuser': True,
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(email='privesc@example.com')
        self.assertFalse(created.is_staff)
        self.assertFalse(created.is_superuser)

    # ── повышение (PATCH) ────────────────────────────────────────────────────

    def test_restaurant_admin_cannot_promote_to_superadmin(self):
        target = User.objects.create_user(
            email='target-waiter@example.com',
            password='targetpass123',
            name='Target Waiter',
            role='waiter',
            restaurant=self.restaurant,
            is_active=True,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(self._staff_detail_url(target.id), {'role': 'superadmin'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        target.refresh_from_db()
        self.assertEqual(target.role, 'waiter')

    def test_admin_cannot_promote_self_to_superadmin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(self._staff_detail_url(self.admin.id), {'role': 'superadmin'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.role, 'admin')

    def test_manager_cannot_promote_self_to_superadmin(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.patch(self._staff_detail_url(self.manager.id), {'role': 'superadmin'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.manager.refresh_from_db()
        self.assertEqual(self.manager.role, 'manager')

    def test_cannot_set_is_staff_is_superuser_via_patch(self):
        target = User.objects.create_user(
            email='patch-target@example.com',
            password='patchtargetpass123',
            name='Patch Target',
            role='waiter',
            restaurant=self.restaurant,
            is_active=True,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(self._staff_detail_url(target.id), {
            'is_staff': True,
            'is_superuser': True,
            'name': 'Patched Name',
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertFalse(target.is_staff)
        self.assertFalse(target.is_superuser)
        self.assertEqual(target.name, 'Patched Name')

    def test_admin_can_change_normal_role_via_patch(self):
        # Позитивный контроль: смена роли в пределах штата (waiter → cashier).
        target = User.objects.create_user(
            email='promote-waiter@example.com',
            password='promotepass123',
            name='Promote Waiter',
            role='waiter',
            restaurant=self.restaurant,
            is_active=True,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(self._staff_detail_url(target.id), {'role': 'cashier'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertEqual(target.role, 'cashier')


class CreateUserSerializerRoleTests(APITestCase):
    """Defence in depth: CreateUserSerializer сам блокирует опасные роли даже
    без request-контекста (вызов напрямую из management-команд / тестов)."""

    def test_serializer_blocks_superadmin_without_request(self):
        serializer = CreateUserSerializer(data={
            'email': 'x@example.com',
            'name': 'X User',
            'role': 'superadmin',
            'password': 'somepass123',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('role', serializer.errors)

    def test_serializer_blocks_admin_without_superadmin_request(self):
        serializer = CreateUserSerializer(data={
            'email': 'y@example.com',
            'name': 'Y User',
            'role': 'admin',
            'password': 'somepass123',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('role', serializer.errors)

    def test_serializer_allows_normal_role_without_request(self):
        serializer = CreateUserSerializer(data={
            'email': 'z@example.com',
            'name': 'Z User',
            'role': 'waiter',
            'password': 'somepass123',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
class KitchenRoleIsolationTests(APITestCase):
    """Kitchen account is assignable but excluded from unrelated generic staff APIs."""

    def setUp(self):
        self.restaurant = Restaurant.objects.create(name='Kitchen Role', slug='kitchen-role')
        self.admin = User.objects.create_user(
            email='kitchen-admin@example.com', password='adminpass123', name='Admin',
            role='admin', restaurant=self.restaurant,
        )

    def test_admin_can_create_kitchen_account(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f'/api/v1/restaurants/{self.restaurant.id}/staff/',
            {'email': 'kitchen@example.com', 'name': 'Kitchen', 'role': 'kitchen', 'password': 'KitchenPass123!'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['role'], 'kitchen')

    def test_kitchen_is_not_generic_restaurant_staff(self):
        kitchen = User.objects.create_user(
            email='kitchen-only@example.com', password='KitchenPass123!', name='Kitchen',
            role='kitchen', restaurant=self.restaurant,
        )
        self.client.force_authenticate(user=kitchen)
        response = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/tables/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
