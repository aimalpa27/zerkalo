from django.contrib import admin
from .models import Table


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ['number', 'restaurant', 'token', 'is_active', 'created_at']
    search_fields = ['number', 'token', 'restaurant__name']
    list_filter = ['restaurant', 'is_active']