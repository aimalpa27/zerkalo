from django.urls import path

from .views import (
    ChatMessageDetailView,
    ChatMessageListCreateView,
    ChatMessagePinView,
)

urlpatterns = [
    path(
        'restaurants/<uuid:rest_id>/chat/messages/',
        ChatMessageListCreateView.as_view(),
        name='chat-message-list-create',
    ),
    path(
        'restaurants/<uuid:rest_id>/chat/messages/<uuid:pk>/pin/',
        ChatMessagePinView.as_view(),
        name='chat-message-pin',
    ),
    path(
        'restaurants/<uuid:rest_id>/chat/messages/<uuid:pk>/',
        ChatMessageDetailView.as_view(),
        name='chat-message-detail',
    ),
]
