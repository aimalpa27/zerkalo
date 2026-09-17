from rest_framework import serializers

from apps.calls.models import WaiterCall


class WaiterCallSerializer(serializers.ModelSerializer):
    # FIX: max_length prevents oversized token strings being sent to this
    # public (AllowAny) endpoint. Without a limit, any string of arbitrary
    # length would be stored in the table_token field.
    table_token = serializers.CharField(write_only=True, max_length=128)

    class Meta:
        model = WaiterCall
        fields = [
            'id', 'table_number', 'table_token',
            'status', 'reason', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'table_number', 'status', 'created_at', 'updated_at']

    def validate_reason(self, value):
        # FIX: limit reason text length to prevent large payloads on a
        # public endpoint (WaiterCallRateThrottle is 10/min per token but
        # an unbounded string could still cause storage issues)
        if value and len(value) > 200:
            raise serializers.ValidationError(
                'Причина вызова не может быть длиннее 200 символов.'
            )
        return value


# Status transitions allowed for staff updating a waiter call.
CALL_VALID_TRANSITIONS = {
    'new': {'accepted', 'closed'},
    'accepted': {'closed'},
    'closed': set(),
}


class WaiterCallStatusUpdateSerializer(serializers.ModelSerializer):
    """
    FIX: WaiterCallSerializer marks `status` as read-only, so
    WaiterCallUpdateView (PATCH /waiter-calls/<id>/) silently accepted
    {"status": "accepted"} requests with a 200 OK but never changed the
    call's status — staff could never mark a call as accepted/closed.
    This serializer is used only for that update endpoint and makes
    `status` writable, validated against CALL_VALID_TRANSITIONS.
    """

    class Meta:
        model = WaiterCall
        fields = ['id', 'table_number', 'status', 'reason', 'created_at', 'updated_at']
        read_only_fields = ['id', 'table_number', 'reason', 'created_at', 'updated_at']

    def validate_status(self, value):
        allowed = CALL_VALID_TRANSITIONS.get(self.instance.status, set())
        if value not in allowed:
            raise serializers.ValidationError(
                f"Переход '{self.instance.status}' → '{value}' недопустим."
            )
        return value
