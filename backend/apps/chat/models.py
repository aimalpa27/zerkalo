import uuid

from django.db import models

# Максимум закреплённых сообщений на ресторан (групповой чат).
MAX_PINNED_MESSAGES = 5


class ChatMessage(models.Model):
    """
    Сообщение группового чата персонала ресторана.

    Чат — единый групповой канал на ресторан (без личных переписок): все
    сотрудники (админ/менеджер/официант/кассир) видят одни и те же сообщения.
    Доступен только на тарифах, где включён `chat_enabled` (см.
    Restaurant.has_feature('chat')).

    Хранение бессрочное — сообщения никогда не удаляются автоматически.

    `sender` = SET_NULL: при удалении сотрудника история чата сохраняется.
    `sender_name` / `sender_role` — снимок на момент отправки, чтобы имя
    отправителя всегда отображалось, даже если аккаунт удалён или сотрудник
    позже сменил имя в профиле.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.CASCADE,
        related_name='chat_messages',
    )
    sender = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chat_messages',
    )
    sender_name = models.CharField(max_length=255)
    sender_role = models.CharField(max_length=20, blank=True)
    text = models.TextField()
    is_pinned = models.BooleanField(default=False)
    pinned_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['restaurant', 'created_at']),
            models.Index(fields=['restaurant', 'is_pinned']),
        ]

    def __str__(self):
        return f'{self.sender_name}: {self.text[:40]}'
