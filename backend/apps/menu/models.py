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
