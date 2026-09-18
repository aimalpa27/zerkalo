from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.restaurants.models import Restaurant
from apps.users.permissions import IsRestaurantStaff
from .models import MAX_PINNED_MESSAGES, ChatMessage
from .serializers import ChatMessagePinSerializer, ChatMessageSerializer

# Сколько последних сообщений отдаём при полной загрузке. Пагинация отключена
# глобально, поэтому ограничиваем размер ответа вручную (хранение бессрочное,
# история может быть очень длинной).
RECENT_LIMIT = 300


def _get_restaurant_or_403(rest_id):
    """Ресторан с проверкой доступности чата на его тарифе."""
    restaurant = get_object_or_404(Restaurant, id=rest_id)
    if not restaurant.has_feature('chat'):
        raise PermissionDenied('Чат недоступен на текущем тарифе.')
    return restaurant


class ChatMessageListCreateView(generics.ListCreateAPIView):
    """
    GET  — последние сообщения группового чата (по возрастанию created_at).
           ?after=<iso> — только сообщения новее указанного времени (для
           инкрементального опроса).
    POST — отправить сообщение (любой сотрудник ресторана).
    """
    permission_classes = [IsRestaurantStaff]
    serializer_class = ChatMessageSerializer

    def get_queryset(self):
        restaurant = _get_restaurant_or_403(self.kwargs['rest_id'])
        qs = ChatMessage.objects.filter(restaurant=restaurant)

        after = self.request.query_params.get('after')
        if after:
            qs = qs.filter(created_at__gt=after).order_by('created_at')
            return list(qs)

        # Берём RECENT_LIMIT самых свежих и возвращаем по возрастанию времени.
        recent = list(qs.order_by('-created_at')[:RECENT_LIMIT])
        recent.reverse()
        return recent

    def perform_create(self, serializer):
        restaurant = _get_restaurant_or_403(self.kwargs['rest_id'])
        user = self.request.user
        message = serializer.save(
            restaurant=restaurant,
            sender=user,
            sender_name=(user.name or user.email),
            sender_role=user.role,
        )
        _notify_chat(restaurant.id, {
            'message_id': str(message.id),
            'sender_id': str(user.id),
            'sender_name': message.sender_name,
            'preview': message.text[:80],
        })


class ChatMessagePinView(APIView):
    """
    PATCH { "is_pinned": true|false } — закрепить/открепить сообщение.
    Закрепить можно не более MAX_PINNED_MESSAGES сообщений на ресторан.
    """
    permission_classes = [IsRestaurantStaff]

    def patch(self, request, rest_id, pk):
        restaurant = _get_restaurant_or_403(rest_id)
        message = get_object_or_404(ChatMessage, id=pk, restaurant=restaurant)

        serializer = ChatMessagePinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pin = serializer.validated_data['is_pinned']

        if pin and not message.is_pinned:
            pinned_count = ChatMessage.objects.filter(
                restaurant=restaurant, is_pinned=True,
            ).count()
            if pinned_count >= MAX_PINNED_MESSAGES:
                raise ValidationError(
                    f'Можно закрепить не более {MAX_PINNED_MESSAGES} сообщений.'
                )

        message.is_pinned = pin
        message.pinned_at = timezone.now() if pin else None
        message.save(update_fields=['is_pinned', 'pinned_at'])

        _notify_chat(restaurant.id, {'message_id': str(message.id), 'event': 'pin'})
        return Response(ChatMessageSerializer(message).data)


class ChatMessageDetailView(generics.DestroyAPIView):
    """
    DELETE — удалить сообщение. Доступно автору сообщения, а также
    админу/менеджеру ресторана (и тех-поддержке superadmin).
    """
    permission_classes = [IsRestaurantStaff]

    def get_queryset(self):
        return ChatMessage.objects.filter(restaurant_id=self.kwargs['rest_id'])

    def perform_destroy(self, instance):
        user = self.request.user
        is_author = instance.sender_id == user.id
        if not (is_author or user.is_admin_or_manager or user.is_superadmin):
            raise PermissionDenied('Можно удалять только свои сообщения.')
        rest_id = instance.restaurant_id
        instance.delete()
        _notify_chat(rest_id, {'event': 'delete'})


def _notify_chat(rest_id, data: dict) -> None:
    """Broadcast a chat event to the restaurant's staff WS group (best-effort)."""
    try:
        from apps.websocket.events import notify_staff
        notify_staff(str(rest_id), 'chat_message', data)
    except Exception:
        pass
