from django.contrib import admin
from .models import TableSession, SessionItem


@admin.register(TableSession)
class TableSessionAdmin(admin.ModelAdmin):
    list_display = [
        'table_number',
        'restaurant',
        'status',
        'payment_method',
        'total_amount',
        'created_at',
        'closed_at',
    ]
    search_fields = ['table_token', 'restaurant__name']
    list_filter = ['status', 'payment_method', 'restaurant']


@admin.register(SessionItem)
class SessionItemAdmin(admin.ModelAdmin):
    list_display = [
        'item_name',
        'session',
        'price',
        'quantity',
        'status',
        'preparation_station',
        'added_by',
        'created_at',
    ]
    search_fields = ['item_name', 'session__table_token']
    list_filter = ['status', 'preparation_station', 'added_by']