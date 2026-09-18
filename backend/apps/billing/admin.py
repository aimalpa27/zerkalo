from django.contrib import admin

from .models import SubscriptionPlan


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'price', 'max_tables', 'max_staff', 'is_active', 'sort_order']
    list_filter = ['is_active']
    search_fields = ['name', 'code']