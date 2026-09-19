from urllib.parse import quote

from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken

from apps.restaurants.models import Restaurant
from apps.tables.models import Table
from apps.users.models import User
from apps.websocket.middleware import JWTAuthMiddleware
from apps.websocket.routing import websocket_urlpatterns


TEST_CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    },
}


@override_settings(CHANNEL_LAYERS=TEST_CHANNEL_LAYERS)
class WebsocketTenantIsolationTests(TransactionTestCase):
    """Security regression suite for realtime tenant/table boundaries."""

    reset_sequences = True

    def setUp(self):
        self.restaurant_a = Restaurant.objects.create(name='Cafe A', slug='cafe-a')
        self.restaurant_b = Restaurant.objects.create(name='Cafe B', slug='cafe-b')
        self.table_a = Table.objects.create(restaurant=self.restaurant_a, number=1)
        self.table_b = Table.objects.create(restaurant=self.restaurant_b, number=1)
        self.admin_a = User.objects.create_user(
            email='admin-a@example.com', password='pass12345', name='Admin A',
            role='admin', restaurant=self.restaurant_a,
        )
        self.waiter_a = User.objects.create_user(
            email='waiter-a@example.com', password='pass12345', name='Waiter A',
            role='waiter', restaurant=self.restaurant_a,
        )
        self.waiter_a.assigned_tables.add(self.table_a)
        self.app = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))

    @staticmethod
    def _jwt(user):
        return str(AccessToken.for_user(user))

    async def _connect_staff(self, restaurant, token):
        communicator = WebsocketCommunicator(
            self.app,
            f'/ws/staff/{restaurant.id}/?token={quote(token)}',
        )
        connected, detail = await communicator.connect()
        return communicator, connected, detail

    async def test_staff_jwt_cannot_connect_to_another_restaurant(self):
        communicator, connected, close_code = await self._connect_staff(
            self.restaurant_b, self._jwt(self.admin_a),
        )
        self.assertFalse(connected)
        self.assertEqual(close_code, 4401)
        await communicator.disconnect()

    async def test_missing_and_invalid_staff_jwt_are_rejected(self):
        missing = WebsocketCommunicator(self.app, f'/ws/staff/{self.restaurant_a.id}/')
        connected, close_code = await missing.connect()
        self.assertFalse(connected)
        self.assertEqual(close_code, 4401)
        await missing.disconnect()

        invalid, connected, close_code = await self._connect_staff(
            self.restaurant_a, 'not-a-jwt',
        )
        self.assertFalse(connected)
        self.assertEqual(close_code, 4401)
        await invalid.disconnect()

    async def test_expired_staff_jwt_is_rejected(self):
        from datetime import timedelta
        from django.utils import timezone

        token = AccessToken.for_user(self.admin_a)
        token.set_exp(from_time=timezone.now() - timedelta(minutes=5), lifetime=timedelta(seconds=1))
        communicator, connected, close_code = await self._connect_staff(
            self.restaurant_a, str(token),
        )
        self.assertFalse(connected)
        self.assertEqual(close_code, 4401)
        await communicator.disconnect()

    async def test_unknown_guest_table_token_is_rejected(self):
        communicator = WebsocketCommunicator(self.app, '/ws/guest/unknown-table-token/')
        connected, close_code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(close_code, 4404)
        await communicator.disconnect()

    async def test_inactive_guest_table_token_is_rejected(self):
        self.table_a.is_active = False
        await self.table_a.asave(update_fields=['is_active'])
        communicator = WebsocketCommunicator(self.app, f'/ws/guest/{self.table_a.token}/')
        connected, close_code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(close_code, 4404)
        await communicator.disconnect()

    async def test_restaurant_event_does_not_leak_to_other_restaurant(self):
        socket_a, connected_a, _ = await self._connect_staff(
            self.restaurant_a, self._jwt(self.admin_a),
        )
        self.assertTrue(connected_a)

        admin_b = await User.objects.acreate(
            email='admin-b@example.com', name='Admin B', role='admin',
            restaurant=self.restaurant_b, is_active=True,
        )
        socket_b, connected_b, _ = await self._connect_staff(
            self.restaurant_b, self._jwt(admin_b),
        )
        self.assertTrue(connected_b)

        from channels.layers import get_channel_layer
        layer = get_channel_layer()
        await layer.group_send(
            f'staff_{self.restaurant_a.id}',
            {'type': 'new_order', 'data': {'table_id': str(self.table_a.id), 'order_id': 'A-1'}},
        )

        message = await socket_a.receive_json_from(timeout=1)
        self.assertEqual(message['type'], 'new_order')
        self.assertEqual(message['data']['order_id'], 'A-1')
        self.assertTrue(await socket_b.receive_nothing(timeout=0.1))

        await socket_a.disconnect()
        await socket_b.disconnect()

    async def test_assigned_waiter_does_not_receive_other_table_event(self):
        waiter_socket, connected, _ = await self._connect_staff(
            self.restaurant_a, self._jwt(self.waiter_a),
        )
        self.assertTrue(connected)

        other_table = await Table.objects.acreate(restaurant=self.restaurant_a, number=2)
        from channels.layers import get_channel_layer
        layer = get_channel_layer()

        await layer.group_send(
            f'staff_{self.restaurant_a.id}',
            {'type': 'new_order', 'data': {'table_id': str(other_table.id), 'order_id': 'other'}},
        )
        self.assertTrue(await waiter_socket.receive_nothing(timeout=0.1))

        await layer.group_send(
            f'staff_{self.restaurant_a.id}',
            {'type': 'new_order', 'data': {'table_id': str(self.table_a.id), 'order_id': 'mine'}},
        )
        message = await waiter_socket.receive_json_from(timeout=1)
        self.assertEqual(message['data']['order_id'], 'mine')
        await waiter_socket.disconnect()

    async def test_guest_event_is_isolated_by_table_token(self):
        guest_a = WebsocketCommunicator(self.app, f'/ws/guest/{self.table_a.token}/')
        guest_b = WebsocketCommunicator(self.app, f'/ws/guest/{self.table_b.token}/')
        connected_a, _ = await guest_a.connect()
        connected_b, _ = await guest_b.connect()
        self.assertTrue(connected_a)
        self.assertTrue(connected_b)

        from channels.layers import get_channel_layer
        layer = get_channel_layer()
        await layer.group_send(
            f'guest_{self.table_a.token}',
            {'type': 'item_ready', 'data': {'item_id': 'A-item'}},
        )
        message = await guest_a.receive_json_from(timeout=1)
        self.assertEqual(message['type'], 'item_ready')
        self.assertEqual(message['data']['item_id'], 'A-item')
        self.assertTrue(await guest_b.receive_nothing(timeout=0.1))

        await guest_a.disconnect()
        await guest_b.disconnect()

    async def test_delivery_event_remains_restaurant_scoped_not_table_scoped(self):
        waiter_socket, connected, _ = await self._connect_staff(
            self.restaurant_a, self._jwt(self.waiter_a),
        )
        self.assertTrue(connected)

        from channels.layers import get_channel_layer
        layer = get_channel_layer()
        await layer.group_send(
            f'staff_{self.restaurant_a.id}',
            {
                'type': 'delivery_status_changed',
                'data': {'session_id': 'delivery-1', 'delivery_status': 'ready_for_pickup'},
            },
        )
        message = await waiter_socket.receive_json_from(timeout=1)
        self.assertEqual(message['type'], 'delivery_status_changed')
        self.assertEqual(message['data']['session_id'], 'delivery-1')
        await waiter_socket.disconnect()
