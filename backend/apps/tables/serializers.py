from rest_framework import serializers

from apps.tables.models import Table
from apps.zones.models import Zone


class TableSerializer(serializers.ModelSerializer):
    qr_url = serializers.CharField(read_only=True)
    zone = serializers.PrimaryKeyRelatedField(
        queryset=Zone.objects.all(), required=False, allow_null=True,
    )

    class Meta:
        model = Table
        fields = ['id', 'number', 'token', 'is_active', 'zone', 'qr_url', 'created_at']
        read_only_fields = ['id', 'token', 'qr_url', 'created_at']

    def validate_zone(self, value):
        if value is None:
            return value
        view = self.context.get('view')
        rest_id = view.kwargs.get('rest_id') if view else None
        if rest_id and str(value.restaurant_id) != str(rest_id):
            raise serializers.ValidationError('Зона принадлежит другому ресторану.')
        return value
