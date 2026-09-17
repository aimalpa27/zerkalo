from rest_framework import serializers

from apps.sessions.models import SessionItem, TableSession

# FIX: hard cap on the number of items per order to prevent a guest from
# submitting 10 000 items in one request and triggering massive DB inserts.
_MAX_ITEMS_PER_ORDER = 50


class SessionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionItem
        fields = [
            'id', 'item_name', 'price', 'quantity', 'status',
            'preparation_station', 'note', 'added_by',
            'created_at', 'ready_at', 'served_at',
        ]
        read_only_fields = ['id', 'created_at']


class TableSessionSerializer(serializers.ModelSerializer):
    items = SessionItemSerializer(many=True, read_only=True)

    class Meta:
        model = TableSession
        fields = [
            'id', 'table_number', 'table_token', 'order_type', 'status', 'items',
            'subtotal_amount', 'service_charge_percent',
            'service_charge_amount', 'delivery_fee', 'total_amount',
            'payment_method',
            'customer_name', 'customer_phone',
            'delivery_address', 'delivery_comment', 'delivery_status',
            'created_at', 'updated_at', 'closed_at',
        ]
        read_only_fields = [
            'id', 'table_token', 'order_type', 'subtotal_amount', 'service_charge_amount',
            'delivery_fee', 'total_amount', 'created_at', 'updated_at',
        ]


class PlaceDeliveryOrderItemSerializer(serializers.Serializer):
    menu_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, max_value=99)
    note = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        max_length=500,
    )


class PlaceDeliveryOrderSerializer(serializers.Serializer):
    restaurant_id = serializers.UUIDField()
    order_type = serializers.ChoiceField(choices=[('delivery', 'Доставка'), ('pickup', 'Самовывоз')])
    customer_name = serializers.CharField(max_length=255)
    customer_phone = serializers.CharField(max_length=32)
    delivery_address = serializers.CharField(required=False, allow_blank=True, default='', max_length=1000)
    delivery_comment = serializers.CharField(required=False, allow_blank=True, default='', max_length=500)
    payment_method = serializers.ChoiceField(
        choices=TableSession.PAYMENT_METHODS,
        required=False,
        allow_blank=True,
        default='',
    )
    items = PlaceDeliveryOrderItemSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('Список блюд не может быть пустым.')
        if len(value) > _MAX_ITEMS_PER_ORDER:
            raise serializers.ValidationError(
                f'Нельзя добавить более {_MAX_ITEMS_PER_ORDER} позиций за один раз.'
            )
        return value

    def validate(self, attrs):
        if attrs['order_type'] == 'delivery' and not attrs.get('delivery_address', '').strip():
            raise serializers.ValidationError({'delivery_address': 'Укажите адрес доставки.'})
        if not attrs.get('customer_name', '').strip():
            raise serializers.ValidationError({'customer_name': 'Укажите имя.'})
        if not attrs.get('customer_phone', '').strip():
            raise serializers.ValidationError({'customer_phone': 'Укажите номер телефона.'})
        return attrs


class PlaceOrderItemSerializer(serializers.Serializer):
    menu_item_id = serializers.UUIDField()
    # FIX: cap quantity per line so a guest cannot order 99999 of one item
    quantity = serializers.IntegerField(min_value=1, max_value=99)
    # FIX: max_length prevents excessively long notes from being stored
    note = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        max_length=500,
    )


class PlaceOrderSerializer(serializers.Serializer):
    # FIX: max_length prevents oversized token strings
    table_token = serializers.CharField(max_length=128)
    payment_method = serializers.ChoiceField(
        choices=TableSession.PAYMENT_METHODS,
        required=False,
        allow_blank=True,
        default='',
    )
    items = PlaceOrderItemSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('Список блюд не может быть пустым.')
        # FIX: prevent oversized bulk inserts
        if len(value) > _MAX_ITEMS_PER_ORDER:
            raise serializers.ValidationError(
                f'Нельзя добавить более {_MAX_ITEMS_PER_ORDER} позиций за один раз.'
            )
        return value


class StaffAddItemsSerializer(serializers.Serializer):
    items = PlaceOrderItemSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('Список блюд не может быть пустым.')
        if len(value) > _MAX_ITEMS_PER_ORDER:
            raise serializers.ValidationError(
                f'Нельзя добавить более {_MAX_ITEMS_PER_ORDER} позиций за один раз.'
            )
        return value
