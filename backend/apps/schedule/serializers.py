from rest_framework import serializers

from .models import Shift


class ShiftSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(source='staff.name', read_only=True)
    staff_role = serializers.CharField(source='staff.role', read_only=True)

    class Meta:
        model = Shift
        fields = [
            'id', 'staff', 'staff_name', 'staff_role',
            'date', 'start_time', 'end_time', 'note',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_staff(self, value):
        rest_id = self.context['view'].kwargs['rest_id']
        if str(value.restaurant_id) != str(rest_id):
            raise serializers.ValidationError('Сотрудник не принадлежит этому ресторану.')
        return value

    def validate(self, attrs):
        start = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        end = attrs.get('end_time', getattr(self.instance, 'end_time', None))
        if start and end and end <= start:
            raise serializers.ValidationError({'end_time': 'Время окончания должно быть позже начала.'})
        return attrs
