import uuid

from django.db import models


class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='categories',
    )
    name = models.CharField(max_length=255)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'categories'
        ordering = ['sort_order']
        indexes = [
            models.Index(fields=['restaurant', 'sort_order']),
        ]

    def __str__(self):
        return f'{self.restaurant.name} → {self.name}'


class MenuItem(models.Model):
    BADGES = [
        ('hit', 'Хит'),
        ('new', 'Новинка'),
        ('sale', 'Скидка'),
    ]

    STATIONS = [
        ('kitchen', 'Кухня'),
        ('bar', 'Бар'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='menu_items',
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='items',
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image_url = models.URLField(blank=True)
    video_url = models.URLField(blank=True)
    emoji = models.CharField(max_length=10, blank=True)
    weight = models.CharField(max_length=50, blank=True)
    is_available = models.BooleanField(default=True)
    is_visible = models.BooleanField(default=True)
    badge = models.CharField(max_length=10, choices=BADGES, blank=True)
    discount_percent = models.PositiveIntegerField(default=0)
    preparation_station = models.CharField(
        max_length=10,
        choices=STATIONS,
        default='kitchen',
    )
    sort_order = models.PositiveIntegerField(default=0)

    # ID этого блюда в номенклатуре iiko (для синхронизации меню/стоп-листов)
    iiko_external_id = models.CharField(max_length=64, blank=True, db_index=True)
    network_template_item = models.ForeignKey('NetworkMenuTemplateItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='published_items')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'menu_items'
        ordering = ['sort_order']
        indexes = [
            models.Index(fields=['restaurant', 'is_available', 'is_visible']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return self.name

    @property
    def final_price(self):
        if self.discount_percent > 0:
            return self.price - (self.price * self.discount_percent // 100)
        return self.price

class UpsellRule(models.Model):
    """Deterministic cross-sell rule: when trigger is in cart, recommend target."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='upsell_rules')
    trigger_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='upsell_triggers')
    recommended_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='upsell_recommendations')
    priority = models.PositiveSmallIntegerField(default=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'upsell_rules'
        ordering = ['priority', 'created_at']
        constraints = [
            models.UniqueConstraint(fields=['restaurant', 'trigger_item', 'recommended_item'], name='uniq_restaurant_upsell_pair'),
            models.CheckConstraint(condition=~models.Q(trigger_item=models.F('recommended_item')), name='upsell_items_must_differ'),
        ]
        indexes = [models.Index(fields=['restaurant', 'is_active', 'priority'])]

class NetworkMenuTemplateItem(models.Model):
    """Canonical menu item owned by a verified RestaurantNetwork."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    network = models.ForeignKey('restaurants.RestaurantNetwork', on_delete=models.CASCADE, related_name='menu_template_items')
    name = models.CharField(max_length=255)
    category_name = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image_url = models.URLField(blank=True)
    emoji = models.CharField(max_length=10, blank=True)
    weight = models.CharField(max_length=50, blank=True)
    preparation_station = models.CharField(max_length=10, choices=MenuItem.STATIONS, default='kitchen')
    is_available = models.BooleanField(default=True)
    is_visible = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'network_menu_template_items'
        ordering = ['sort_order', 'created_at']
        constraints = [models.UniqueConstraint(fields=['network', 'name'], name='uniq_network_template_item_name')]


class NetworkMenuBranchOverride(models.Model):
    """Only values intentionally differing from the network template."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template_item = models.ForeignKey(NetworkMenuTemplateItem, on_delete=models.CASCADE, related_name='branch_overrides')
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='network_menu_overrides')
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_available = models.BooleanField(null=True, blank=True)
    is_visible = models.BooleanField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'network_menu_branch_overrides'
        constraints = [models.UniqueConstraint(fields=['template_item', 'restaurant'], name='uniq_template_branch_override')]
