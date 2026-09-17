# Аудит безопасности backend (Django/DRF) — отчёт

Дата: 2026-06-10/11
Область изменений: только `backend/` (Firebase не затронут — в проекте `backend/`
он вообще не используется, см. раздел "N/A" ниже).

Стек проекта — **Django 5 / DRF / PostgreSQL / Channels (WebSocket) / Celery /
Cloudinary / Railway**, а не Next.js+Supabase+Stripe, как в шаблоне чек-листа.
Поэтому пункты чек-листа ниже сопоставлены с их аналогами в этом стеке:

| Шаблон (Next.js/Supabase) | Аналог в этом проекте |
|---|---|
| Supabase RLS | DRF permission classes (`IsRestaurantAdmin`, `IsRestaurantStaff`, `IsSuperAdmin`) + фильтрация querysets по `restaurant_id` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SECRET_KEY`, `DATABASE_URL`, JWT-ключи simplejwt |
| Server Actions / Route Handlers | DRF `APIView`/generic views |
| `NEXT_PUBLIC_*` | переменные, попадающие в собранный фронтенд (в backend таких нет) |
| Stripe / ЮKassa webhooks | отсутствуют — Kaspi Pay реализован как статическая ссылка `kaspi_pay_url`, без вебхуков |
| Vercel preview deployments | Railway preview/staging окружения |

---

## 1. КРИТИЧНЫЕ проблемы — найдены и исправлены

### 1.1 Обход смены пароля через `PATCH /api/v1/auth/me/`

```
Уровень: КРИТИЧНО
Файл: backend/apps/users/serializers.py:38-70 (UserSerializer), backend/apps/users/views.py:86-90 (MeView.patch)
Проблема: UserSerializer имел write-only поле `password` и кастомный update(),
который вызывал instance.set_password(password) напрямую, без проверки
старого пароля. MeView.patch использовал именно этот сериализатор для
PATCH /api/v1/auth/me/. Дополнительно `email` и `is_active` не входили в
read_only_fields, то есть тоже были изменяемы через этот же запрос.
Риск: любой аутентифицированный пользователь (включая официанта/кассира)
мог одним запросом
  PATCH /api/v1/auth/me/ {"password": "newpass123"}
полностью сменить себе пароль БЕЗ знания старого — отдельный эндпоинт
ChangePasswordView (с проверкой old_password) полностью обходился.
Похищенный access-токен (срок жизни 60 минут) превращался в постоянный
полный захват аккаунта: атакующий менял пароль и владелец аккаунта терял
доступ. Также через `is_active=true/false`/`email` можно было исказить
собственную учётную запись.
Фикс: UserSerializer стал чисто read-only для email/role/is_active
(read_only_fields), поле password и update() удалены. Добавлен новый
MeUpdateSerializer (только поле `name`) для самостоятельного редактирования
профиля. MeView.patch теперь использует MeUpdateSerializer; смена пароля
возможна только через ChangePasswordView (PATCH /api/v1/auth/me/change-password/),
которая проверяет old_password.
```

### 1.2 Падение WebSocket-соединений при изменении статуса доставки/самовывоза

```
Уровень: КРИТИЧНО
Файл: backend/apps/websocket/consumers.py (StaffConsumer, GuestConsumer)
Проблема: SessionDeliveryStatusUpdateView (apps/sessions/views.py:409-415)
рассылает событие группы `delivery_status_changed` через notify_guest()
и notify_staff(), но ни в StaffConsumer, ни в GuestConsumer не было
обработчика-метода с таким именем.
Риск: Channels диспетчеризует групповые события по имени метода, равному
полю `type`. При отсутствии метода `delivery_status_changed` выбрасывается
ValueError("No handler for message type delivery_status_changed"), что
приводит к падению/разрыву ASGI-консьюмера — отключались ВСЕ сокеты
персонала ресторана и гостя, как только статус доставки/самовывоза менялся
(например, "принят" → "готовится"). Это рабочая регрессия, "тихо" ломающая
realtime-обновления для всего ресторана при каждом заказе на доставку.
Фикс: добавлены обработчики
  StaffConsumer.delivery_status_changed()
  GuestConsumer.delivery_status_changed()
