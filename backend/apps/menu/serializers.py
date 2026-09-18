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

from apps.menu.models import UpsellRule

class UpsellRuleSerializer(serializers.ModelSerializer):
    trigger_item_name = serializers.CharField(source='trigger_item.name', read_only=True)
    recommended_item_name = serializers.CharField(source='recommended_item.name', read_only=True)

    class Meta:
        model = UpsellRule
        fields = ['id','trigger_item','trigger_item_name','recommended_item','recommended_item_name','priority','is_active','created_at','updated_at']
        read_only_fields = ['id','created_at','updated_at']

    def validate(self, attrs):
        view = self.context.get('view')
        rest_id = view.kwargs.get('rest_id') if view else None
        trigger = attrs.get('trigger_item', getattr(self.instance, 'trigger_item', None))
        recommended = attrs.get('recommended_item', getattr(self.instance, 'recommended_item', None))
        if trigger and recommended and trigger.pk == recommended.pk:
            raise serializers.ValidationError('Нельзя рекомендовать то же самое блюдо.')
        for item in (trigger, recommended):
            if item and rest_id and str(item.restaurant_id) != str(rest_id):
                raise serializers.ValidationError('Блюдо принадлежит другому ресторану.')
        return attrs

from apps.menu.models import NetworkMenuTemplateItem, NetworkMenuBranchOverride

class NetworkMenuTemplateItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = NetworkMenuTemplateItem
        fields = ['id','name','category_name','description','price','image_url','emoji','weight','preparation_station','is_available','is_visible','sort_order','created_at','updated_at']
        read_only_fields = ['id','created_at','updated_at']

class NetworkMenuBranchOverrideSerializer(serializers.ModelSerializer):
    class Meta:
        model = NetworkMenuBranchOverride
        fields = ['id','template_item','restaurant','price','is_available','is_visible','updated_at']
        read_only_fields = ['id','template_item','restaurant','updated_at']
