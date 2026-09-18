from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.menu.models import MenuItem
from apps.tables.models import Table
from apps.users.permissions import IsRestaurantSessionStaff, IsRestaurantAdmin
from apps.users.throttles import OrderRateThrottle
from .models import SessionItem, TableSession, SLAIncident
from .serializers import (
    PlaceDeliveryOrderSerializer,
    PlaceOrderSerializer,
    SessionItemSerializer,
    StaffAddItemsSerializer,
    TableSessionSerializer,
)
from .services import PlaceDeliveryOrderService, PlaceOrderService

# Status transition map for kitchen flow (D-8; order-confirmation model)
# Возврат «готово → в работу» выражается через ready → confirmed (кухня снова
# видит позицию). Legacy sent_to_kitchen/sent_to_bar убраны — их больше нет в модели.
VALID_TRANSITIONS = {
    'awaiting_confirmation': {'confirmed', 'rejected', 'cancelled'},
    'confirmed':             {'ready', 'cancelled'},
    'ready':                 {'served', 'confirmed', 'cancelled'},
    'served':                set(),
    'rejected':              set(),
    'cancelled':             set(),
}

# Status transition map for delivery / pickup orders
DELIVERY_STATUS_TRANSITIONS = {
    'new':              {'confirmed', 'cancelled'},
    'confirmed':        {'preparing', 'cancelled'},
    'preparing':        {'on_the_way', 'ready_for_pickup', 'cancelled'},
    'on_the_way':       {'completed', 'cancelled'},
    'ready_for_pickup': {'completed', 'cancelled'},
    'completed':        set(),
    'cancelled':        set(),
}


def _waiter_has_explicit_assignments(user):
    return user.role == 'waiter' and (user.assigned_tables.exists() or user.assigned_zones.exists())




def _deny_kitchen(user, detail='Кухонной роли это действие недоступно.'):
    """Return a least-privilege denial for operations outside kitchen workflow."""
    if user.role == 'kitchen':
        return Response({'detail': detail}, status=status.HTTP_403_FORBIDDEN)
    return None


def _kitchen_transition_allowed(current_status, new_status):
    """Kitchen may only finish preparation or return a ready item to preparation."""
    return (current_status, new_status) in {('confirmed', 'ready'), ('ready', 'confirmed')}

def _waiter_can_access_table(user, table_id):
    """Preserve legacy unassigned waiter access; enforce configured assignments."""
    if not _waiter_has_explicit_assignments(user):
        return True
    return table_id in user.effective_table_ids


# ── Guest endpoints (D-3 / D-4) ──────────────────────────────────────────────