которые просто пересылают событие клиенту через send_json (по аналогии с
уже существующими item_status_changed / session_status_changed).
```

---

## 2. ВАЖНЫЕ проблемы — найдены и исправлены

### 2.1 Загрузка логотипа/обложки ресторана без валидации файла

```
Уровень: ВАЖНО
Файл: backend/apps/restaurants/views.py (RestaurantLogoUploadView, RestaurantCoverUploadView)
Проблема: оба эндпоинта (POST /api/v1/restaurants/<id>/upload-logo/ и
.../upload-cover/) принимали request.FILES['image'] и сразу передавали его
в cloudinary.uploader.upload() без проверки content_type и размера — в
отличие от apps/menu/views.py::MenuItemImageUploadView, где такая проверка
уже была.
Риск: администратор ресторана (или похищенный admin-токен) мог загрузить
файл произвольного размера/типа (не изображение), который затем отдаётся
публично всем гостям ресторана — риск чрезмерного расхода
трафика/хранилища Cloudinary и хранения нежелательного контента под видом
лого/обложки ресторана.
Фикс: добавлена общая функция _validate_branding_image() (по образцу
MenuItemImageUploadView): допускаются только image/jpeg, image/png,
image/webp, максимум 10MB. Вызывается в обоих view перед загрузкой в
Cloudinary.
```

### 2.2 JSON-поле `tags` без схемы/ограничений

```
Уровень: ВАЖНО
Файл: backend/apps/restaurants/serializers.py (RestaurantSettingsSerializer)
Проблема: `tags` — JSONField, доступный на запись через
PATCH /api/v1/restaurants/<id>/settings/, без какой-либо валидации
структуры/размера.
Риск: можно было записать произвольный по размеру/вложенности JSON (массив
из тысяч элементов, вложенные объекты и т.д.), который хранится в jsonb и
затем отдаётся на каждой публичной странице ресторана (RestaurantSerializer)
— раздувание БД и ответов API для гостей.
Фикс: добавлен validate_tags() — допускается только плоский список строк,
не более 20 элементов, каждая строка не длиннее 30 символов.
```

### 2.3 Неограниченные list-эндпоинты аналитики и вызовов официанта

```
Уровень: ВАЖНО
Файл: backend/apps/analytics/views.py (AnalyticsSessionsView), backend/apps/calls/views.py (WaiterCallListView)
Проблема: пагинация в проекте глобально отключена (фронтенд ожидает
обычные массивы), но эти два ListAPIView не имели никакого ограничения
объёма выдачи — в отличие от DeliveryOrderListView, у которого уже было
qs[:200].
Риск: для ресторана с многолетней историей закрытых сессий/вызовов
официанта запрос вернул бы десятки тысяч объектов (для сессий — ещё и с
prefetch_related('items')) одним ответом — медленные запросы, риск
исчерпания памяти воркера, потенциальный вектор DoS через единственный
тяжёлый запрос.
Фикс: AnalyticsSessionsView.get_queryset() и WaiterCallListView.get_queryset()
теперь возвращают qs[:500] (последние 500 записей по дате), сохраняя
формат ответа (массив) без изменений для фронтенда.
```

### 2.4 Production-конфигурация могла "тихо" откатиться на sqlite/пустые ALLOWED_HOSTS/CORS

```
Уровень: ВАЖНО
Файл: backend/config/settings/production.py
Проблема: backend/config/settings/base.py задаёт
  DATABASES['default'] = env.db('DATABASE_URL', default='sqlite:///...')
  ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[])
  CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=['http://localhost:5173'])
