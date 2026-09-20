from decimal import Decimal
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.menu.models import Category, MenuItem
from apps.restaurants.models import Restaurant
from apps.sessions.models import SessionItem, TableSession, SLAIncident
from apps.sessions.services import PlaceOrderService
from apps.tables.models import Table
from apps.users.models import User


def make_restaurant(slug='test-rest'):
    return Restaurant.objects.create(name='Test', slug=slug, service_charge_percent=10)


def make_table(restaurant, number=1):
    return Table.objects.create(restaurant=restaurant, number=number)


def make_item(restaurant, category, name='Плов', price='1500.00', available=True):
    return MenuItem.objects.create(
        restaurant=restaurant,
        category=category,
        name=name,
        price=Decimal(price),
        is_available=available,
    )


def make_staff(restaurant, role='waiter'):
    return User.objects.create_user(
        email=f'{role}_{restaurant.slug}@test.com',
        password='pass1234',
        name=role.capitalize(),
        role=role,
        restaurant=restaurant,
    )


class PlaceOrderServiceTest(TestCase):
    def setUp(self):
        self.restaurant = make_restaurant(slug='place-order')
        self.table = make_table(self.restaurant)
        self.category = Category.objects.create(restaurant=self.restaurant, name='Основные')
        self.item = make_item(self.restaurant, self.category)
        self.service = PlaceOrderService()

    def _order(self, token=None, qty=1, note=''):
        return self.service.execute(
            table_token=token or self.table.token,
            items=[{'menu_item_id': str(self.item.id), 'quantity': qty, 'note': note}],
            payment_method='cash',
        )

    def test_normal_order_creates_session_and_items(self):
        session = self._order(qty=2)
        self.assertEqual(session.items.count(), 1)
        item = session.items.first()
        self.assertEqual(item.quantity, 2)
        self.assertEqual(item.item_name, 'Плов')
        self.assertEqual(session.subtotal_amount, Decimal('3000.00'))

    def test_invalid_table_token_returns_404(self):
        from django.http import Http404
        with self.assertRaises(Http404):
            self._order(token='invalid-token-xyz')

    def test_unavailable_item_raises_validation_error(self):
        from rest_framework.exceptions import ValidationError
        self.item.is_available = False
        self.item.save()
        with self.assertRaises(ValidationError) as ctx:
            self._order()
        self.assertIn('стоп-лист', str(ctx.exception.detail))

    def test_repeat_order_reuses_open_session(self):
        session1 = self._order(qty=1)
        session2 = self._order(qty=1)
        self.assertEqual(session1.id, session2.id)
        self.assertEqual(session2.items.count(), 2)

    def test_new_order_blocked_after_payment_requested(self):
        from rest_framework.exceptions import ValidationError

        session = self._order(qty=1)
        session.status = 'payment_requested'
        session.save(update_fields=['status'])

        with self.assertRaises(ValidationError) as ctx:
            self._order(qty=1)

        self.assertIn('запрошена оплата', str(ctx.exception.detail))
        self.assertEqual(TableSession.objects.filter(table=self.table).count(), 1)

    def test_new_order_blocked_while_awaiting_payment(self):
        from rest_framework.exceptions import ValidationError

        session = self._order(qty=1)
        session.status = 'awaiting_payment'
        session.save(update_fields=['status'])

        with self.assertRaises(ValidationError):
            self._order(qty=1)

        self.assertEqual(TableSession.objects.filter(table=self.table).count(), 1)

    def test_note_saved_on_item(self):
        session = self._order(note='без лука')
        self.assertEqual(session.items.first().note, 'без лука')

    def test_inactive_table_returns_404(self):
        from django.http import Http404
        self.table.is_active = False
        self.table.save()
        with self.assertRaises(Http404):
            self._order()

    def test_guest_order_confirmed_when_confirmation_disabled(self):
        # order_confirmation_enabled=False по умолчанию — поведение как раньше
        session = self._order(qty=1)
        self.assertEqual(session.items.first().status, 'confirmed')

    def test_guest_order_awaiting_confirmation_when_enabled(self):
        self.restaurant.order_confirmation_enabled = True
        self.restaurant.save()
        session = self._order(qty=1)
        self.assertEqual(session.items.first().status, 'awaiting_confirmation')

    def test_waiter_order_always_confirmed(self):
        self.restaurant.order_confirmation_enabled = True
        self.restaurant.save()
        session = self.service.execute(
            table_token=self.table.token,
            items=[{'menu_item_id': str(self.item.id), 'quantity': 1, 'note': ''}],
            payment_method='cash',
            added_by='waiter',
        )
        self.assertEqual(session.items.first().status, 'confirmed')


