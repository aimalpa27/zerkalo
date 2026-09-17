import secrets

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from apps.menu.models import MenuItem
from apps.restaurants.models import Restaurant
from apps.tables.models import Table
from .models import SessionItem, TableSession


class PlaceOrderService:
    def execute(self, table_token: str, items: list, payment_method: str, added_by: str = 'guest') -> TableSession:
        table = get_object_or_404(Table, token=table_token, is_active=True)

        # Validate and prefetch menu items in one query (outside the lock —
        # read-only, no need to hold the row-level lock for this)
        menu_item_ids = [item['menu_item_id'] for item in items]
        db_items = {
            str(mi.id): mi
            for mi in MenuItem.objects.filter(
                id__in=menu_item_ids,
                restaurant=table.restaurant,
            )
        }

        for item in items:
            mi = db_items.get(str(item['menu_item_id']))
            if mi is None:
                raise ValidationError({'items': 'Одно или несколько блюд не найдено.'})
            if not mi.is_available:
                raise ValidationError({'items': f"Блюдо '{mi.name}' недоступно (стоп-лист)."})

        # FIX: wrap get-or-create + bulk_create in an atomic block with
        # select_for_update so concurrent double-taps / two guests at the same
        # table cannot produce duplicate open sessions (race condition).
        with transaction.atomic():
            # Lock the TABLE row, not only an existing session row.
            # select_for_update() on TableSession cannot protect the "no session"
            # case: two concurrent first orders can both see no row and each create
            # a separate open session. The table always exists, so locking it
            # serializes session creation per physical table. Re-check is_active
            # under the lock as well, so a QR disabled during checkout cannot place
            # a new order.
            locked_table = (
                Table.objects
                .select_for_update()
                .select_related('restaurant')
                .filter(id=table.id, token=table_token, is_active=True)
                .first()
            )
            if locked_table is None:
                raise ValidationError({'table_token': 'Стол отключён или QR-код устарел.'})

            active_session = (
                TableSession.objects
                .filter(
                    table=locked_table,
                    status__in=['open', 'awaiting_payment', 'payment_requested'],
                )
                .order_by('-created_at')
                .first()
            )

            if active_session is not None and active_session.status != 'open':
                raise ValidationError({
                    'table_token': (
                        'По этому столу уже запрошена оплата. '
                        'Дождитесь закрытия текущего счёта перед новым заказом.'
                    )
                })

            session = active_session
            if session is None:
                session = TableSession.objects.create(
                    restaurant=locked_table.restaurant,
                    table=locked_table,
                    table_number=locked_table.number,
                    table_token=table_token,
                    service_charge_percent=locked_table.restaurant.service_charge_percent,
                    payment_method=payment_method or '',
                )

            # D-order: гость ждёт подтверждения официантом только если у ресторана
            # включён флаг order_confirmation_enabled (по умолчанию OFF — поведение
            # прода без флага не меняется). Официант/стафф (NewOrderModal) всегда
            # создаёт позиции сразу подтверждёнными ('confirmed' → кухня видит их
            # немедленно, минуя шаг подтверждения).
            if added_by == 'guest' and table.restaurant.order_confirmation_enabled:
                initial_status = 'awaiting_confirmation'
            else:
                initial_status = 'confirmed'

            SessionItem.objects.bulk_create([
                SessionItem(
                    session=session,
                    menu_item=db_items[str(item['menu_item_id'])],
                    item_name=db_items[str(item['menu_item_id'])].name,
                    price=db_items[str(item['menu_item_id'])].final_price,
                    quantity=item['quantity'],
                    note=item.get('note', ''),
                    preparation_station=db_items[str(item['menu_item_id'])].preparation_station,
                    added_by=added_by,
                    status=initial_status,
                )
                for item in items
            ])

            session.recalculate_totals()
        # refresh outside the lock — recalculate_totals already saved the row
        session.refresh_from_db()

        # D-10: notify staff via WebSocket (graceful no-op if channels not running)
        try:
            from apps.websocket.events import notify_staff, notify_guest
            notify_staff(str(table.restaurant_id), 'new_order', {
                'session_id': str(session.id),
                'table_number': session.table_number,
                'table_id': str(session.table_id) if session.table_id else None,
            })
            notify_guest(table_token, 'order_confirmed', {
                'session_id': str(session.id),
            })
        except Exception:
            pass

        return session


class PlaceDeliveryOrderService:
    """Размещает заказ на доставку или самовывоз (без привязки к столу)."""

    def execute(
        self,
        restaurant_id,
        order_type: str,
        customer_name: str,
        customer_phone: str,
        delivery_address: str,
        delivery_comment: str,
        payment_method: str,
        items: list,
    ) -> TableSession:
        restaurant = get_object_or_404(Restaurant, id=restaurant_id)

        if not restaurant.has_feature('delivery'):
            raise ValidationError({'detail': 'Доставка и самовывоз недоступны для этого заведения.'})

        menu_item_ids = [item['menu_item_id'] for item in items]
        db_items = {
            str(mi.id): mi
            for mi in MenuItem.objects.filter(id__in=menu_item_ids, restaurant=restaurant)
        }

        for item in items:
            mi = db_items.get(str(item['menu_item_id']))
            if mi is None:
                raise ValidationError({'items': 'Одно или несколько блюд не найдено.'})
            if not mi.is_available:
                raise ValidationError({'items': f"Блюдо '{mi.name}' недоступно (стоп-лист)."})

        subtotal = sum(
            db_items[str(item['menu_item_id'])].final_price * item['quantity']
            for item in items
        )

        delivery_fee = 0
        if order_type == 'delivery':
            min_order = restaurant.delivery_min_order or 0
            if min_order and subtotal < min_order:
                raise ValidationError({
                    'items': f'Минимальная сумма заказа для доставки — {min_order} ₸.',
                })
            delivery_fee = restaurant.delivery_fee or 0

        with transaction.atomic():
            session = TableSession.objects.create(
                restaurant=restaurant,
                table=None,
                table_number=None,
                table_token=secrets.token_urlsafe(16),
                order_type=order_type,
                customer_name=customer_name,
                customer_phone=customer_phone,
                delivery_address=delivery_address,
                delivery_comment=delivery_comment,
                delivery_fee=delivery_fee,
                delivery_status='new',
                service_charge_percent=0,
                payment_method=payment_method or '',
            )

            SessionItem.objects.bulk_create([
                SessionItem(
                    session=session,
                    menu_item=db_items[str(item['menu_item_id'])],
                    item_name=db_items[str(item['menu_item_id'])].name,
                    price=db_items[str(item['menu_item_id'])].final_price,
                    quantity=item['quantity'],
                    note=item.get('note', ''),
                    preparation_station=db_items[str(item['menu_item_id'])].preparation_station,
                    added_by='guest',
                )
                for item in items
            ])

            session.recalculate_totals()
        session.refresh_from_db()

        try:
            from apps.websocket.events import notify_staff, notify_guest
            notify_staff(str(restaurant.id), 'new_order', {
                'session_id': str(session.id),
                'order_type': session.order_type,
                'table_token': session.table_token,
            })
            notify_guest(session.table_token, 'order_confirmed', {
                'session_id': str(session.id),
                'status': session.status,
            })
        except Exception:
            pass

        return session
