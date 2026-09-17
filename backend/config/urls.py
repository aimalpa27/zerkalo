from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.users.urls')),
    path('api/v1/restaurants/', include('apps.restaurants.urls')),
    path('api/v1/billing/', include('apps.billing.urls')),
    path('api/v1/', include('apps.menu.urls')),
    path('api/v1/', include('apps.tables.urls')),
    path('api/v1/', include('apps.zones.urls')),
    path('api/v1/', include('apps.calls.urls')),
    path('api/v1/', include('apps.sessions.urls')),
    path('api/v1/', include('apps.schedule.urls')),
    path('api/v1/', include('apps.chat.urls')),
]

# FIX (RECOMMENDATION): the OpenAPI schema and Swagger/Redoc UIs were
# registered with no permission/auth restriction, exposing the full API
# surface (every endpoint, parameter and model field) to anyone on the
# internet — useful recon information for an attacker. These are
# developer-only tools, so only expose them when DEBUG=True (local dev).
# config.settings.production sets DEBUG=False, so they are unreachable
# (404) in production.
if settings.DEBUG:
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
        path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    ]