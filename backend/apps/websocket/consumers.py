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
        self.group = None  # FIX: always initialise before any early return
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
        # FIX: only discard from group if we actually joined one
        if self.group:
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content):
        pass  # staff only listens

    @database_sync_to_async
    def _waiter_can_receive_table_event(self, table_id: str | None) -> bool:
        """Scope table events for assigned waiters without changing legacy unassigned behaviour.

        Admin/manager/cashier always receive restaurant-wide events. A waiter who has
        explicit table/zone assignments receives only events for effective_table_ids.
        An unassigned waiter keeps restaurant-wide visibility for backwards compatibility
        with restaurants that have not configured assignments yet.
        """
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

    # Event handlers — method name must match the `type` sent via group_send

    async def new_order(self, event):
        await self._send_table_event('new_order', event)

    async def waiter_call(self, event):
        if self.role != 'kitchen':
            await self._send_table_event('waiter_call', event)

    async def item_status_changed(self, event):
        await self._send_table_event('item_status_changed', event)

    async def session_status_changed(self, event):
        await self._send_table_event('session_status_changed', event)

    # FIX (CRITICAL): SessionDeliveryStatusUpdateView (apps/sessions/views.py)
    # broadcasts a `delivery_status_changed` group event whenever a delivery/
    # pickup order's status changes, but no handler method existed for it.
    # Channels' AsyncJsonWebsocketConsumer dispatches group events by looking
    # up `event['type']` as a method name — when no matching method exists it
    # raises ValueError("No handler for message type ..."), which crashes the
    # consumer and disconnects every staff socket subscribed to that
    # restaurant's group. Adding the handler fixes the disconnect/crash.
    async def delivery_status_changed(self, event):
        if self.role != 'kitchen':
            await self.send_json({'type': 'delivery_status_changed', 'data': event['data']})

    # Групповой чат персонала: новое сообщение / закрепление / удаление.
    # Клиент по этому событию обновляет ленту и счётчик непрочитанных —
    # без звукового сигнала, чтобы не мешать уведомлениям о вызовах официанта.
    async def chat_message(self, event):
        if self.role != 'kitchen':
            await self.send_json({'type': 'chat_message', 'data': event['data']})


class GuestConsumer(AsyncJsonWebsocketConsumer):
    """
    ws/guest/<table_token>/
    Receives: order_confirmed, item_ready, session_status_changed

    FIX #3: table_token is now validated against the DB before accepting.
            Previously, anyone could subscribe to an arbitrary group name
            (e.g. guess or brute-force tokens), creating Redis groups for
            garbage tokens — a lightweight DoS vector.
    FIX #4: self.group initialised to None for the same disconnect safety.
    """

    @database_sync_to_async
    def _token_exists(self, token: str) -> bool:
        from apps.tables.models import Table
        return Table.objects.filter(token=token, is_active=True).exists()

    async def connect(self):
        self.group = None  # FIX: always initialise before any early return
        self.table_token = self.scope['url_route']['kwargs']['table_token']

        # FIX: validate token exists — reject unknown/guessed tokens
        if not await self._token_exists(self.table_token):
            await self.close(code=4404)
            return

        self.group = f'guest_{self.table_token}'
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # FIX: only discard from group if we actually joined one
        if self.group:
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content):
        pass  # guest only listens

    async def order_confirmed(self, event):
        await self.send_json({'type': 'order_confirmed', 'data': event['data']})

    async def item_ready(self, event):
        await self.send_json({'type': 'item_ready', 'data': event['data']})

    async def session_status_changed(self, event):
        await self.send_json({'type': 'session_status_changed', 'data': event['data']})

    # FIX (CRITICAL): see StaffConsumer.delivery_status_changed above — same
    # missing-handler crash applied to guest sockets subscribed via table_token.
    async def delivery_status_changed(self, event):
        await self.send_json({'type': 'delivery_status_changed', 'data': event['data']})
