from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class StaffConsumer(AsyncJsonWebsocketConsumer):
    """
    ws/staff/<rest_id>/?token=<JWT>
    Receives: new_order, waiter_call, item_status_changed

    FIX #1: self.group initialised to None before any auth check so that
            disconnect() never raises AttributeError when connect() rejects early.
    FIX #2: Authentication is now done by JWTAuthMiddleware (see middleware.py),
            which resolves scope['user'] from the ?token= query-param.
            The old AuthMiddlewareStack only worked with Django session cookies,
            so staff connections were *always* rejected for JWT-auth clients.
    """

    async def connect(self):
        self.group = None
        self.rest_id = self.scope['url_route']['kwargs']['rest_id']
        user = self.scope.get('user')

        if (
            not user
            or not user.is_authenticated
            or str(getattr(user, 'restaurant_id', None)) != self.rest_id
        ):
            await self.close(code=4401)
            return

        self.role = getattr(user, 'role', None)
        self.group = f'staff_{self.rest_id}'
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if self.group:
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content):
        pass

    @database_sync_to_async
    def _waiter_can_receive_table_event(self, table_id: str | None) -> bool:
        """Scope table events for assigned waiters without changing legacy unassigned behaviour."""
        if self.role != 'waiter':
            return True
        user = self.scope.get('user')
        has_assignments = user.assigned_tables.exists() or user.assigned_zones.exists()
        if not has_assignments:
            return True
        if not table_id:
            return False
        return str(table_id) in {str(pk) for pk in user.effective_table_ids}

    async def _send_table_event(self, event_type: str, event):
        data = event['data']
        if await self._waiter_can_receive_table_event(data.get('table_id')):
            await self.send_json({'type': event_type, 'data': data})

    async def new_order(self, event):
        await self._send_table_event('new_order', event)

    async def waiter_call(self, event):
        if self.role != 'kitchen':
            await self._send_table_event('waiter_call', event)

    async def item_status_changed(self, event):
        await self._send_table_event('item_status_changed', event)

    async def session_status_changed(self, event):
        await self._send_table_event('session_status_changed', event)

    async def delivery_status_changed(self, event):
        # Delivery/pickup events are table-scoped too. Previously this handler
        # bypassed _send_table_event(), so an explicitly assigned waiter could
        # receive another table's delivery lifecycle event from the restaurant
        # group. Missing table_id now fails closed for assigned waiters.
        if self.role != 'kitchen':
            await self._send_table_event('delivery_status_changed', event)

    async def chat_message(self, event):
        if self.role != 'kitchen':
            await self.send_json({'type': 'chat_message', 'data': event['data']})


class GuestConsumer(AsyncJsonWebsocketConsumer):
    """
    ws/guest/<table_token>/
    Receives: order_confirmed, item_ready, session_status_changed
    """

    @database_sync_to_async
    def _token_exists(self, token: str) -> bool:
        from apps.tables.models import Table
        return Table.objects.filter(token=token, is_active=True).exists()

    async def connect(self):
        self.group = None
        self.table_token = self.scope['url_route']['kwargs']['table_token']

        if not await self._token_exists(self.table_token):
            await self.close(code=4404)
            return

        self.group = f'guest_{self.table_token}'
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if self.group:
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content):
        pass

    async def order_confirmed(self, event):
        await self.send_json({'type': 'order_confirmed', 'data': event['data']})

    async def item_ready(self, event):
        await self.send_json({'type': 'item_ready', 'data': event['data']})

    async def session_status_changed(self, event):
        await self.send_json({'type': 'session_status_changed', 'data': event['data']})

    async def delivery_status_changed(self, event):
        await self.send_json({'type': 'delivery_status_changed', 'data': event['data']})
