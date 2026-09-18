"""
JWT authentication middleware for Django Channels.

AuthMiddlewareStack (built-in) works only with Django session cookies —
it does NOT understand JWT tokens. This middleware reads the access token
from the `token` query-parameter of the WebSocket handshake URL:

    ws://host/ws/staff/{rest_id}/?token=<JWT_ACCESS_TOKEN>

and injects the authenticated User into scope['user'], exactly the same
way AuthMiddlewareStack would do for session-based auth.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _get_user_from_token(token_str: str):
    """Validate JWT access token and return the Django user, or AnonymousUser."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        token = AccessToken(token_str)
        user_id = token.get("user_id")
        if user_id is None:
            return AnonymousUser()
        return User.objects.get(id=user_id, is_active=True)
    except (InvalidToken, TokenError, User.DoesNotExist, Exception):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Channels middleware that populates scope['user'] from a JWT query-param.

    Usage in asgi.py:
        from apps.websocket.middleware import JWTAuthMiddleware
        application = ProtocolTypeRouter({
            'websocket': AllowedHostsOriginValidator(
                JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
            ),
        })
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"")
        params = parse_qs(query_string.decode("utf-8"))
        token_list = params.get("token", [])

        if token_list:
            scope["user"] = await _get_user_from_token(token_list[0])
        else:
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)
