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


class BulkTableCreateSerializer(serializers.Serializer):
    start = serializers.IntegerField(min_value=1, max_value=9999)
    end = serializers.IntegerField(min_value=1, max_value=9999)
    zone = serializers.PrimaryKeyRelatedField(
        queryset=Zone.objects.all(), required=False, allow_null=True,
    )

    def validate(self, attrs):
        if attrs['end'] < attrs['start']:
            raise serializers.ValidationError({'end': 'Конечный номер не может быть меньше начального.'})
        count = attrs['end'] - attrs['start'] + 1
        if count > 200:
            raise serializers.ValidationError({'end': 'За одну операцию можно создать не более 200 столов.'})
        return attrs

    def validate_zone(self, value):
        if value is None:
            return value
        view = self.context.get('view')
        rest_id = view.kwargs.get('rest_id') if view else None
        if rest_id and str(value.restaurant_id) != str(rest_id):
            raise serializers.ValidationError('Зона принадлежит другому ресторану.')
        return value
