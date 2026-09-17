# PLAIT_AUDIT.md

Дата аудита: 2026-09-16
Режим: `AI_ENABLED=false`

## 1. Текущий стек

- Frontend: React 18, TypeScript, Vite 5, Zustand, Tailwind CSS, Framer Motion, html5-qrcode, qrcode.react.
- Backend: Django 5, Django REST Framework, SimpleJWT, Channels/Daphne, Celery, Redis, PostgreSQL production / SQLite fallback development.
- Media: Cloudinary.
- Realtime: Django Channels + Redis, staff и guest WebSocket groups.
- Integration: iiko Cloud API уже присутствует.
- PWA: отдельные manifest для guest, kitchen, superadmin. Service worker не найден.
- Firebase: в рабочем коде не используется как основной backend. Упоминания в README и frontend `.env.example` устарели.
- AI: внешних AI интеграций в исходниках не найдено; добавлен явный feature flag `AI_ENABLED=false` / `VITE_AI_ENABLED=false`.

## 2. Что работает по коду

- JWT login/refresh/logout, роли и привязка пользователя к ресторану.
- Restaurants, menu/categories CRUD, изображения/медиа, stop-list availability.
- Tables CRUD, уникальные token, regenerate token, QR URL.
- Guest endpoint по table token: ресторан + стол + категории + меню.
- Cart и создание dine-in заказа.
- Delivery/pickup flow.
- Session/items statuses, kitchen statuses, close session, payment request.
- Waiter calls + throttling.
- Staff realtime WebSocket и guest realtime WebSocket с polling fallback.
- Staff, zones, schedule, chat, billing/subscription features.
- Analytics API и admin analytics UI присутствуют.
- Superadmin UI присутствует.
- iiko синхронизация присутствует.

## 3. Что не работает / не подтверждено запуском

- Полный frontend build пока не подтверждён: `npm ci` не завершился из-за недоступности сети среды, после неполной установки TypeScript сообщил об отсутствующих `@types/*`.
- Backend runtime/tests не подтверждены: чистая среда не содержит Django, а `pip install -r requirements.txt` блокируется отсутствием сети/DNS.
- Lighthouse не запускался.
- Docker compose runtime не запускался из-за отсутствия установленных образов/зависимостей.
- Service worker не найден — полноценный offline/update PWA flow отсутствует.
- Автоматический onboarding wizard 5–10 минут не найден.
- Rule-based Upsell Engine отсутствует.
- Demo Mode отсутствует.

## 4. Что работает частично

- PWA: manifest есть, но service worker/offline/update flow не найден.
- README: подробно описывает продукт, но архитектура устарела и всё ещё утверждает Firebase/Firestore/Auth как основной backend.
- QR flow до исправления: backend генерировал правильный URL, App видел query params, но QRScreen не подключал стол автоматически. Исправлено в текущем цикле.
- Analytics: код есть, но корректность расчётов на реальных данных ещё надо подтвердить runtime/integration тестами.
- Onboarding: отдельные CRUD-функции существуют, но цельного мастера подключения ресторана нет.

## 5. Критические баги

### P0-001 — direct QR не открывал стол автоматически — FIXED
Backend `Table.qr_url` создаёт `/?slug=<slug>&token=<token>`. `App.tsx` переводил пользователя на `QRScreen`, но экран не выполнял `guestInfo(token)` автоматически. Гость должен был сканировать QR второй раз или вручную вставлять token.

Исправление: `frontend/src/screens/QRScreen.tsx` теперь автоматически валидирует query token, проверяет slug, показывает loading/error state и открывает `TableScreen`.

### P0-002 — build/test не воспроизводится в текущей среде — ENV BLOCKER
Не кодовый дефект: среда не имеет доступа к npm/pip registry. Нужен повторный CI/runtime прогон в среде с зависимостями или сетью.

## 6. UX-проблемы

- Нет единого restaurant onboarding wizard.
- Для владельца нет одной точки «запустить ресторан» с последовательной проверкой: бренд → меню → столы → QR → персонал → тестовый заказ.
- Ошибки местами отдаются техническим текстом API.
- Нужен единый skeleton/empty/error/retry pattern для guest/admin/kitchen.
- Нет массового создания столов 1–N и пакетного экспорта QR в PDF.

## 7. UI-проблемы

- Визуальные системы guest/admin/kitchen существуют, но надо проверить consistency в mobile/desktop и light/dark.
- Нужны единые tokens для spacing/radius/typography/status colors.
- Kitchen должен иметь более жёсткую визуальную иерархию SLA/таймера/просрочки.