class PlaceOrderView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [OrderRateThrottle]

    def post(self, request):
        serializer = PlaceOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = PlaceOrderService().execute(
            table_token=data['table_token'],
            items=data['items'],
            payment_method=data.get('payment_method', ''),
            loyalty_token=data.get('loyalty_token'),
            redeem_loyalty=data.get('redeem_loyalty', False),
        )

        # Notify staff via WebSocket
        try:
            from apps.websocket.events import notify_staff, notify_guest
            notify_staff(str(session.restaurant_id), 'new_order', {
                'session_id': str(session.id),
                'table_number': session.table_number,
                'table_id': str(session.table_id) if session.table_id else None,
                'table_token': session.table_token,
                'items_count': session.items.count(),
            })
            notify_guest(data['table_token'], 'order_confirmed', {
                'session_id': str(session.id),
                'status': session.status,
            })
        except Exception:
            pass

        return Response(TableSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class PlaceDeliveryOrderView(APIView):
    """Guest — place a delivery or pickup order (no table involved)."""
    permission_classes = [AllowAny]
    throttle_classes = [OrderRateThrottle]

    def post(self, request):
        serializer = PlaceDeliveryOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = PlaceDeliveryOrderService().execute(
            restaurant_id=data['restaurant_id'],
            order_type=data['order_type'],
            customer_name=data['customer_name'],
            customer_phone=data['customer_phone'],
            delivery_address=data.get('delivery_address', ''),
            delivery_comment=data.get('delivery_comment', ''),
            payment_method=data.get('payment_method', ''),
            items=data['items'],
        )

        return Response(TableSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class SessionByTableView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, table_token):
        try:
            session = TableSession.objects.filter(
                table_token=table_token,
                status__in=['open', 'awaiting_payment', 'payment_requested'],
            ).latest('created_at')
        except TableSession.DoesNotExist:
            return Response(
                {'detail': 'Активная сессия не найдена.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(TableSessionSerializer(session).data)


class RequestPaymentView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, table_token):
        try:
            session = TableSession.objects.filter(
                table_token=table_token, status='open'
            ).latest('created_at')
        except TableSession.DoesNotExist:
            return Response(
                {'detail': 'Открытая сессия не найдена.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        session.status = 'awaiting_payment'
        session.save(update_fields=['status', 'updated_at'])

        try:
            from apps.websocket.events import notify_session_status
            notify_session_status(session)
        except Exception:
            pass

        return Response(TableSessionSerializer(session).data)


class GuestCancelItemView(APIView):
    """
    POST /api/v1/sessions/by-table/<table_token>/items/<item_id>/cancel/
    Public — table_token служит гостевым «ключом». Гость может отменить СВОЮ
    позицию, пока она ещё ждёт подтверждения официантом (awaiting_confirmation).
    Как только официант принял/отклонил позицию — отмена гостем запрещена.
    """
    permission_classes = [AllowAny]

    def post(self, request, table_token, item_id):
        item = get_object_or_404(
            SessionItem,
            id=item_id,
            session__table_token=table_token,
            session__status='open',
        )
        if item.status != 'awaiting_confirmation' or item.added_by != 'guest':
            return Response(
                {'detail': 'Эту позицию уже нельзя отменить.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        item.status = 'cancelled'
        item.save(update_fields=['status'])
        session = item.session
        session.recalculate_totals()
        session.refresh_from_db()

        try:
            from apps.websocket.events import notify_staff
            notify_staff(str(session.restaurant_id), 'item_status_changed', {
                'item_id': str(item.id),
                'session_id': str(session.id),
                'table_id': str(session.table_id) if session.table_id else None,
                'status': 'cancelled',
            })
        except Exception:
            pass

        return Response(TableSessionSerializer(session).data)


# ── Staff / Admin endpoints ───────────────────────────────────────────────────

class ActiveSessionListView(generics.ListAPIView):
    """D-8: All open sessions of a restaurant for staff view."""
    permission_classes = [IsRestaurantSessionStaff]
    serializer_class = TableSessionSerializer

    def get_queryset(self):
        queryset = TableSession.objects.filter(
            restaurant_id=self.kwargs['rest_id'],
            status__in=['open', 'awaiting_payment', 'payment_requested'],
            order_type='dine_in',
        )
        user = self.request.user
        if user.role == 'waiter' and (user.assigned_tables.exists() or user.assigned_zones.exists()):
            queryset = queryset.filter(table_id__in=user.effective_table_ids)
        return queryset.prefetch_related('items').order_by('-created_at')


class SessionItemUpdateView(APIView):
    """D-8: Update a single item's status with transition validation."""
    permission_classes = [IsRestaurantSessionStaff]

    def patch(self, request, rest_id, session_id, item_id):
        item = get_object_or_404(
            SessionItem,
            id=item_id,
            session_id=session_id,
            session__restaurant_id=rest_id,
        )
        if not _waiter_can_access_table(request.user, item.session.table_id):
            return Response({'detail': 'Этот стол не назначен официанту.'}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('status')
        if not new_status:
            return Response({'detail': 'status обязателен.'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.role == 'kitchen' and not _kitchen_transition_allowed(item.status, new_status):
            return Response(
                {'detail': 'Кухня может менять только confirmed → ready или ready → confirmed.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        allowed = VALID_TRANSITIONS.get(item.status, set())
        if new_status not in allowed:
            return Response(
                {'detail': f"Переход '{item.status}' → '{new_status}' недопустим."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        update_fields = ['status']
        item.status = new_status
        now = timezone.now()

        if new_status == 'confirmed':
            item.confirmed_at = now
            if request.user.role == 'waiter':
                item.confirmed_by = request.user
                update_fields.append('confirmed_by')
            update_fields.append('confirmed_at')
        elif new_status == 'ready':
            item.ready_at = now
            update_fields.append('ready_at')
        elif new_status == 'served':
            item.served_at = now
            if request.user.role == 'waiter':
                item.served_by = request.user
                update_fields.append('served_by')
            update_fields.append('served_at')
        elif new_status == 'rejected':
            item.rejected_at = now
            update_fields.append('rejected_at')

        item.save(update_fields=update_fields)

        # Пересчёт итогов: смена статуса меняет billable-состав счёта —
        # awaiting_confirmation/rejected/cancelled в счёт не входят, а
        # confirmed/ready/served входят (паритет с recalculate_totals /
        # frontend isBillable). Без этого подтверждение awaiting-позиции не
        # увеличивало бы сумму заказа.
        session = item.session
        session.recalculate_totals()

        # Notify via WebSocket (D-10) — graceful no-op if channels not configured
        try:
            from apps.websocket.events import notify_staff, notify_guest
            notify_staff(rest_id, 'item_status_changed', {
                'item_id': str(item.id),
                'session_id': str(session_id),
                'table_id': str(session.table_id) if session.table_id else None,
                'status': new_status,
            })
            if new_status == 'ready':
                notify_guest(session.table_token, 'item_ready', {
                    'item_id': str(item.id),
                    'item_name': item.item_name,
                })
        except Exception:
            pass

        return Response(SessionItemSerializer(item).data)


class CloseSessionView(APIView):
    """D-11: Close session (→ closed). Waiter allowed only if restaurant.allow_waiter_close."""
    permission_classes = [IsRestaurantSessionStaff]

    def post(self, request, rest_id, session_id):
        denied = _deny_kitchen(request.user, 'Кухня не может закрывать или оплачивать счёт.')
        if denied:
            return denied
        session = get_object_or_404(TableSession, id=session_id, restaurant_id=rest_id)

        if not _waiter_can_access_table(request.user, session.table_id):
            return Response({'detail': 'Этот стол не назначен официанту.'}, status=status.HTTP_403_FORBIDDEN)

        if request.user.role == 'waiter' and not session.restaurant.allow_waiter_close:
            return Response(
                {'detail': 'Официанту не разрешено закрывать сессии.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # A dine-in bill may only be closed after the payment flow has started.
        # This prevents accidental early close from stale admin/waiter UI state and
        # keeps analytics limited to genuinely completed bills.
        if session.order_type == 'dine_in' and session.status not in ('awaiting_payment', 'payment_requested'):
            return Response(
                {'detail': 'Сначала запросите оплату по этому счёту.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Never close a bill while it still contains unresolved guest items.
        # Otherwise an awaiting_confirmation item can disappear from the payable
        # total and the closed analytics snapshot becomes inconsistent.
        if session.items.filter(status='awaiting_confirmation').exists():
            return Response(
                {'detail': 'Сначала подтвердите или отклоните все позиции заказа.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment_method = request.data.get('payment_method') or session.payment_method
        if not payment_method:
            return Response(
                {'detail': 'Укажите способ оплаты перед закрытием счёта.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if payment_method not in dict(TableSession.PAYMENT_METHODS):
            return Response(
                {'detail': 'Недопустимый способ оплаты.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Recalculate immediately before close so the immutable closed-session
        # amount consumed by analytics matches the final billable item set.
        session.recalculate_totals()
        session.status = 'closed'
        session.closed_at = timezone.now()
        session.payment_method = payment_method
        session.save(update_fields=['status', 'closed_at', 'payment_method', 'updated_at'])
        from apps.loyalty.services import reward_closed_session
        reward_closed_session(session)

        try:
            from apps.websocket.events import notify_session_status
            notify_session_status(session)
        except Exception:
            pass

        return Response(TableSessionSerializer(session).data)


class RejectPaymentView(APIView):
    """D-11: Reject payment request (payment_requested → open). Cashier/manager only."""
    permission_classes = [IsRestaurantSessionStaff]

    def post(self, request, rest_id, session_id):
        denied = _deny_kitchen(request.user, 'Кухня не может управлять оплатой.')
        if denied:
            return denied
        session = get_object_or_404(TableSession, id=session_id, restaurant_id=rest_id)

        if request.user.role not in ('admin', 'manager', 'cashier'):
            return Response(
                {'detail': 'Только кассир, менеджер или администратор может отклонить оплату.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if session.status != 'payment_requested':
            return Response(
                {'detail': f"Сессия в статусе '{session.status}', ожидается 'payment_requested'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.status = 'open'
        session.save(update_fields=['status', 'updated_at'])

        try:
            from apps.websocket.events import notify_session_status
            notify_session_status(session)
        except Exception:
            pass

        return Response(TableSessionSerializer(session).data)


class SessionStatusUpdateView(APIView):
    """Staff can PATCH a session's status (e.g. open→payment_requested)."""
    permission_classes = [IsRestaurantSessionStaff]

    # Staff endpoint only advances the payment flow. Reopening a rejected
    # payment is intentionally handled by RejectPaymentView where roles are
    # restricted to admin/manager/cashier.
    VALID_TRANSITIONS = {
        'open': {'payment_requested'},
        'awaiting_payment': {'payment_requested'},
        'payment_requested': set(),
        'closed': set(),
    }

    def patch(self, request, rest_id, session_id):
        denied = _deny_kitchen(request.user, 'Кухня не может менять статус оплаты счёта.')
        if denied:
            return denied
        session = get_object_or_404(TableSession, id=session_id, restaurant_id=rest_id)
        if not _waiter_can_access_table(request.user, session.table_id):
            return Response({'detail': 'Этот стол не назначен официанту.'}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('status')
        if not new_status:
            return Response({'detail': 'status обязателен.'}, status=status.HTTP_400_BAD_REQUEST)
        allowed = self.VALID_TRANSITIONS.get(session.status, set())
        if new_status not in allowed:
            return Response(
                {'detail': f"Недопустимый переход '{session.status}' → '{new_status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session.status = new_status
        session.save(update_fields=['status', 'updated_at'])

        try:
            from apps.websocket.events import notify_session_status
            notify_session_status(session, new_status)
        except Exception:
            pass

        return Response(TableSessionSerializer(session).data)


class StaffPlaceOrderView(APIView):
    """Staff places a new order for a table (e.g. 'Новый заказ' in admin/waiter
    panel). Unlike the guest PlaceOrderView, items are created already
    sent_to_kitchen/sent_to_bar — no waiter-confirmation step needed since a
    staff member entered the order themselves."""
    permission_classes = [IsRestaurantSessionStaff]
    throttle_classes = [OrderRateThrottle]

    def post(self, request, rest_id):
        denied = _deny_kitchen(request.user, 'Кухня не может создавать заказы от имени персонала.')
        if denied:
            return denied
        serializer = PlaceOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        table = get_object_or_404(Table, token=data['table_token'], is_active=True, restaurant_id=rest_id)
        if not _waiter_can_access_table(request.user, table.id):
            return Response({'detail': 'Этот стол не назначен официанту.'}, status=status.HTTP_403_FORBIDDEN)

        session = PlaceOrderService().execute(
            table_token=data['table_token'],
            items=data['items'],
            payment_method=data.get('payment_method', ''),
            added_by='waiter',
        )

        try:
            from apps.websocket.events import notify_staff, notify_guest
            notify_staff(str(rest_id), 'new_order', {
                'session_id': str(session.id),
                'table_number': session.table_number,
                'table_id': str(session.table_id) if session.table_id else None,
                'table_token': session.table_token,
                'items_count': session.items.count(),
            })
            notify_guest(data['table_token'], 'order_confirmed', {
                'session_id': str(session.id),
                'status': session.status,
            })
        except Exception:
            pass

        return Response(TableSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class StaffAddItemsView(APIView):
    """Staff manually adds items to an existing open session (added_by='waiter')."""
    permission_classes = [IsRestaurantSessionStaff]

    def post(self, request, rest_id, session_id):
        denied = _deny_kitchen(request.user, 'Кухня не может добавлять позиции в счёт.')
        if denied:
            return denied
        session = get_object_or_404(
            TableSession,
            id=session_id,
            restaurant_id=rest_id,
            status__in=['open', 'awaiting_payment'],
        )

        if not _waiter_can_access_table(request.user, session.table_id):
            return Response({'detail': 'Этот стол не назначен официанту.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = StaffAddItemsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items_data = serializer.validated_data['items']

        menu_item_ids = [item['menu_item_id'] for item in items_data]
        db_items = {
            str(mi.id): mi
            for mi in MenuItem.objects.filter(id__in=menu_item_ids, restaurant_id=rest_id)
        }

        from rest_framework.exceptions import ValidationError as DRFValidationError
        for item in items_data:
            mi = db_items.get(str(item['menu_item_id']))
            if mi is None:
                raise DRFValidationError({'items': 'Одно или несколько блюд не найдено.'})
            if not mi.is_available:
                raise DRFValidationError({'items': f"Блюдо '{mi.name}' в стоп-листе."})

        # Staff-added items skip 'awaiting_confirmation' (официант уже ввёл их
        # сам) → сразу 'confirmed', кухня видит их немедленно. Legacy
        # sent_to_kitchen/sent_to_bar в canonical-модели нет (и они не проходят
        # VALID_TRANSITIONS при последующем 'ready').
        SessionItem.objects.bulk_create([
            SessionItem(
                session=session,
                menu_item=db_items[str(item['menu_item_id'])],
                item_name=db_items[str(item['menu_item_id'])].name,
                price=db_items[str(item['menu_item_id'])].final_price,
                quantity=item['quantity'],
                note=item.get('note', ''),
                preparation_station=db_items[str(item['menu_item_id'])].preparation_station,
                added_by='waiter',
                status='confirmed',
            )
            for item in items_data
        ])

        session.recalculate_totals()
        session.refresh_from_db()

        try:
            from apps.websocket.events import notify_staff
            notify_staff(str(rest_id), 'new_order', {
                'session_id': str(session.id),
                'table_number': session.table_number,
                'table_id': str(session.table_id) if session.table_id else None,
                'added_by': 'waiter',
            })
        except Exception:
            pass

        return Response(TableSessionSerializer(session).data, status=status.HTTP_201_CREATED)


# ── Delivery / pickup management (staff) ────────────────────────────────────

class DeliveryOrderListView(generics.ListAPIView):
    """Staff — list of delivery/pickup orders for a restaurant."""
    permission_classes = [IsRestaurantSessionStaff]
    serializer_class = TableSessionSerializer

    def get_queryset(self):
        if self.request.user.role == 'kitchen':
            return TableSession.objects.none()
        qs = (
            TableSession.objects
            .filter(restaurant_id=self.kwargs['rest_id'])
            .exclude(order_type='dine_in')
            .prefetch_related('items')
            .order_by('-created_at')
        )
        if self.request.query_params.get('active') == '1':
            qs = qs.exclude(delivery_status__in=['completed', 'cancelled'])
        return qs[:200]


class SessionDeliveryStatusUpdateView(APIView):
    """Staff — update the delivery/pickup status of an order with transition validation."""
    permission_classes = [IsRestaurantSessionStaff]

    def patch(self, request, rest_id, session_id):
        denied = _deny_kitchen(request.user, 'Кухня не может управлять доставкой или выдачей.')
        if denied:
            return denied
        session = get_object_or_404(TableSession, id=session_id, restaurant_id=rest_id)

        if session.order_type == 'dine_in':
            return Response(
                {'detail': 'Эта сессия не является заказом на доставку/самовывоз.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_status = request.data.get('delivery_status')
        if not new_status:
            return Response({'detail': 'delivery_status обязателен.'}, status=status.HTTP_400_BAD_REQUEST)

        allowed = DELIVERY_STATUS_TRANSITIONS.get(session.delivery_status, set())
        if new_status not in allowed:
            return Response(
                {'detail': f"Переход '{session.delivery_status}' → '{new_status}' недопустим."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.delivery_status = new_status
        update_fields = ['delivery_status', 'updated_at']

        if new_status in ('completed', 'cancelled'):
            session.status = 'closed'
            session.closed_at = timezone.now()
            update_fields += ['status', 'closed_at']

        session.save(update_fields=update_fields)

        try:
            from apps.websocket.events import notify_guest, notify_staff
            notify_guest(session.table_token, 'delivery_status_changed', {
                'session_id': str(session.id),
                'delivery_status': new_status,
            })
            notify_staff(rest_id, 'delivery_status_changed', {
                'session_id': str(session.id),
                'delivery_status': new_status,
            })
        except Exception:
            pass

        return Response(TableSessionSerializer(session).data)


class OperationsExceptionsView(APIView):
    """Unified, tenant-safe operational exceptions inbox.

    Deterministic only: durable SLA breaches, unresolved waiter calls, aged
    payment requests and guest items awaiting confirmation. No AI/external API.
    """
    permission_classes = [IsRestaurantSessionStaff]

    def get(self, request, rest_id):
        from datetime import timedelta
        from apps.calls.models import WaiterCall
        now = timezone.now()
        user = request.user
        table_ids = None
        if user.role == 'waiter' and (user.assigned_tables.exists() or user.assigned_zones.exists()):
            table_ids = set(user.effective_table_ids)

        rows = []
        def add(kind, severity, title, detail, created_at, **extra):
            rows.append({
                'id': extra.pop('id'), 'kind': kind, 'severity': severity,
                'title': title, 'detail': detail, 'created_at': created_at, **extra,
            })

        # Durable unresolved SLA breaches. Kitchen only needs preparation;
        # waiter only handoff. Managers see both.
        sla = SLAIncident.objects.filter(restaurant_id=rest_id, resolved_at__isnull=True).select_related('item','item__session')
        if user.role == 'kitchen': sla = sla.filter(kind='preparation')
        elif user.role == 'waiter': sla = sla.filter(kind='handoff')
        if table_ids is not None: sla = sla.filter(item__session__table_id__in=table_ids)
        for inc in sla:
            add('sla', 'critical', f'SLA просрочен · стол {inc.item.session.table_number}',
                inc.item.item_name, inc.breached_at, id=f'sla:{inc.id}',
                session_id=str(inc.item.session_id), table_number=inc.item.session.table_number,
                action='session')

        # Kitchen must not receive front-of-house/payment exceptions.
        if user.role != 'kitchen':
            calls = WaiterCall.objects.filter(restaurant_id=rest_id).exclude(status='closed')
            if table_ids is not None: calls = calls.filter(table_id__in=table_ids)
            for call in calls:
                add('call', 'critical' if call.status == 'new' else 'warning',
                    f'Вызов · стол {call.table_number}', call.reason or 'Гость вызывает официанта',
                    call.created_at, id=f'call:{call.id}', call_id=str(call.id),
                    table_number=call.table_number, action='calls')

            sessions = TableSession.objects.filter(restaurant_id=rest_id, status__in=['awaiting_payment','payment_requested'])
            if table_ids is not None: sessions = sessions.filter(table_id__in=table_ids)
            payment_cutoff = now - timedelta(minutes=5)
            for session in sessions.filter(updated_at__lte=payment_cutoff):
                mins = max(5, int((now-session.updated_at).total_seconds()//60))
                add('payment', 'critical' if mins >= 10 else 'warning',
                    f'Оплата ожидает · стол {session.table_number}', f'{mins} мин без завершения оплаты',
                    session.updated_at, id=f'payment:{session.id}', session_id=str(session.id),
                    table_number=session.table_number, action='session')

            awaiting = SessionItem.objects.filter(session__restaurant_id=rest_id, status='awaiting_confirmation', created_at__lte=now-timedelta(minutes=3)).select_related('session')
            if table_ids is not None: awaiting = awaiting.filter(session__table_id__in=table_ids)
            for item in awaiting:
                mins = max(3, int((now-item.created_at).total_seconds()//60))
                add('order', 'critical' if mins >= 7 else 'warning',
                    f'Заказ ждёт подтверждения · стол {item.session.table_number}',
                    f'{item.item_name} · {mins} мин', item.created_at, id=f'order:{item.id}',
                    session_id=str(item.session_id), table_number=item.session.table_number, action='session')

        # Persist first-seen/ownership timing and automatically resolve only when
        # the underlying operational condition disappears from this tenant queue.
        from .models import OperationalExceptionState
        active_keys = {row['id'] for row in rows}
        existing = {s.exception_key: s for s in OperationalExceptionState.objects.filter(restaurant_id=rest_id, exception_key__in=active_keys)}
        for row in rows:
            state = existing.get(row['id'])
            if state is None:
                state = OperationalExceptionState.objects.create(restaurant_id=rest_id, exception_key=row['id'], kind=row['kind'], first_seen_at=row['created_at'])
            elif state.resolved_at is not None:
                state.resolved_at = None; state.acknowledged_at = None; state.acknowledged_by = None
                state.first_seen_at = row['created_at']; state.save(update_fields=['resolved_at','acknowledged_at','acknowledged_by','first_seen_at','updated_at'])
            row['acknowledged_at'] = state.acknowledged_at
            row['acknowledged_by'] = ({'id': str(state.acknowledged_by_id), 'name': state.acknowledged_by.get_full_name() or state.acknowledged_by.username} if state.acknowledged_by_id else None)
            row['response_minutes'] = (round((state.acknowledged_at-state.first_seen_at).total_seconds()/60, 1) if state.acknowledged_at else None)
        OperationalExceptionState.objects.filter(restaurant_id=rest_id, resolved_at__isnull=True).exclude(exception_key__in=active_keys).update(resolved_at=now)

        rank = {'critical': 0, 'warning': 1}
        rows.sort(key=lambda x: (rank.get(x['severity'], 9), x['created_at']))
        counts = {'total': len(rows), 'critical': sum(x['severity']=='critical' for x in rows),
                  'warning': sum(x['severity']=='warning' for x in rows), 'acknowledged': sum(bool(x['acknowledged_at']) for x in rows)}
        return Response({'counts': counts, 'exceptions': rows[:100], 'generated_at': now})

    def post(self, request, rest_id):
        from .models import OperationalExceptionState
        key = str(request.data.get('exception_key') or '')
        action = request.data.get('action')
        if action not in ('acknowledge', 'unassign') or not key:
            return Response({'detail': 'exception_key и корректный action обязательны.'}, status=status.HTTP_400_BAD_REQUEST)
        visible = {row['id'] for row in self.get(request, rest_id).data.get('exceptions', [])}
        if key not in visible:
            return Response({'detail': 'Проблема недоступна для вашей роли или уже закрыта.'}, status=status.HTTP_404_NOT_FOUND)
        state = get_object_or_404(OperationalExceptionState, restaurant_id=rest_id, exception_key=key, resolved_at__isnull=True)
        if action == 'acknowledge':
            if state.acknowledged_by_id and state.acknowledged_by_id != request.user.id and request.user.role not in ('admin','manager'):
                return Response({'detail': 'Проблема уже взята другим сотрудником.'}, status=status.HTTP_409_CONFLICT)
            if not state.acknowledged_at: state.acknowledged_at = timezone.now()
            state.acknowledged_by = request.user
            state.save(update_fields=['acknowledged_at','acknowledged_by','updated_at'])
        else:
            if state.acknowledged_by_id not in (None, request.user.id) and request.user.role not in ('admin','manager'):
                return Response({'detail': 'Снять другого ответственного может только менеджер.'}, status=status.HTTP_403_FORBIDDEN)
            state.acknowledged_at = None; state.acknowledged_by = None
            state.save(update_fields=['acknowledged_at','acknowledged_by','updated_at'])
        return Response({'exception_key': key, 'acknowledged_at': state.acknowledged_at, 'acknowledged_by': str(state.acknowledged_by_id) if state.acknowledged_by_id else None})


class ServiceRecoveryView(APIView):
    """Admin/Manager CRUD for factual guest recovery notes; no AI inference."""
    permission_classes = [IsRestaurantAdmin]

    def _session(self, rest_id, session_id):
        return get_object_or_404(TableSession, id=session_id, restaurant_id=rest_id)

    def get(self, request, rest_id, session_id):
        from .models import ServiceRecoveryNote
        self._session(rest_id, session_id)
        qs = ServiceRecoveryNote.objects.filter(restaurant_id=rest_id, session_id=session_id).select_related('created_by').order_by('-created_at')
        return Response([self._row(x) for x in qs])

    def post(self, request, rest_id, session_id):
        from decimal import Decimal, InvalidOperation
        from .models import ServiceRecoveryNote
        session = self._session(rest_id, session_id)
        reason = str(request.data.get('reason') or '')
        note = str(request.data.get('note') or '').strip()
        ctype = str(request.data.get('compensation_type') or '').strip()[:50]
        try: amount = Decimal(str(request.data.get('compensation_amount') or '0'))
        except InvalidOperation: return Response({'compensation_amount':['Некорректная сумма.']}, status=400)
        valid = {x[0] for x in ServiceRecoveryNote.REASONS}
        if reason not in valid: return Response({'reason':['Выберите корректную причину.']}, status=400)
        if not note: return Response({'note':['Опишите фактическую причину/действие.']}, status=400)
        if len(note) > 1000: return Response({'note':['Максимум 1000 символов.']}, status=400)
        if amount < 0: return Response({'compensation_amount':['Сумма не может быть отрицательной.']}, status=400)
        source_type = str(request.data.get('source_type') or '')
        source_id = str(request.data.get('source_id') or '')
        source_exception = source_sla = None
        if source_type or source_id:
            if not source_type or not source_id:
                return Response({'source':['Укажите тип и источник проблемы.']}, status=400)
            if source_type == 'sla':
                source_sla = get_object_or_404(SLAIncident, id=source_id, restaurant_id=rest_id, item__session=session)
            elif source_type == 'exception':
                source_exception = get_object_or_404(OperationalExceptionState, id=source_id, restaurant_id=rest_id)
                item_ids = {str(i) for i in session.items.values_list('id', flat=True)}
                key = source_exception.exception_key
                if not (key == f'payment:{session.id}' or any(key == f'order:{iid}' for iid in item_ids)):
                    return Response({'source':['Источник не относится к этой сессии.']}, status=400)
            else:
                return Response({'source':['Неизвестный тип источника.']}, status=400)
        obj = ServiceRecoveryNote.objects.create(restaurant_id=rest_id, session=session, reason=reason, note=note, compensation_type=ctype, compensation_amount=amount, created_by=request.user, source_exception=source_exception, source_sla_incident=source_sla)
        return Response(self._row(obj), status=201)

    @staticmethod
    def _row(x):
        return {'id':str(x.id),'reason':x.reason,'note':x.note,'compensation_type':x.compensation_type,'compensation_amount':str(x.compensation_amount),'created_at':x.created_at,'created_by':(x.created_by.get_full_name() or x.created_by.username) if x.created_by else None,'source_type':'sla' if x.source_sla_incident_id else ('exception' if x.source_exception_id else None),'source_id':str(x.source_sla_incident_id or x.source_exception_id) if (x.source_sla_incident_id or x.source_exception_id) else None}


class ServiceRecoveryDetailView(ServiceRecoveryView):
    def delete(self, request, rest_id, session_id, recovery_id):
        from .models import ServiceRecoveryNote
        self._session(rest_id, session_id)
        obj=get_object_or_404(ServiceRecoveryNote,id=recovery_id,restaurant_id=rest_id,session_id=session_id)
        obj.delete(); return Response(status=204)


class SessionOperationsTimelineView(APIView):
    """Deterministic audit timeline for one table session.

    Derived from authoritative lifecycle timestamps and durable SLA/exception
    records; no AI and no duplicated event store. Kitchen receives only
    preparation events, while front-of-house staff receive the full timeline.
    """
    permission_classes = [IsRestaurantSessionStaff]

    def get(self, request, rest_id, session_id):
        from apps.calls.models import WaiterCall
        from .models import OperationalExceptionState
        session = get_object_or_404(
            TableSession.objects.prefetch_related('items'), id=session_id, restaurant_id=rest_id
        )
        # Assigned waiters may inspect only their effective tables.
        if request.user.role == 'waiter' and (request.user.assigned_tables.exists() or request.user.assigned_zones.exists()):
            if session.table_id not in set(request.user.effective_table_ids):
                return Response({'detail': 'Сессия недоступна для назначенных столов.'}, status=status.HTTP_403_FORBIDDEN)

        events = []
        def add(at, kind, title, detail='', severity='info', item_id=None):
            if at:
                events.append({'at': at, 'kind': kind, 'title': title, 'detail': detail,
                               'severity': severity, 'item_id': str(item_id) if item_id else None})

        add(session.created_at, 'session', 'Счёт открыт', f'Стол {session.table_number or "—"}')
        for item in session.items.all():
            if request.user.role != 'kitchen':
                add(item.created_at, 'order', 'Позиция добавлена', f'{item.item_name} ×{item.quantity}', item_id=item.id)
                add(item.confirmed_at, 'confirmed', 'Заказ подтверждён', item.item_name, item_id=item.id)
                add(item.rejected_at, 'rejected', 'Позиция отклонена', item.item_name, 'warning', item.id)
            elif item.confirmed_at:
                add(item.confirmed_at, 'confirmed', 'Принято кухней', item.item_name, item_id=item.id)
            add(item.ready_at, 'ready', 'Готово', item.item_name, item_id=item.id)
            if request.user.role != 'kitchen':
                add(item.served_at, 'served', 'Подано гостю', item.item_name, item_id=item.id)

        incidents = SLAIncident.objects.filter(restaurant_id=rest_id, item__session=session).select_related('item')
        if request.user.role == 'kitchen': incidents = incidents.filter(kind='preparation')
        for inc in incidents:
            add(inc.breached_at, 'sla_breach', 'SLA просрочен', f'{inc.item.item_name} · лимит {inc.target_minutes} мин', 'critical', inc.item_id)
            add(inc.resolved_at, 'sla_resolved', 'SLA восстановлен', inc.item.item_name, 'success', inc.item_id)

        if request.user.role != 'kitchen':
            for call in WaiterCall.objects.filter(restaurant_id=rest_id, table_token=session.table_token, created_at__gte=session.created_at).order_by('created_at'):
                add(call.created_at, 'call', 'Вызов официанта', call.reason or 'Без комментария', 'warning')
                if call.status == 'closed': add(call.updated_at, 'call_closed', 'Вызов закрыт', '', 'success')
            # Exception ownership events are included only when the key can be
            # proven to belong to this session/item.
            item_ids = {str(i.id) for i in session.items.all()}
            states = OperationalExceptionState.objects.filter(restaurant_id=rest_id)
            for state in states:
                key = state.exception_key
                belongs = key == f'payment:{session.id}' or any(key.startswith(f'order:{iid}') for iid in item_ids)
                if not belongs: continue
                who = state.acknowledged_by.get_full_name() or state.acknowledged_by.username if state.acknowledged_by_id else ''
                add(state.acknowledged_at, 'exception_ack', 'Проблема взята в работу', who)
                add(state.resolved_at, 'exception_resolved', 'Проблема устранена', '', 'success')
            if session.status in ('awaiting_payment','payment_requested','closed'):
                # updated_at is authoritative only for the current payment state;
                # do not invent historical payment timestamps that are not stored.
                if session.status != 'closed': add(session.updated_at, 'payment', 'Ожидание оплаты')
            add(session.closed_at, 'closed', 'Счёт закрыт', f'{session.total_amount} ₸', 'success')

        if request.user.role != 'kitchen':
            from .models import ServiceRecoveryNote
            for recovery in ServiceRecoveryNote.objects.filter(restaurant_id=rest_id, session=session):
                detail = recovery.note + (f' · {recovery.compensation_type}: {recovery.compensation_amount} ₸' if recovery.compensation_amount else '')
                add(recovery.created_at, 'service_recovery', 'Восстановление сервиса', detail, 'success')

        events.sort(key=lambda e: e['at'])

        # Table service quality summary: deterministic timings only. Missing
        # lifecycle timestamps stay null instead of being guessed from updated_at.
        items = list(session.items.all())
        def avg_minutes(pairs):
            values = [max(0, (end - start).total_seconds() / 60) for start, end in pairs if start and end and end >= start]
            return round(sum(values) / len(values), 1) if values else None

        confirm_pairs = [(i.created_at, i.confirmed_at) for i in items if i.added_by == 'guest']
        prep_pairs = [(i.confirmed_at, i.ready_at) for i in items]
        handoff_pairs = [(i.ready_at, i.served_at) for i in items]
        completed = sum(bool(i.served_at) for i in items)
        rejected = sum(i.status == 'rejected' for i in items)
        sla_qs = SLAIncident.objects.filter(restaurant_id=rest_id, item__session=session)
        if request.user.role == 'kitchen':
            sla_qs = sla_qs.filter(kind='preparation')
            quality = {
                'scope': 'kitchen',
                'items_total': len(items),
                'items_completed': sum(bool(i.ready_at) for i in items),
                'avg_confirm_to_ready_minutes': avg_minutes(prep_pairs),
                'sla_breaches': sla_qs.count(),
            }
        else:
            calls_qs = WaiterCall.objects.filter(
                restaurant_id=rest_id, table_token=session.table_token, created_at__gte=session.created_at
            )
            item_ids = [str(i.id) for i in items]
            exception_states = OperationalExceptionState.objects.filter(restaurant_id=rest_id)
            exception_count = 0
            for state in exception_states.only('exception_key'):
                key = state.exception_key
                if key == f'payment:{session.id}' or any(key.startswith(f'order:{iid}') for iid in item_ids):
                    exception_count += 1
            service_end = session.closed_at or timezone.now()
            quality = {
                'scope': 'full',
                'items_total': len(items),
                'items_completed': completed,
                'items_rejected': rejected,
                'avg_order_to_confirm_minutes': avg_minutes(confirm_pairs),
                'avg_confirm_to_ready_minutes': avg_minutes(prep_pairs),
                'avg_ready_to_served_minutes': avg_minutes(handoff_pairs),
                'service_duration_minutes': round(max(0, (service_end - session.created_at).total_seconds() / 60), 1),
                'sla_breaches': sla_qs.count(),
                'waiter_calls': calls_qs.count(),
                'operational_exceptions': exception_count,
                'is_closed': bool(session.closed_at),
            }
        recovery_sources = []
        if request.user.role != 'kitchen':
            for inc in SLAIncident.objects.filter(restaurant_id=rest_id, item__session=session).select_related('item'):
                recovery_sources.append({'type':'sla','id':str(inc.id),'label':f'SLA · {inc.item.item_name}','at':inc.breached_at})
            item_ids = {str(i.id) for i in items}
            for state in OperationalExceptionState.objects.filter(restaurant_id=rest_id):
                key = state.exception_key
                if key == f'payment:{session.id}' or any(key == f'order:{iid}' for iid in item_ids):
                    recovery_sources.append({'type':'exception','id':str(state.id),'label':('Оплата' if key.startswith('payment:') else 'Подтверждение заказа'),'at':state.first_seen_at})
            recovery_sources.sort(key=lambda x:x['at'], reverse=True)
        return Response({'session_id': str(session.id), 'table_number': session.table_number, 'quality_summary': quality, 'recovery_sources': recovery_sources, 'events': events})


class SLAIncidentListView(APIView):
    """Current SLA warnings/breaches plus recent durable breach history.

    The endpoint is intentionally deterministic and cheap enough for operational
    polling. 80% of target is a warning; only >=100% is persisted as a breach.
    Kitchen sees preparation only, Waiter handoff only, Admin/Manager both.
    """
    permission_classes = [IsRestaurantSessionStaff]

    def get(self, request, rest_id):
        from datetime import timedelta
        from apps.restaurants.models import Restaurant
        restaurant = get_object_or_404(Restaurant, id=rest_id)
        now = timezone.now()
        active = SessionItem.objects.filter(
            session__restaurant_id=rest_id,
            session__status__in=['open', 'awaiting_payment', 'payment_requested'],
        ).select_related('session')
        if request.user.role == 'waiter' and (request.user.assigned_tables.exists() or request.user.assigned_zones.exists()):
            active = active.filter(session__table_id__in=request.user.effective_table_ids)

        alerts, open_keys = [], set()
        for item in active.iterator():
            # Preparation: confirmed and not ready yet.
            if item.status == 'confirmed' and item.confirmed_at:
                station = (item.preparation_station or 'kitchen').lower()
                target = restaurant.bar_sla_minutes if station == 'bar' else restaurant.kitchen_sla_minutes
                elapsed = max(0, (now - item.confirmed_at).total_seconds() / 60)
                if elapsed >= target * .8 and request.user.role != 'waiter':
                    severity = 'overdue' if elapsed >= target else 'warning'
                    alerts.append(self._payload(item, 'preparation', station, target, elapsed, severity))
                    if severity == 'overdue':
                        open_keys.add((item.id, 'preparation'))
                        SLAIncident.objects.get_or_create(
                            restaurant=restaurant, item=item, kind='preparation',
                            defaults={'station': station, 'target_minutes': target, 'breached_at': item.confirmed_at + timedelta(minutes=target)},
                        )
            # Handoff: ready and not served yet.
            if item.status == 'ready' and item.ready_at:
                target = restaurant.ready_to_served_sla_minutes
                elapsed = max(0, (now - item.ready_at).total_seconds() / 60)
                if elapsed >= target * .8 and request.user.role != 'kitchen':
                    severity = 'overdue' if elapsed >= target else 'warning'
                    alerts.append(self._payload(item, 'handoff', item.preparation_station or '', target, elapsed, severity))
                    if severity == 'overdue':
                        open_keys.add((item.id, 'handoff'))
                        SLAIncident.objects.get_or_create(
                            restaurant=restaurant, item=item, kind='handoff',
                            defaults={'station': item.preparation_station or '', 'target_minutes': target, 'breached_at': item.ready_at + timedelta(minutes=target)},
                        )

        # Resolve breaches that are no longer currently overdue. This also makes
        # the incident history useful for Owner analytics without a cron worker.
        for incident in SLAIncident.objects.filter(restaurant=restaurant, resolved_at__isnull=True):
            if (incident.item_id, incident.kind) not in open_keys:
                incident.resolved_at = now
                incident.save(update_fields=['resolved_at'])

        alerts.sort(key=lambda x: (x['severity'] != 'overdue', -x['elapsed_minutes']))
        history = SLAIncident.objects.filter(restaurant=restaurant).select_related('item','item__session').order_by('-breached_at')
        if request.user.role == 'kitchen': history = history.filter(kind='preparation')
        elif request.user.role == 'waiter': history = history.filter(kind='handoff')
        return Response({'alerts': alerts, 'history': [self._history(i) for i in history[:50]]})

    @staticmethod
    def _payload(item, kind, station, target, elapsed, severity):
        return {'item_id': str(item.id), 'session_id': str(item.session_id), 'table_number': item.session.table_number,
                'item_name': item.item_name, 'kind': kind, 'station': station, 'target_minutes': target,
                'elapsed_minutes': round(elapsed, 1), 'severity': severity}

    @staticmethod
    def _history(i):
        return {'id': str(i.id), 'item_id': str(i.item_id), 'session_id': str(i.item.session_id), 'table_number': i.item.session.table_number,
                'item_name': i.item.item_name, 'kind': i.kind, 'station': i.station,
                'target_minutes': i.target_minutes, 'breached_at': i.breached_at,
                'resolved_at': i.resolved_at}
