from rest_framework import serializers

from .models import ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    # При записи принимаем только `text`; всё остальное проставляется во view
    # (отправитель, снимок имени/роли). max_length ограничивает размер одного
    # сообщения, чтобы нельзя было залить гигантский текст в бессрочное хранение.
    text = serializers.CharField(max_length=2000, trim_whitespace=True)

    class Meta:
        model = ChatMessage
        fields = [
            'id', 'sender', 'sender_name', 'sender_role',
            'text', 'is_pinned', 'pinned_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'sender', 'sender_name', 'sender_role',
            'is_pinned', 'pinned_at', 'created_at',
        ]

    def validate_text(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Сообщение не может быть пустым.')
        return value


class ChatMessagePinSerializer(serializers.Serializer):
    is_pinned = serializers.BooleanField()