## 8. Архитектурные проблемы

- README сильно расходится с текущей архитектурой Django.
- В frontend нет явного router library; навигация держится в Zustand. Для текущего масштаба допустимо, но deep-linking нужно проверять особенно тщательно.
- Глобальная pagination отключена; отдельные list endpoints должны иметь caps/pagination.
- Feature flags тарифов частично реализованы, но enforcement должен быть проверен end-to-end на каждом API.

## 9. Firebase/Django проблемы

- Firebase фактически legacy-документация, а не активный data layer.
- Не нужно делать новую миграцию «с Firebase на Django»: Django уже является основной реализацией.
- Нужно удалить/переписать устаревшие инструкции Firebase только после подтверждения, что ни один production deploy больше от них не зависит.

## 10. Security

Сильные стороны:
- JWT rotation + blacklist.
- Restaurant-scoped permissions.
- Argon2.
- Upload MIME/size validation.
- Production SSL/HSTS/secure cookies.
- Swagger/Redoc только в DEBUG.
- Rate limit login/order/waiter calls.
- WebSocket staff restaurant isolation.

Открытые проверки:
- public restaurant detail/by-slug и `is_public` semantics;
- brute-force/abuse guest token endpoints;
- all list endpoint bounds;
- file signature validation beyond MIME;
- CSP отсутствует в текущем settings;
- secret rotation/deployment policy;
- full tenant isolation tests across every endpoint.

## 11. Performance

- Bundle split по отдельным HTML entrypoints есть, но внутри guest/admin/kitchen lazy route splitting почти отсутствует.
- Images идут через Cloudinary, но client-side responsive sizing/lazy loading надо проверить.
- Session сочетает WebSocket + polling 8s: хороший fallback, но важно исключить лишние запросы и duplicate listeners.
- Lighthouse/Web Vitals не измерены.

## 12. Mobile

- Guest flow mobile-first по структуре.
- QR camera flow реализован.
- Нужно прогнать реальные viewport: 360x800, 390x844, 412x915 и слабый Android/3G-4G throttling.

## 13. PWA

- `manifest.json`, `kitchen-manifest.json`, `superadmin-manifest.json` существуют.
- Service worker не найден.
- Offline cache/update prompt/installability не реализованы или не обнаружены.
- Отдельного admin manifest не найдено.

## 14. Realtime

- Channels/Redis реализованы.
- Staff JWT WebSocket middleware есть.
- Guest token валидируется до subscribe.
- Polling fallback у guest session есть.
- Нужно runtime проверить reconnect, Redis outage, duplicate reconnect и status propagation kitchen → guest/admin/waiter.

## 15. Business blockers

1. Нельзя доказать production-ready без зелёного CI/build/test.
2. Нет onboarding 5–10 минут.
3. Нет массового table/QR setup.
4. Нет rule-based upsell и измерения добавленной выручки.
5. Owner dashboard недостаточно ориентирован на business outcome.
6. Нет Sales Demo Mode.
7. PWA неполная без service worker.

## 16. Что мешает продать продукт сегодня

- Продавцу сложно за 3 минуты показать полностью воспроизводимый путь от QR до кухни и аналитики.
- Владельцу не показана измеримая «добавочная выручка» от Plait.
- Подключение ресторана требует знания внутренних экранов вместо guided onboarding.
- Нет доказанного regression suite для главного flow.

## 17. Что исправить первым

P0:
1. Direct QR auto-connect — DONE.
2. Воспроизводимый build/test в CI.
3. Tenant isolation regression tests.
4. Проверка order status propagation guest/admin/kitchen.

P1:
1. Restaurant onboarding wizard.
2. Bulk create tables + bulk QR export.
3. Critical guest flow tests.
4. Kitchen robustness/reconnect/status timers.
5. Complete error/loading/empty states.

P2:
1. Rule-based Upsell Engine v1.
2. Upsell analytics.
3. Owner dashboard business metrics.
4. Demo Mode.

## 18. Что не нужно трогать пока

- Не переписывать backend с нуля.
- Не возвращаться к Firebase как основному backend.
- Не менять auth stack без доказанной проблемы.
- Не подключать AI.
- Не делать большой design rewrite до стабилизации core flow.
- Не строить inventory/POS replacement раньше первых ресторанов, если интеграция с iiko/Poster закрывает потребность.
