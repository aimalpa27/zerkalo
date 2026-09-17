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
        """Prevent cross-tenant category assignment.

        ``category_id`` is writable while ``restaurant`` is injected by the
        view. Without this check an admin of restaurant A could attach a menu
        item to a category belonging to restaurant B by submitting its UUID.
        That breaks tenant isolation and can leak foreign category metadata in
        serialized menu responses.
        """
        if value is None:
            return value

        view = self.context.get('view')
        rest_id = view.kwargs.get('rest_id') if view else None
        if rest_id and str(value.restaurant_id) != str(rest_id):
            raise serializers.ValidationError(
                'Категория принадлежит другому ресторану.'
            )
        return value
