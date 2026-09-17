from django.contrib import admin
from .models import WaiterCall


@admin.register(WaiterCall)
class WaiterCallAdmin(admin.ModelAdmin):
    list_display = [
        'table_number',
        'restaurant',
        'status',
        'reason',
        'created_at',
    ]
    search_fields = [
        'table_token',
        'reason',
        'restaurant__name',
    ]
    list_filter = [
        'status',
        'restaurant',
    ]