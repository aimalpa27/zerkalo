from django.contrib import admin

from .models import ChatMessage


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('restaurant', 'sender_name', 'text', 'is_pinned', 'created_at')
    list_filter = ('restaurant', 'is_pinned')
    search_fields = ('sender_name', 'text')
    readonly_fields = ('created_at',)
