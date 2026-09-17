import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

django_asgi_app = get_asgi_application()

# These imports MUST come after get_asgi_application() call above.
from apps.websocket.middleware import JWTAuthMiddleware       # noqa: E402
from apps.websocket.routing import websocket_urlpatterns      # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        # JWTAuthMiddleware reads ?token=<access_token> from the WS handshake
        # URL and populates scope['user'] — replaces session-only
        # AuthMiddlewareStack that did NOT work with JWT-based auth.
        JWTAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
