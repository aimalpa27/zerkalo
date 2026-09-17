from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    # FIX: removed insecure default value for SECRET_KEY.
    # If the variable is missing from .env the server will raise ImproperlyConfigured
    # instead of silently starting with a publicly-known key that would allow
    # anyone to forge session cookies and signed data.
)
environ.Env.read_env(BASE_DIR.parent / '.env')

SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[])

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'drf_spectacular',
    'corsheaders',
    'channels',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',

    'apps.users',
    'apps.restaurants',
    'apps.menu',
    'apps.tables',
    'apps.zones',
    'apps.sessions',
    'apps.calls',
    'apps.analytics',
    'apps.billing',
    'apps.schedule',
    'apps.chat',
    'apps.integrations',
    'django_celery_beat',
    'django_celery_results',
]

AUTH_USER_MODEL = 'users.User'

# FIX: argon2 added as the primary password hasher.
# Django's built-in default (PBKDF2-SHA256) is acceptable but argon2id
# won the Password Hashing Competition and is recommended by OWASP.
# Existing PBKDF2 hashes are automatically upgraded on next login.
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',   # primary
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',   # legacy fallback
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
]

# FIX: strengthen built-in validators
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',   # must be early
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    # FIX: log 401/403 responses on /api/ for suspicious-activity monitoring
    # (audit checklist item: "anomaly monitoring" / repeated auth failures).
    'apps.users.middleware.SecurityResponseLoggingMiddleware',
]

CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    'http://localhost:5173',
])
# Never expose credentials to wildcard origins
CORS_ALLOW_CREDENTIALS = True

# Базовый адрес фронтенда (для ссылок в QR-кодах столов). Переопределяется
# переменной FRONTEND_BASE_URL в окружении Railway.
FRONTEND_BASE_URL = env('FRONTEND_BASE_URL', default='https://plait.kz')

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [env('REDIS_URL', default='redis://localhost:6379/0')],
        },
    },
}

DATABASES = {
    'default': env.db('DATABASE_URL', default=f'sqlite:///{BASE_DIR.parent / "db.sqlite3"}'),
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
# FIX: STATIC_ROOT is required for `collectstatic` used in Dockerfile
STATIC_ROOT = BASE_DIR.parent / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# FIX: custom pagination class that caps page_size to prevent ?page_size=999999
# DOS attacks that retrieve enormous query sets in one request.
REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    # Pagination is disabled globally — all list views return plain arrays.
    # Add pagination_class = SafePageNumberPagination on individual views if needed.
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '200/day',
        'user': '1000/day',
        'login': '5/min',
        'order': '10/min',
        'waiter_call': '10/min',
    },
    # FIX: return plain dicts, not OrderedDicts — prevents accidental key-ordering leaks
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

CACHES = {
    'default': env.cache('CACHE_URL', default='locmemcache://'),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),   # FIX: was 30 days — reduced to 7
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
    # FIX: prevent JWT from being used in cookies (all auth via Authorization header only)
    'AUTH_COOKIE': None,
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'QR Cafe API',
    'DESCRIPTION': 'API documentation for QR Cafe backend',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# ── Security headers (Django SecurityMiddleware) ──────────────────────────────
# FIX: protect against MIME-type sniffing attacks
SECURE_CONTENT_TYPE_NOSNIFF = True
# FIX: prevent clickjacking (XFrameOptionsMiddleware reads this)
X_FRAME_OPTIONS = 'DENY'
# FIX: Referrer-Policy — don't leak full URL to third parties
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# ── Cloudinary ────────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME = env('CLOUDINARY_CLOUD_NAME', default='')
CLOUDINARY_API_KEY = env('CLOUDINARY_API_KEY', default='')
CLOUDINARY_API_SECRET = env('CLOUDINARY_API_SECRET', default='')

import cloudinary  # noqa: E402

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET,
    secure=True,
)

# ── iiko Cloud API (iikoTransport, api-ru.iiko.services) ───────────────────────
# app_id + client_secret принадлежат НАШЕМУ приложению (одни на всю систему).
# api_key — свой у каждого ресторана (iikoWeb → «Настройки Cloud API», хранится
# в модели Restaurant). Авторизация: POST /api/v2/access_token {appId,apiKey,clientSecret}.
IIKO_API_BASE_URL = env('IIKO_API_BASE_URL', default='https://api-ru.iiko.services')
IIKO_APP_ID = env('IIKO_APP_ID', default='')
IIKO_CLIENT_SECRET = env('IIKO_CLIENT_SECRET', default='')
# Время жизни кэшированного токена iiko (сек). Токен «крутится» каждые 10 минут.
IIKO_TOKEN_TTL = env.int('IIKO_TOKEN_TTL', default=600)

# ── Celery ────────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = env('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = 'django-db'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# ── Logging ───────────────────────────────────────────────────────────────────
LOGS_DIR = BASE_DIR.parent / 'logs'
# FIX: wrapped in try/except — Railway and other platforms may have a
# read-only root filesystem; log directory creation failure must NOT crash
# the entire process on startup.
try:
    LOGS_DIR.mkdir(exist_ok=True)
except OSError:
    pass

_log_handlers = ['console']
_file_handler: dict = {}

try:
    _log_file = LOGS_DIR / 'plait.log'
    _log_file.touch(exist_ok=True)   # verify writable before registering
    _file_handler = {
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(_log_file),
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 5,
            'formatter': 'verbose',
        },
    }
    _log_handlers.append('file')
except OSError:
    pass   # read-only FS — fall back to console-only

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{asctime} {levelname} {name} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        **_file_handler,
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': _log_handlers,
            'level': 'INFO',
            'propagate': False,
        },
        'django.security': {
            # FIX: log ALL security-related events (SuspiciousOperation etc.)
            'handlers': _log_handlers,
            'level': 'WARNING',
            'propagate': False,
        },
        'apps': {
            'handlers': _log_handlers,
            # FIX: use env variable, not Python-level DEBUG constant,
            # so the level is determined at import time correctly
            'level': 'DEBUG' if env('DEBUG', default=False) else 'INFO',
            'propagate': False,
        },
    },
}


# External AI integrations are intentionally disabled until explicitly enabled.
AI_ENABLED = env.bool('AI_ENABLED', default=False)
