from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.menu.models import MenuItem
from apps.tables.models import Table
from apps.users.permissions import IsRestaurantSessionStaff
from apps.users.throttles import OrderRateThrottle
from .models import SessionItem, TableSession
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
            update_fields.append('confirmed_at')
        elif new_status == 'ready':
            item.ready_at = now
            update_fields.append('ready_at')
        elif new_status == 'served':
            item.served_at = now
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
