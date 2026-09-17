from django.contrib import admin
from .models import Category, MenuItem

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'restaurant', 'sort_order', 'created_at']
    search_fields = ['name', 'restaurant__name']
    list_filter = ['restaurant']

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'restaurant', 'category', 'price', 'is_available', 'is_visible', 'badge']
    search_fields = ['name', 'restaurant__name', 'category__name']
    list_filter = ['restaurant', 'category', 'is_available', 'is_visible', 'badge']