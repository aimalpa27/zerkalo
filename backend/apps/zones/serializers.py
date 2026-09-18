from rest_framework import serializers

from apps.zones.models import Zone


class ZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Zone
        fields = ['id', 'name', 'color', 'sort_order', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Название зоны обязательно.')

        # Уникальность имени в рамках ресторана (регистронезависимо). `restaurant`
        # не входит в поля сериализатора (сеттится во view из URL), поэтому DRF
        # не может сгенерировать UniqueTogetherValidator автоматически — проверяем сами.
        # Сравниваем через casefold() в Python, а не __iexact: collation SQLite
        # регистронезависим только для ASCII, поэтому __iexact пропускает кириллицу.
        view = self.context.get('view')
        rest_id = view.kwargs.get('rest_id') if view else None
        if rest_id:
            qs = Zone.objects.filter(restaurant_id=rest_id)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            folded = value.casefold()
            if any(zone.name.casefold() == folded for zone in qs):
                raise serializers.ValidationError('Зона с таким именем уже существует.')

        return value
