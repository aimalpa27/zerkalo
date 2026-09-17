from django.contrib import admin
from .models import Restaurant, Promo


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'is_public', 'created_at']
    search_fields = ['name', 'slug']
    list_filter = ['is_public']


@admin.register(Promo)
class PromoAdmin(admin.ModelAdmin):
    list_display = ['title', 'restaurant', 'is_active', 'valid_until']
    search_fields = ['title', 'restaurant__name']
    list_filter = ['is_active', 'valid_until']