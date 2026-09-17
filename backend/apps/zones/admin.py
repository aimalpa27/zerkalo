from django.contrib import admin
from .models import Zone


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ['name', 'restaurant', 'color', 'sort_order', 'created_at']
    search_fields = ['name', 'restaurant__name']
    list_filter = ['restaurant']
