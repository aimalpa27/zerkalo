from rest_framework import serializers

from apps.menu.models import Category, MenuItem


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'sort_order', 'created_at']
        read_only_fields = ['id', 'created_at']


class MenuItemSerializer(serializers.ModelSerializer):
    final_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    category = CategorySerializer(read_only=True)
    category_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = MenuItem
        fields = [
            'id', 'name', 'description', 'price', 'final_price',
            'discount_percent', 'image_url', 'video_url', 'emoji', 'weight',
            'badge', 'preparation_station',
            'category', 'category_id',
            'is_available', 'is_visible', 'sort_order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_category_id(self, value):
        """Validate category existence and tenant ownership.

        ``UUIDField`` returns a UUID value, not a ``Category`` instance.  Resolve
        that UUID explicitly before checking the restaurant boundary.  The
        serializer still returns the UUID because ``category_id`` maps directly
        to Django's foreign-key id attribute during create/update.
        """
        if value is None:
            return value

        try:
            category = Category.objects.only('restaurant_id').get(pk=value)
        except Category.DoesNotExist as exc:
            raise serializers.ValidationError('Категория не найдена.') from exc

        view = self.context.get('view')
        rest_id = view.kwargs.get('rest_id') if view else None
        if rest_id is not None and str(category.restaurant_id) != str(rest_id):
            raise serializers.ValidationError(
                'Категория принадлежит другому ресторану.'
            )

        return value
