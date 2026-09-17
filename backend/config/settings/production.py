from django.core.exceptions import ImproperlyConfigured

from .base import *

# All settings (SECRET_KEY, ALLOWED_HOSTS, DATABASE_URL, CORS_ALLOWED_ORIGINS)
# are loaded from the .env file via base.py.
DEBUG = False

# FIX (CRITICAL): base.py's DATABASES falls back to a local sqlite file when
# DATABASE_URL is unset (convenient for local dev). In production this
# fallback is dangerous: the app would silently start against an ephemeral
# sqlite file with no backups/replication/multi-instance support, instead of
# failing loudly. Same for ALLOWED_HOSTS / CORS_ALLOWED_ORIGINS — if unset,
# Django would reject every request (ALLOWED_HOSTS) or block the frontend
# entirely (CORS), which is safe but hard to debug. Fail fast at startup with
# a clear error instead of a confusing runtime failure.
if 'sqlite' in DATABASES['default']['ENGINE']:
    raise ImproperlyConfigured(
        'DATABASE_URL is not set (or points at sqlite) while running with '
        'config.settings.production. Set DATABASE_URL to the production '
        'Postgres connection string.'
    )

if not ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        'ALLOWED_HOSTS is empty while running with config.settings.production. '
        'Set ALLOWED_HOSTS to your production domain(s) in the environment.'
    )

if CORS_ALLOWED_ORIGINS == ['http://localhost:5173']:
    raise ImproperlyConfigured(
        'CORS_ALLOWED_ORIGINS is unset and falling back to the local-dev '
        'default (http://localhost:5173) while running with '
        'config.settings.production. Set CORS_ALLOWED_ORIGINS to the '
        'production frontend origin(s) in the environment.'
    )

SENTRY_DSN = env('SENTRY_DSN', default='')

if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.django import DjangoIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration(), CeleryIntegration()],
            traces_sample_rate=0.2,
            send_default_pii=False,
            environment='production',
        )
    except ImportError:
        pass  # sentry-sdk не установлен — продолжаем без него

# --- Безопасность для продакшна ---
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True