production.py не проверял, что эти переменные реально заданы.
Риск: при отсутствии DATABASE_URL в продакшен-окружении (опечатка/неверный
сервис в Railway) приложение бы тихо стартовало с временным sqlite-файлом
— без бэкапов, без поддержки нескольких инстансов, с риском полной потери
данных при пересборке контейнера. Пустой ALLOWED_HOSTS / "залипший" на
localhost CORS_ALLOWED_ORIGINS приводят к трудно диагностируемым ошибкам
(DisallowedHost / CORS-блокировка фронтенда).
Фикс: в production.py добавлены проверки при старте — если DATABASES
указывает на sqlite, ALLOWED_HOSTS пуст, или CORS_ALLOWED_ORIGINS равен
дефолту для localhost, приложение падает с ImproperlyConfigured и понятным
сообщением вместо тихого неправильного поведения в проде.
```

---

## 3. РЕКОМЕНДАЦИИ — реализованы

### 3.1 Логирование подозрительной активности (401/403)

```
Уровень: РЕКОМЕНДАЦИЯ (реализовано)
Файл: backend/apps/users/middleware.py (новый), backend/config/settings/base.py (MIDDLEWARE)
Проблема: django.security логировал только SuspiciousOperation; ответы
401/403 от DRF (например, перебор IDOR/прав доступа) нигде не логировались
— невозможно было детектировать аномалии (много 401/403 с одного IP).
Фикс: добавлен SecurityResponseLoggingMiddleware — логирует WARNING
"AUTH_DENIED status=... method=... path=... ip=... user_id=..." для всех
ответов 401/403 на /api/*. Использует уже настроенные handlers/loggers
(апп `apps.*` → консоль + файл в проде, см. LOGGING в base.py), что даёт
основу для алертинга в Sentry/лог-агрегаторе.
```

### 3.2 Публичный доступ к OpenAPI-схеме / Swagger / Redoc

```
Уровень: РЕКОМЕНДАЦИЯ (реализовано)
Файл: backend/config/urls.py
Проблема: /api/schema/, /api/schema/swagger-ui/, /api/schema/redoc/ были
доступны без авторизации — это полная карта API (все эндпоинты, параметры,
структуры моделей), полезная атакующему для разведки.
Фикс: эти три маршрута теперь регистрируются только если settings.DEBUG=True.
В production (DEBUG=False) они отдают 404. Локальная разработка не
затронута.
```

---

## 4. РЕКОМЕНДАЦИИ — НЕ применены автоматически (требуют решения владельца/доп. инфраструктуры)

### 4.1 Email-верификация и сброс пароля (пп. 3-4 чек-листа)

```
Уровень: РЕКОМЕНДАЦИЯ
Файл: backend/apps/users/urls.py, backend/apps/users/views.py
Проблема/контекст: в проекте НЕТ публичной самостоятельной регистрации —
учётные записи персонала создаются только администратором ресторана через
StaffListCreateView (роль admin создаётся отдельной командой
create_superadmin). Поэтому "email-верификация при регистрации" и
"одноразовые токены сброса пароля, истекающие через 1 час" не применимы в
текущем виде — соответствующих эндпоинтов/потоков нет вовсе, EMAIL_BACKEND
не настроен.
Почему не исправлено сейчас: добавление этого функционала требует новой
инфраструктуры (почтовый провайдер/SMTP, шаблоны писем, новые модели токенов,
новые публичные эндпоинты) — это не "исправление критической ошибки", а
новая фича с отдельным дизайном (в т.ч. UX на фронтенде, который менять
запрещено в рамках этой задачи).
Рекомендация при реализации (используя то, что уже есть в проекте):
 - Django уже умеет генерировать одноразовые токены через
   django.contrib.auth.tokens.PasswordResetTokenGenerator (учитывает
   last_login/password hash — токен инвалидируется после использования).
 - Хранить срок жизни 1 час через PASSWORD_RESET_TIMEOUT = 3600 в settings.
 - Эндпоинты: POST /api/v1/auth/password-reset/ (запрос),
   POST /api/v1/auth/password-reset/confirm/ (подтверждение с токеном) —
   с LoginRateThrottle-подобным троттлингом.
 - EMAIL_BACKEND через переменные окружения (SMTP), без хардкода ключей.
```

### 4.3 Обновление Django до последнего патч-релиза 5.0.x

```
Уровень: РЕКОМЕНДАЦИЯ
Файл: backend/requirements.txt:2 (Django==5.0.4)
Проблема: версия Django 5.0.4 старше нескольких security-релизов внутри
ветки 5.0.x (исправления DoS/edge-case уязвимостей в utils/forms,
выпущенные после 5.0.4).
Риск: низкий при текущей конфигурации (DEBUG=False, нет
django.contrib.auth password-reset views, нет шаблонных urlize-фильтров в
API), но лучше держать патч-версию свежей.
Почему не исправлено сейчас: смена пиннинга версии в requirements.txt без
возможности прогнать тесты/CI рискует завести несовместимость пакета в
проде втёмную.
Фикс (рекомендуется выполнить с прогоном тестов перед деплоем):
  Django==5.0.<последний доступный патч в ветке 5.0>
  затем: pip install -r requirements.txt && python manage.py check && pytest
```

### 4.4 Инфраструктурные пункты (вне кода backend)

```
Уровень: РЕКОМЕНДАЦИЯ
Проблема: пп. 31 ("прямой доступ к БД заблокирован"), 36 ("настроены бэкапы
БД"), 37 ("preview-окружения не используют prod БД") — это настройки
Railway/инфраструктуры, а не backend-кода. Кода для проверки/исправления
нет — это конфигурация хостинга.
Рекомендация: убедиться в Railway, что:
 - Postgres сервис не имеет публичного TCP-порта, открытого в интернет
   (или защищён отдельным паролем + allowed IP);
 - включены автоматические бэкапы БД (Railway Postgres → Backups);
 - для каждого preview/staging окружения создаётся отдельная БД (отдельный
   DATABASE_URL), а не общая с production.
```

---

## 5. Уже реализовано ранее (✅) — подтверждено в рамках аудита, не требует изменений

```
✅ 1. Пароли — Argon2 (PASSWORD_HASHERS, base.py), + PBKDF2-фоллбек для
      старых хэшей. min_length=8 + полный набор AUTH_PASSWORD_VALIDATORS.
✅ 2. JWT-сессии: ACCESS 60 мин / REFRESH 7 дней, ROTATE_REFRESH_TOKENS=True,
      BLACKLIST_AFTER_ROTATION=True. LogoutView блэклистит refresh-токен
      (apps/users/views.py).
✅ 5. LoginView throttling: LoginRateThrottle, scope='login',
      DEFAULT_THROTTLE_RATES['login'] = '5/min' (требование "макс. 5/мин"
      выполнено буквально).
✅ 6. SECRET_KEY/DATABASE_URL/JWT-параметры — только из переменных
      окружения (env.* без дефолтов для секретов), в JWT payload попадают
      только id/role/restaurant_id (CustomTokenObtainPairSerializer).
✅ 8. permission_classes на всех protected views (IsAuthenticated /
      IsRestaurantAdmin / IsRestaurantStaff / IsSuperAdmin), JWTAuthMiddleware
      для WebSocket (apps/websocket/middleware.py).
✅ 9-10. IDOR/ownership: все querysets фильтруются по restaurant_id из URL
      + проверка совпадения с request.user.restaurant_id в permission
      классах (кроме superadmin). Проверено: menu, tables, calls, sessions,
      analytics, billing, restaurants.
✅ 12-13. Все мутирующие операции проходят через DRF-сериализаторы с
      валидацией (max_length, choices, кастомные validate_*), ограничение
      _MAX_ITEMS_PER_ORDER=50 на заказы.
✅ 14. SQL-инъекции: в коде нет .raw()/.extra()/cursor.execute() —
      везде Django ORM с параметризацией.
✅ 16. Загрузка изображений/видео меню (MenuItemImageUploadView/
      MenuItemMediaUploadView) уже валидирует content_type и размер;
      теперь то же самое для логотипа/обложки ресторана (см. 2.1).
✅ 17. Открытых редиректов нет — в коде отсутствуют redirect()/
      HttpResponseRedirect.
✅ 20-22. Секреты не захардкожены (grep по .py не нашёл ключей/паролей в
      коде), .gitignore исключает .env*, .env.example содержит только
      плейсхолдеры.
✅ 27. git-история проверена (`git log --all --diff-filter=A --name-only`)
      — файлы с секретами никогда не коммитились.
✅ 29. SECURE_SSL_REDIRECT=True, полный HSTS (production.py),
      SECURE_PROXY_SSL_HEADER настроен под Railway-прокси.
✅ 32. CORS_ALLOWED_ORIGINS — конкретные домены из env, без wildcard;
      CORS_ALLOW_ALL_ORIGINS=True только в development.py.
✅ 33. Заголовки безопасности: X_FRAME_OPTIONS='DENY',
      SECURE_CONTENT_TYPE_NOSNIFF=True, SECURE_REFERRER_POLICY заданы в
      base.py/production.py.
✅ 34 (частично). LOGIN_SUCCESS/LOGIN_FAILED логируются с IP (LoginView),
      django.security логирует SuspiciousOperation; теперь дополнено
      401/403-логированием (см. 3.1).
```

---

## 6. N/A для этого стека

```
N/A 3-4.  Email-верификация / сброс пароля — самостоятельной регистрации
          нет вовсе (см. 4.2).
N/A 7.    OAuth — в проекте нет OAuth-провайдеров (только email+пароль).
N/A 11.   Supabase RLS — заменено DRF permission classes (см. п.9-10 выше).
N/A 15.   dangerouslySetInnerHTML — фронтенд, изменения запрещены
          ("все изменения только по папке backend").
N/A 18.   Большинство JSONB-полей — это списки/словари с фиксированной
          структурой, формируемой бэкендом (FEATURE_FIELDS и т.п.);
          единственное пользовательское JSON-поле `tags` теперь
          провалидировано (см. 2.2).
N/A 23-26. Service-role ключи / NEXT_PUBLIC_* / Stripe / ЮKassa /
          ANTHROPIC_API_KEY — таких интеграций в проекте нет. Kaspi Pay —
          статическая ссылка kaspi_pay_url без серверных секретов.
N/A 28.   Хранение токенов в localStorage vs httpOnly cookie — фронтенд;
          бэкенд не выдаёт куки для JWT (AUTH_COOKIE=None в SIMPLE_JWT) —
          выдача токенов уже максимально "пассивна" со стороны backend.
N/A 39.   Повторная доставка вебхуков (Kaspi/Stripe) — вебхуков в проекте
          нет (Kaspi Pay = статическая ссылка, без callback от Kaspi).
          "AI API недоступен" — в backend нет вызовов внешних AI API.
```

---

## 7. Итог изменённых файлов backend/

```
apps/users/serializers.py     — убран небезопасный UserSerializer.update(),
                                 добавлен MeUpdateSerializer (КРИТИЧНО, 1.1)
apps/users/views.py            — MeView.patch использует MeUpdateSerializer (1.1)
apps/users/middleware.py       — новый: логирование 401/403 (3.1)
apps/websocket/consumers.py    — добавлены delivery_status_changed handlers (КРИТИЧНО, 1.2)
apps/restaurants/views.py       — валидация файлов logo/cover upload (2.1)
apps/restaurants/serializers.py — validate_tags() (2.2)
apps/analytics/views.py         — cap [:500] для AnalyticsSessionsView (2.3)
apps/calls/views.py              — cap [:500] для WaiterCallListView (2.3)
config/settings/base.py          — MIDDLEWARE += SecurityResponseLoggingMiddleware
config/settings/production.py    — fail-fast проверки DATABASE_URL/ALLOWED_HOSTS/
                                    CORS_ALLOWED_ORIGINS (2.4)
config/urls.py                    — схема/Swagger/Redoc только при DEBUG=True (3.2)
```

Firebase и frontend/ не изменялись.
