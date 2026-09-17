# SECURITY_AUDIT.md

Дата: 2026-09-16

## Подтверждённые защиты

- JWT access/refresh, refresh rotation и blacklist.
- Argon2 password hasher.
- Login/order/waiter-call throttles.
- Restaurant-scoped DRF permissions для staff/admin endpoints.
- Staff WebSocket проверяет authenticated user + `restaurant_id`.
- Guest WebSocket принимает только существующий active table token.
- Upload branding/menu ограничен MIME/размером в проверенных endpoints.
- Production: SSL redirect, HSTS, secure cookies.
- API schema UI доступен только DEBUG.
- SECRET_KEY без insecure default.
- Production не допускает silent SQLite fallback.

## P0/P1 проверки

1. **Tenant isolation** — добавить систематические tests для каждого endpoint: user Restaurant A не читает/не меняет Restaurant B.
2. **Guest token abuse** — token достаточно длинный, но все mutating guest endpoints должны иметь throttle/transition checks.
3. **Public visibility** — `RestaurantDetailView` и `RestaurantBySlugView` сейчас не фильтруют `is_public`; нужно определить product semantics и тестировать скрытые рестораны.
4. **CSP** — Content-Security-Policy не обнаружен; добавить после inventory внешних origins (Cloudinary, maps, API).
5. **Upload signature** — MIME header можно подделать; желательно verify actual image decode/signature server-side.
6. **Logging** — убедиться, что токены, пароли, iiko keys и телефоны гостей не попадают в production logs/Sentry breadcrumbs.
7. **Rate limits** — request-payment/cancel-item/session lookups надо оценить отдельно, а не полагаться только на global anon cap.
8. **Data retention** — определить срок хранения customer phone/address у delivery заказов.

## Multi-tenant rule

Любой authenticated staff endpoint обязан проверять одновременно:
- authenticated user;
- role capability;
- `request.user.restaurant_id == URL/object.restaurant_id`;
- object queryset scoped к этому ресторану.

Наличие `rest_id` только в URL недостаточно без scoped queryset.

## Secrets

- `.env` не должен попадать в git/image.
- iiko restaurant api key не должен сериализоваться в public/admin responses; текущий serializer использует write-only + boolean `api_key_set`.
- External AI secrets отсутствуют и не требуются. `AI_ENABLED=false`.