class RecalculateTotalsTest(TestCase):
    def setUp(self):
        self.restaurant = make_restaurant(slug='calc-rest')
        self.table = make_table(self.restaurant)
        self.session = TableSession.objects.create(
            restaurant=self.restaurant,
            table=self.table,
            table_number=1,
            table_token=self.table.token,
            service_charge_percent=10,
        )

    def _add_item(self, price, qty, cancelled=False, status=None):
        item = SessionItem.objects.create(
            session=self.session,
            item_name='Item',
            price=Decimal(price),
            quantity=qty,
        )
        if cancelled:
            item.status = 'cancelled'
            item.save()
        elif status:
            item.status = status
            item.save()
        return item

    def test_correct_decimal_arithmetic(self):
        self._add_item('100.50', 2)
        self.session.recalculate_totals()
        self.session.refresh_from_db()
        self.assertEqual(self.session.subtotal_amount, Decimal('201.00'))
        self.assertEqual(self.session.service_charge_amount, Decimal('20.10'))
        self.assertEqual(self.session.total_amount, Decimal('221.10'))

    def test_cancelled_items_excluded(self):
        self._add_item('1000.00', 1)
        self._add_item('500.00', 1, cancelled=True)
        self.session.recalculate_totals()
        self.session.refresh_from_db()
        self.assertEqual(self.session.subtotal_amount, Decimal('1000.00'))

    def test_rejected_items_excluded(self):
        self._add_item('1000.00', 1)
        self._add_item('500.00', 1, status='rejected')
        self.session.recalculate_totals()
        self.session.refresh_from_db()
        self.assertEqual(self.session.subtotal_amount, Decimal('1000.00'))

    def test_awaiting_confirmation_items_excluded(self):
        # Паритет с фронтендом (isBillable): неподтверждённое не входит в счёт
        self._add_item('1000.00', 1)
        self._add_item('500.00', 1, status='awaiting_confirmation')
        self.session.recalculate_totals()
        self.session.refresh_from_db()
        self.assertEqual(self.session.subtotal_amount, Decimal('1000.00'))


class RequestPaymentFlowTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant(slug='req-pay')
        self.table = make_table(self.restaurant)
        self.session = TableSession.objects.create(
            restaurant=self.restaurant,
            table=self.table,
            table_number=1,
            table_token=self.table.token,
            status='open',
        )

    def test_transitions_to_awaiting_payment(self):
        url = f'/api/v1/sessions/by-table/{self.table.token}/request-payment/'
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, 'awaiting_payment')

    def test_returns_404_when_no_open_session(self):
        self.session.status = 'closed'
        self.session.save()
        url = f'/api/v1/sessions/by-table/{self.table.token}/request-payment/'
        self.assertEqual(self.client.post(url).status_code, status.HTTP_404_NOT_FOUND)


class CloseSessionTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant(slug='close-rest')
        self.table = make_table(self.restaurant)
        self.session = TableSession.objects.create(
            restaurant=self.restaurant,
            table=self.table,
            table_number=1,
            table_token=self.table.token,
            status='payment_requested',
        )
        self.admin = make_staff(self.restaurant, role='admin')

    def _url(self):
        return f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.session.id}/close/'

    def test_admin_closes_session(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._url(), {'payment_method': 'cash'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, 'closed')
        self.assertEqual(self.session.payment_method, 'cash')
        self.assertIsNotNone(self.session.closed_at)

    def test_waiter_blocked_when_not_allowed(self):
        waiter = make_staff(self.restaurant, role='waiter')
        self.client.force_authenticate(user=waiter)
        self.restaurant.allow_waiter_close = False
        self.restaurant.save()
        self.assertEqual(self.client.post(self._url()).status_code, status.HTTP_403_FORBIDDEN)

    def test_waiter_allowed_when_flag_set(self):
        waiter = make_staff(self.restaurant, role='waiter')
        self.client.force_authenticate(user=waiter)
        self.restaurant.allow_waiter_close = True
        self.restaurant.save()
        self.assertEqual(
            self.client.post(self._url(), {'payment_method': 'cash'}).status_code,
            status.HTTP_200_OK,
        )

    def test_open_session_cannot_be_closed_before_payment_flow(self):
        self.client.force_authenticate(user=self.admin)
        self.session.status = 'open'
        self.session.save(update_fields=['status'])
        response = self.client.post(self._url(), {'payment_method': 'cash'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, 'open')

    def test_close_requires_payment_method(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._url(), {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.session.refresh_from_db()
        self.assertNotEqual(self.session.status, 'closed')

    def test_close_rejects_unknown_payment_method(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._url(), {'payment_method': 'crypto'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_close_blocks_unresolved_guest_items(self):
        SessionItem.objects.create(
            session=self.session, item_name='Плов', price=Decimal('1000.00'),
            quantity=1, status='awaiting_confirmation',
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._url(), {'payment_method': 'cash'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.session.refresh_from_db()
        self.assertNotEqual(self.session.status, 'closed')

    def test_close_recalculates_final_total_before_analytics(self):
        SessionItem.objects.create(
            session=self.session, item_name='Плов', price=Decimal('500.00'),
            quantity=2, status='served',
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self._url(), {'payment_method': 'card'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()
        self.assertEqual(self.session.subtotal_amount, Decimal('1000.00'))
        self.assertEqual(self.session.total_amount, Decimal('1100.00'))
        self.assertEqual(self.session.payment_method, 'card')


class ItemStatusTransitionTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant(slug='item-trans')
        self.table = make_table(self.restaurant)
        self.session = TableSession.objects.create(
            restaurant=self.restaurant,
            table=self.table,
            table_number=1,
            table_token=self.table.token,
            status='open',
        )
        self.item = SessionItem.objects.create(
            session=self.session,
            item_name='Борщ',
            price=Decimal('800.00'),
            quantity=1,
            status='awaiting_confirmation',
        )
        self.staff = make_staff(self.restaurant, role='admin')
        self.client.force_authenticate(user=self.staff)

    def _patch_url(self):
        return (
            f'/api/v1/restaurants/{self.restaurant.id}'
            f'/sessions/{self.session.id}'
            f'/items/{self.item.id}/'
        )

    def test_valid_transition_succeeds(self):
        response = self.client.patch(self._patch_url(), {'status': 'confirmed'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item.refresh_from_db()
        self.assertEqual(self.item.status, 'confirmed')

    def test_skip_transition_rejected(self):
        # awaiting_confirmation → ready is invalid (must go through confirmed first)
        response = self.client.patch(self._patch_url(), {'status': 'ready'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirmed_sets_confirmed_at_timestamp(self):
        response = self.client.patch(self._patch_url(), {'status': 'confirmed'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item.refresh_from_db()
        self.assertIsNotNone(self.item.confirmed_at)

    def test_rejected_sets_rejected_at_timestamp(self):
        response = self.client.patch(self._patch_url(), {'status': 'rejected'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item.refresh_from_db()
        self.assertIsNotNone(self.item.rejected_at)

    def test_ready_sets_ready_at_timestamp(self):
        self.item.status = 'confirmed'
        self.item.save()
        response = self.client.patch(self._patch_url(), {'status': 'ready'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item.refresh_from_db()
        self.assertIsNotNone(self.item.ready_at)

    def test_full_confirmed_ready_served_lifecycle_sets_timestamps(self):
        confirmed = self.client.patch(self._patch_url(), {'status': 'confirmed'})
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)

        ready = self.client.patch(self._patch_url(), {'status': 'ready'})
        self.assertEqual(ready.status_code, status.HTTP_200_OK)

        served = self.client.patch(self._patch_url(), {'status': 'served'})
        self.assertEqual(served.status_code, status.HTTP_200_OK)

        self.item.refresh_from_db()
        self.assertEqual(self.item.status, 'served')
        self.assertIsNotNone(self.item.confirmed_at)
        self.assertIsNotNone(self.item.ready_at)
        self.assertIsNotNone(self.item.served_at)

    def test_served_is_terminal(self):
        self.item.status = 'served'
        self.item.save(update_fields=['status'])
        response = self.client.patch(self._patch_url(), {'status': 'confirmed'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class SessionRealtimeNotificationTest(APITestCase):
    """Regression: session state changes must reach both guest and staff realtime."""

    def setUp(self):
        self.restaurant = make_restaurant(slug='realtime-session')
        self.table = make_table(self.restaurant)
        self.session = TableSession.objects.create(
            restaurant=self.restaurant,
            table=self.table,
            table_number=self.table.number,
            table_token=self.table.token,
            status='open',
        )
        self.admin = make_staff(self.restaurant, role='admin')

    def test_guest_payment_request_broadcasts_to_staff_and_guest(self):
        from unittest.mock import patch

        url = f'/api/v1/sessions/by-table/{self.table.token}/request-payment/'
        with patch('apps.websocket.events.notify_session_status') as notify:
            response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notify.assert_called_once()
        notified_session = notify.call_args.args[0]
        self.assertEqual(notified_session.id, self.session.id)
        self.assertEqual(notified_session.status, 'awaiting_payment')

    def test_close_broadcasts_closed_status_to_staff_and_guest(self):
        from unittest.mock import patch

        self.client.force_authenticate(user=self.admin)
        # Close is intentionally guarded by the payment boundary. This test targets
        # the close realtime broadcast, so put the fixture in the valid pre-close state.
        self.session.status = 'awaiting_payment'
        self.session.save(update_fields=['status'])
        url = f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.session.id}/close/'
        with patch('apps.websocket.events.notify_session_status') as notify:
            response = self.client.post(url, {'payment_method': 'cash'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notify.assert_called_once()
        notified_session = notify.call_args.args[0]
        self.assertEqual(notified_session.status, 'closed')

class WaiterAssignmentIsolationTest(APITestCase):
    """Configured waiter assignments must scope both reads and mutations."""

    def setUp(self):
        self.restaurant = make_restaurant(slug='waiter-scope')
        self.table_allowed = make_table(self.restaurant, number=1)
        self.table_other = make_table(self.restaurant, number=2)
        self.waiter = make_staff(self.restaurant, role='waiter')
        self.waiter.assigned_tables.set([self.table_allowed])
        self.restaurant.allow_waiter_close = True
        self.restaurant.save(update_fields=['allow_waiter_close'])
        self.allowed_session = TableSession.objects.create(
            restaurant=self.restaurant, table=self.table_allowed,
            table_number=1, table_token=self.table_allowed.token, status='open',
        )
        self.other_session = TableSession.objects.create(
            restaurant=self.restaurant, table=self.table_other,
            table_number=2, table_token=self.table_other.token, status='open',
        )
        self.other_item = SessionItem.objects.create(
            session=self.other_session, item_name='Чай', price=Decimal('500.00'),
            quantity=1, status='confirmed',
        )
        self.client.force_authenticate(user=self.waiter)

    def test_active_session_list_only_contains_assigned_table(self):
        url = f'/api/v1/restaurants/{self.restaurant.id}/sessions/active/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {str(row['id']) for row in response.data}
        self.assertIn(str(self.allowed_session.id), ids)
        self.assertNotIn(str(self.other_session.id), ids)

    def test_waiter_cannot_update_item_on_unassigned_table(self):
        url = (
            f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.other_session.id}'
            f'/items/{self.other_item.id}/'
        )
        response = self.client.patch(url, {'status': 'ready'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.other_item.refresh_from_db()
        self.assertEqual(self.other_item.status, 'confirmed')

    def test_waiter_cannot_close_unassigned_table(self):
        url = f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.other_session.id}/close/'
        response = self.client.post(url, {'payment_method': 'cash'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.other_session.refresh_from_db()
        self.assertEqual(self.other_session.status, 'open')

    def test_unassigned_waiter_keeps_legacy_restaurant_wide_access(self):
        self.waiter.assigned_tables.clear()
        url = f'/api/v1/restaurants/{self.restaurant.id}/sessions/active/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

class SessionPaymentTransitionGuardTest(APITestCase):
    def setUp(self):
        self.restaurant = make_restaurant(slug='payment-guards')
        self.table = make_table(self.restaurant)
        self.session = TableSession.objects.create(
            restaurant=self.restaurant, table=self.table, table_number=1,
            table_token=self.table.token, status='open',
        )
        self.admin = make_staff(self.restaurant, role='admin')
        self.waiter = make_staff(self.restaurant, role='waiter')

    def _url(self):
        return f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.session.id}/'

    def test_staff_can_advance_open_to_payment_requested(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(self._url(), {'status': 'payment_requested'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_generic_status_endpoint_cannot_reopen_payment_requested(self):
        self.session.status = 'payment_requested'
        self.session.save(update_fields=['status'])
        self.client.force_authenticate(user=self.waiter)
        response = self.client.patch(self._url(), {'status': 'open'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_closed_session_cannot_be_reopened(self):
        self.session.status = 'closed'
        self.session.save(update_fields=['status'])
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(self._url(), {'status': 'open'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

class FullRestaurantRegressionFlowTest(APITestCase):
    """P0 executable restaurant journey from printed QR to owner analytics.

    This deliberately crosses public guest endpoints and authenticated staff
    endpoints so a regression in the contract between screens is caught in one
    place instead of only by isolated unit tests.
    """

    def setUp(self):
        self.restaurant = Restaurant.objects.create(
            name='Plait Full Flow',
            slug='plait-full-flow',
            service_charge_percent=10,
            order_confirmation_enabled=True,
            allow_waiter_close=True,
        )
        self.table = Table.objects.create(restaurant=self.restaurant, number=7)
        self.category = Category.objects.create(
            restaurant=self.restaurant, name='Горячее', sort_order=1,
        )
        self.menu_item = MenuItem.objects.create(
            restaurant=self.restaurant,
            category=self.category,
            name='Плов',
            price=Decimal('1500.00'),
            is_available=True,
            is_visible=True,
            preparation_station='kitchen',
        )
        self.admin = make_staff(self.restaurant, role='admin')
        self.waiter = make_staff(self.restaurant, role='waiter')
        self.waiter.assigned_tables.set([self.table])
        self.kitchen = make_staff(self.restaurant, role='kitchen')

    def test_qr_to_closed_check_to_owner_analytics(self):
        # 1. QR → menu: the printed table token resolves the correct restaurant,
        # table and only guest-visible menu data.
        guest_info = self.client.get(f'/api/v1/guest/{self.table.token}/')
        self.assertEqual(guest_info.status_code, status.HTTP_200_OK)
        self.assertEqual(guest_info.data['table']['number'], 7)
        self.assertEqual(guest_info.data['restaurant']['id'], str(self.restaurant.id))
        self.assertEqual(len(guest_info.data['menu_items']), 1)
        self.assertEqual(guest_info.data['menu_items'][0]['name'], 'Плов')

        # 2. Cart → order: guest sends two portions. Confirmation is enabled,
        # so the item must not become billable before staff accepts it.
        placed = self.client.post('/api/v1/sessions/', {
            'table_token': self.table.token,
            'items': [{
                'menu_item_id': str(self.menu_item.id),
                'quantity': 2,
                'note': 'без лука',
            }],
        }, format='json')
        self.assertEqual(placed.status_code, status.HTTP_201_CREATED)
        session_id = placed.data['id']
        item_id = placed.data['items'][0]['id']
        self.assertEqual(placed.data['items'][0]['status'], 'awaiting_confirmation')
        self.assertEqual(Decimal(str(placed.data['total_amount'])), Decimal('0.00'))

        # 3. Admin sees the new table/session and confirms the guest item.
        self.client.force_authenticate(user=self.admin)
        active = self.client.get(
            f'/api/v1/restaurants/{self.restaurant.id}/sessions/active/'
        )
        self.assertEqual(active.status_code, status.HTTP_200_OK)
        self.assertEqual({str(row['id']) for row in active.data}, {str(session_id)})

        item_url = (
            f'/api/v1/restaurants/{self.restaurant.id}/sessions/{session_id}'
            f'/items/{item_id}/'
        )
        confirmed = self.client.patch(item_url, {'status': 'confirmed'}, format='json')
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)

        # 4. Dedicated least-privilege Kitchen account marks the prepared item ready.
        self.client.force_authenticate(user=self.kitchen)
        ready = self.client.patch(item_url, {'status': 'ready'}, format='json')
        self.assertEqual(ready.status_code, status.HTTP_200_OK)

        # 5. Waiter assigned to this table marks it served.
        self.client.force_authenticate(user=self.waiter)
        served = self.client.patch(item_url, {'status': 'served'}, format='json')
        self.assertEqual(served.status_code, status.HTTP_200_OK)

        # 6. Guest requests the bill from the same QR session.
        self.client.force_authenticate(user=None)
        payment_request = self.client.post(
            f'/api/v1/sessions/by-table/{self.table.token}/request-payment/'
        )
        self.assertEqual(payment_request.status_code, status.HTTP_200_OK)
        self.assertEqual(payment_request.data['status'], 'awaiting_payment')

        # 7. Admin/cashier accepts payment and closes the immutable bill.
        self.client.force_authenticate(user=self.admin)
        status_url = f'/api/v1/restaurants/{self.restaurant.id}/sessions/{session_id}/'
        accepted = self.client.patch(
            status_url, {'status': 'payment_requested'}, format='json'
        )
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)

        closed = self.client.post(
            f'/api/v1/restaurants/{self.restaurant.id}/sessions/{session_id}/close/',
            {'payment_method': 'card'},
            format='json',
        )
        self.assertEqual(closed.status_code, status.HTTP_200_OK)
        self.assertEqual(closed.data['status'], 'closed')
        self.assertEqual(closed.data['payment_method'], 'card')
        self.assertEqual(Decimal(str(closed.data['subtotal_amount'])), Decimal('3000.00'))
        self.assertEqual(Decimal(str(closed.data['total_amount'])), Decimal('3300.00'))

        # 8. Owner/Admin analytics must immediately reflect the exact closed bill.
        analytics = self.client.get(
            f'/api/v1/restaurants/{self.restaurant.id}/analytics/summary/'
        )
        self.assertEqual(analytics.status_code, status.HTTP_200_OK)
        self.assertEqual(analytics.data['sessions_count'], 1)
        self.assertEqual(Decimal(str(analytics.data['revenue'])), Decimal('3300.00'))
        self.assertEqual(Decimal(str(analytics.data['avg_check'])), Decimal('3300.00'))
        self.assertEqual(analytics.data['top_items'][0]['item_name'], 'Плов')
        self.assertEqual(analytics.data['top_items'][0]['total_qty'], 2)
        self.assertEqual(
            Decimal(str(analytics.data['top_items'][0]['total_revenue'])),
            Decimal('3000.00'),
        )

        # 9. Closed session is no longer returned as active to operational screens.
        active_after_close = self.client.get(
            f'/api/v1/restaurants/{self.restaurant.id}/sessions/active/'
        )
        self.assertEqual(active_after_close.status_code, status.HTTP_200_OK)
        self.assertEqual(active_after_close.data, [])

class KitchenLeastPrivilegeTests(APITestCase):
    """P0: a kitchen tablet can prepare food, but cannot operate the bill."""

    def setUp(self):
        self.restaurant = Restaurant.objects.create(
            name='Kitchen Scope', slug='kitchen-scope', service_charge_percent=10,
        )
        self.table = Table.objects.create(restaurant=self.restaurant, number=3)
        self.category = Category.objects.create(restaurant=self.restaurant, name='Food')
        self.menu_item = make_item(self.restaurant, self.category, price='1000.00')
        self.kitchen = make_staff(self.restaurant, role='kitchen')
        self.session = TableSession.objects.create(
            restaurant=self.restaurant, table=self.table, table_number=3,
            table_token=self.table.token, status='open', order_type='dine_in',
        )
        self.item = SessionItem.objects.create(
            session=self.session, menu_item=self.menu_item, item_name=self.menu_item.name,
            price=Decimal('1000.00'), quantity=1, status='confirmed',
            preparation_station='kitchen', added_by='guest',
        )
        self.client.force_authenticate(user=self.kitchen)
        self.item_url = (
            f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.session.id}'
            f'/items/{self.item.id}/'
        )

    def test_kitchen_can_read_active_sessions_and_mark_ready(self):
        active = self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/sessions/active/')
        self.assertEqual(active.status_code, status.HTTP_200_OK)
        self.assertEqual(len(active.data), 1)
        ready = self.client.patch(self.item_url, {'status': 'ready'}, format='json')
        self.assertEqual(ready.status_code, status.HTTP_200_OK)
        self.assertEqual(ready.data['status'], 'ready')

    def test_kitchen_cannot_confirm_guest_item_or_mark_served(self):
        self.item.status = 'awaiting_confirmation'
        self.item.save(update_fields=['status'])
        confirm = self.client.patch(self.item_url, {'status': 'confirmed'}, format='json')
        self.assertEqual(confirm.status_code, status.HTTP_403_FORBIDDEN)

        self.item.status = 'ready'
        self.item.save(update_fields=['status'])
        served = self.client.patch(self.item_url, {'status': 'served'}, format='json')
        self.assertEqual(served.status_code, status.HTTP_403_FORBIDDEN)

    def test_kitchen_cannot_create_or_add_items(self):
        payload = {'table_token': self.table.token, 'items': [
            {'menu_item_id': str(self.menu_item.id), 'quantity': 1}
        ]}
        created = self.client.post(
            f'/api/v1/restaurants/{self.restaurant.id}/sessions/place-order/', payload, format='json'
        )
        self.assertEqual(created.status_code, status.HTTP_403_FORBIDDEN)
        added = self.client.post(
            f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.session.id}/items/',
            {'items': [{'menu_item_id': str(self.menu_item.id), 'quantity': 1}]}, format='json'
        )
        self.assertEqual(added.status_code, status.HTTP_403_FORBIDDEN)

    def test_kitchen_cannot_touch_payment_or_close(self):
        status_update = self.client.patch(
            f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.session.id}/',
            {'status': 'payment_requested'}, format='json'
        )
        self.assertEqual(status_update.status_code, status.HTTP_403_FORBIDDEN)
        close = self.client.post(
            f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.session.id}/close/',
            {'payment_method': 'cash'}, format='json'
        )
        self.assertEqual(close.status_code, status.HTTP_403_FORBIDDEN)

class SLAIncidentTests(APITestCase):
    def setUp(self):
        from apps.restaurants.models import Restaurant
        from apps.tables.models import Table
        from apps.users.models import User
        self.restaurant = Restaurant.objects.create(name='SLA Cafe', slug='sla-cafe', kitchen_sla_minutes=10, bar_sla_minutes=5, ready_to_served_sla_minutes=3)
        self.table = Table.objects.create(restaurant=self.restaurant, number=7)
        self.admin = User.objects.create_user(username='sla-admin', email='sla-admin@example.com', password='x', role='admin', restaurant=self.restaurant)
        self.kitchen = User.objects.create_user(username='sla-kitchen', email='sla-kitchen@example.com', password='x', role='kitchen', restaurant=self.restaurant)
        self.waiter = User.objects.create_user(username='sla-waiter', email='sla-waiter@example.com', password='x', role='waiter', restaurant=self.restaurant)
        self.session = TableSession.objects.create(restaurant=self.restaurant, table=self.table, table_number=7, table_token='sla-token', status='open')

    def _url(self): return f'/api/v1/restaurants/{self.restaurant.id}/sla-incidents/'

    def test_warning_then_overdue_is_role_scoped_and_persisted(self):
        import datetime
        now = timezone.now()
        warning = SessionItem.objects.create(session=self.session, item_name='Soup', price=1000, quantity=1, status='confirmed', confirmed_at=now-datetime.timedelta(minutes=8, seconds=30))
        overdue = SessionItem.objects.create(session=self.session, item_name='Steak', price=3000, quantity=1, status='confirmed', confirmed_at=now-datetime.timedelta(minutes=12))
        self.client.force_authenticate(self.kitchen)
        data = self.client.get(self._url()).data
        self.assertEqual({a['severity'] for a in data['alerts']}, {'warning','overdue'})
        self.assertEqual(SLAIncident.objects.filter(item=overdue, kind='preparation').count(), 1)
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get(self._url()).data['alerts'], [])

    def test_handoff_alert_resolves_and_history_survives(self):
        import datetime
        now = timezone.now()
        item = SessionItem.objects.create(session=self.session, item_name='Tea', price=500, quantity=1, status='ready', confirmed_at=now-datetime.timedelta(minutes=8), ready_at=now-datetime.timedelta(minutes=4))
        self.client.force_authenticate(self.waiter)
        first = self.client.get(self._url()).data
        self.assertEqual(first['alerts'][0]['kind'], 'handoff')
        self.assertIsNone(SLAIncident.objects.get(item=item, kind='handoff').resolved_at)
        item.status='served'; item.served_at=now; item.save(update_fields=['status','served_at'])
        second = self.client.get(self._url()).data
        self.assertEqual(second['alerts'], [])
        self.assertIsNotNone(SLAIncident.objects.get(item=item, kind='handoff').resolved_at)
        self.assertEqual(len(second['history']), 1)

    def test_cross_tenant_is_denied(self):
        from apps.restaurants.models import Restaurant
        from apps.users.models import User
        other = Restaurant.objects.create(name='Other', slug='sla-other')
        foreign = User.objects.create_user(username='sla-foreign', password='x', role='admin', restaurant=other)
        self.client.force_authenticate(foreign)
        self.assertEqual(self.client.get(self._url()).status_code, 403)

class OperationsExceptionsTests(APITestCase):
    def setUp(self):
        import datetime
        from apps.calls.models import WaiterCall
        self.restaurant = make_restaurant('exceptions')
        self.other = make_restaurant('exceptions-other')
        self.table = make_table(self.restaurant, 11)
        self.admin = make_staff(self.restaurant, 'admin')
        self.waiter = make_staff(self.restaurant, 'waiter')
        self.kitchen = make_staff(self.restaurant, 'kitchen')
        self.session = TableSession.objects.create(restaurant=self.restaurant, table=self.table, table_number=11, table_token=self.table.token, status='payment_requested')
        TableSession.objects.filter(pk=self.session.pk).update(updated_at=timezone.now()-datetime.timedelta(minutes=11))
        self.awaiting = SessionItem.objects.create(session=self.session, item_name='Burger', price=2000, quantity=1, status='awaiting_confirmation')
        SessionItem.objects.filter(pk=self.awaiting.pk).update(created_at=timezone.now()-datetime.timedelta(minutes=8))
        self.call = WaiterCall.objects.create(restaurant=self.restaurant, table=self.table, table_number=11, table_token=self.table.token, status='new', reason='Счёт')
        foreign_table = make_table(self.other, 99)
        WaiterCall.objects.create(restaurant=self.other, table=foreign_table, table_number=99, table_token=foreign_table.token)
        self.url=f'/api/v1/restaurants/{self.restaurant.id}/operations/exceptions/'

    def test_admin_gets_unified_priority_queue_without_foreign_tenant(self):
        self.client.force_authenticate(self.admin)
        response=self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        kinds={x['kind'] for x in response.data['exceptions']}
        self.assertTrue({'call','payment','order'}.issubset(kinds))
        self.assertFalse(any(x.get('table_number')==99 for x in response.data['exceptions']))
        self.assertEqual(response.data['counts']['total'], len(response.data['exceptions']))

    def test_kitchen_does_not_receive_calls_payment_or_confirmation(self):
        self.client.force_authenticate(self.kitchen)
        response=self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse({'call','payment','order'} & {x['kind'] for x in response.data['exceptions']})

    def test_foreign_tenant_denied(self):
        foreign=make_staff(self.other, 'admin')
        self.client.force_authenticate(foreign)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_acknowledge_tracks_owner_and_response_time(self):
        from apps.sessions.models import OperationalExceptionState
        self.client.force_authenticate(self.admin)
        queue = self.client.get(self.url).data['exceptions']
        target = next(x for x in queue if x['kind'] == 'call')
        response = self.client.post(self.url, {'exception_key': target['id'], 'action': 'acknowledge'}, format='json')
        self.assertEqual(response.status_code, 200)
        state = OperationalExceptionState.objects.get(restaurant=self.restaurant, exception_key=target['id'])
        self.assertEqual(state.acknowledged_by_id, self.admin.id)
        refreshed = self.client.get(self.url).data
        row = next(x for x in refreshed['exceptions'] if x['id'] == target['id'])
        self.assertEqual(row['acknowledged_by']['id'], str(self.admin.id))
        self.assertIsNotNone(row['response_minutes'])
        self.assertEqual(refreshed['counts']['acknowledged'], 1)

    def test_exception_auto_resolves_when_source_disappears(self):
        from apps.sessions.models import OperationalExceptionState
        self.client.force_authenticate(self.admin)
        target = next(x for x in self.client.get(self.url).data['exceptions'] if x['kind'] == 'call')
        self.client.post(self.url, {'exception_key': target['id'], 'action': 'acknowledge'}, format='json')
        self.call.status = 'closed'; self.call.save(update_fields=['status'])
        self.client.get(self.url)
        self.assertIsNotNone(OperationalExceptionState.objects.get(restaurant=self.restaurant, exception_key=target['id']).resolved_at)

    def test_kitchen_cannot_acknowledge_front_of_house_exception(self):
        self.client.force_authenticate(self.admin)
        target = next(x for x in self.client.get(self.url).data['exceptions'] if x['kind'] == 'call')
        self.client.force_authenticate(self.kitchen)
        response = self.client.post(self.url, {'exception_key': target['id'], 'action': 'acknowledge'}, format='json')
        self.assertEqual(response.status_code, 404)

class SessionOperationsTimelineTests(APITestCase):
    def setUp(self):
        import datetime
        from apps.calls.models import WaiterCall
        self.restaurant = make_restaurant('timeline')
        self.other = make_restaurant('timeline-other')
        self.table = make_table(self.restaurant, 4)
        self.admin = make_staff(self.restaurant, 'admin')
        self.kitchen = make_staff(self.restaurant, 'kitchen')
        self.session = TableSession.objects.create(restaurant=self.restaurant, table=self.table, table_number=4, table_token=self.table.token)
        now = timezone.now()
        self.item = SessionItem.objects.create(session=self.session, item_name='Pasta', price=3200, quantity=1, status='served', confirmed_at=now-datetime.timedelta(minutes=12), ready_at=now-datetime.timedelta(minutes=4), served_at=now-datetime.timedelta(minutes=2))
        SLAIncident.objects.create(restaurant=self.restaurant, item=self.item, kind='preparation', station='kitchen', target_minutes=8, breached_at=now-datetime.timedelta(minutes=5), resolved_at=now-datetime.timedelta(minutes=4))
        WaiterCall.objects.create(restaurant=self.restaurant, table=self.table, table_number=4, table_token=self.table.token, status='new', reason='Вода')
        self.url=f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.session.id}/timeline/'

    def test_admin_sees_order_kitchen_handoff_call_and_sla_history(self):
        self.client.force_authenticate(self.admin)
        response=self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        kinds={e['kind'] for e in response.data['events']}
        self.assertTrue({'session','order','confirmed','ready','served','sla_breach','sla_resolved','call'}.issubset(kinds))
        times=[e['at'] for e in response.data['events']]
        self.assertEqual(times, sorted(times))

    def test_kitchen_timeline_is_least_privilege(self):
        self.client.force_authenticate(self.kitchen)
        response=self.client.get(self.url)
        kinds={e['kind'] for e in response.data['events']}
        self.assertIn('ready', kinds)
        self.assertIn('sla_breach', kinds)
        self.assertFalse({'call','served','payment','closed'} & kinds)

    def test_cross_tenant_denied(self):
        foreign=make_staff(self.other, 'admin')
        self.client.force_authenticate(foreign)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_quality_summary_uses_authoritative_lifecycle_durations(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(self.url)
        quality = response.data['quality_summary']
        self.assertEqual(quality['scope'], 'full')
        self.assertEqual(quality['items_total'], 1)
        self.assertEqual(quality['items_completed'], 1)
        self.assertAlmostEqual(quality['avg_confirm_to_ready_minutes'], 8.0, places=1)
        self.assertAlmostEqual(quality['avg_ready_to_served_minutes'], 2.0, places=1)
        self.assertEqual(quality['sla_breaches'], 1)
        self.assertEqual(quality['waiter_calls'], 1)

    def test_kitchen_quality_summary_does_not_expose_front_of_house_metrics(self):
        self.client.force_authenticate(self.kitchen)
        quality = self.client.get(self.url).data['quality_summary']
        self.assertEqual(quality['scope'], 'kitchen')
        self.assertIn('avg_confirm_to_ready_minutes', quality)
        self.assertNotIn('avg_ready_to_served_minutes', quality)
        self.assertNotIn('waiter_calls', quality)
        self.assertNotIn('operational_exceptions', quality)

class ServiceRecoveryTests(APITestCase):
    def setUp(self):
        self.restaurant=make_restaurant('recovery'); self.other=make_restaurant('recovery-other')
        self.table=make_table(self.restaurant,7); self.session=TableSession.objects.create(restaurant=self.restaurant,table=self.table,table_number=7,table_token=self.table.token)
        self.admin=make_staff(self.restaurant,'admin'); self.manager=make_staff(self.restaurant,'manager'); self.waiter=make_staff(self.restaurant,'waiter'); self.kitchen=make_staff(self.restaurant,'kitchen')
        self.url=f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.session.id}/service-recoveries/'
    def test_manager_can_create_list_delete_recovery(self):
        self.client.force_authenticate(self.manager)
        r=self.client.post(self.url,{'reason':'delay','note':'Гость ждал блюдо; предложили десерт.','compensation_type':'Десерт','compensation_amount':'1800'},format='json')
        self.assertEqual(r.status_code,201); self.assertEqual(r.data['reason'],'delay')
        self.assertEqual(len(self.client.get(self.url).data),1)
        self.assertEqual(self.client.delete(self.url+r.data['id']+'/').status_code,204)
    def test_waiter_and_kitchen_cannot_write_manager_recovery(self):
        for user in (self.waiter,self.kitchen):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.post(self.url,{'reason':'delay','note':'x'},format='json').status_code,403)
    def test_cross_tenant_is_denied(self):
        self.client.force_authenticate(make_staff(self.other,'admin'))
        self.assertEqual(self.client.get(self.url).status_code,403)
    def test_validation_rejects_negative_compensation(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(self.url,{'reason':'delay','note':'x','compensation_amount':'-1'},format='json').status_code,400)

class ServiceRecoverySourceTrackingTests(APITestCase):
    def setUp(self):
        self.restaurant=make_restaurant('recovery-source'); self.table=make_table(self.restaurant,9)
        self.session=TableSession.objects.create(restaurant=self.restaurant,table=self.table,table_number=9,table_token=self.table.token)
        self.manager=make_staff(self.restaurant,'manager')
        self.item=SessionItem.objects.create(session=self.session,item_name='Soup',unit_price=1000,quantity=1,status='confirmed',confirmed_at=timezone.now()-timedelta(minutes=20))
        self.incident=SLAIncident.objects.create(restaurant=self.restaurant,item=self.item,kind='preparation',station='kitchen',target_minutes=10,breached_at=timezone.now()-timedelta(minutes=10))
        self.client.force_authenticate(self.manager)
        self.url=f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.session.id}/service-recoveries/'
    def test_recovery_can_link_to_sla_of_same_session(self):
        r=self.client.post(self.url,{'reason':'delay','note':'Guest recovery','source_type':'sla','source_id':str(self.incident.id)},format='json')
        self.assertEqual(r.status_code,201); self.assertEqual(r.data['source_type'],'sla'); self.assertEqual(r.data['source_id'],str(self.incident.id))
    def test_recovery_rejects_sla_from_other_session(self):
        other=TableSession.objects.create(restaurant=self.restaurant,table=self.table,table_number=9,table_token=self.table.token)
        item=SessionItem.objects.create(session=other,item_name='Tea',unit_price=500,quantity=1,status='confirmed')
        inc=SLAIncident.objects.create(restaurant=self.restaurant,item=item,kind='preparation',station='kitchen',target_minutes=10,breached_at=timezone.now())
        r=self.client.post(self.url,{'reason':'delay','note':'x','source_type':'sla','source_id':str(inc.id)},format='json')
        self.assertEqual(r.status_code,404)
    def test_timeline_exposes_recovery_sources_to_manager(self):
        r=self.client.get(f'/api/v1/restaurants/{self.restaurant.id}/sessions/{self.session.id}/timeline/')
        self.assertEqual(r.status_code,200); self.assertTrue(any(x['id']==str(self.incident.id) for x in r.data['recovery_sources']))
