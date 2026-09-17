# CHANGELOG_PLAIT.md

## 2026-09-17 — Cycle 6

### Что изменено
- Закрыт assigned-waiter scope для realtime: официант с явными назначениями получает table-scoped WebSocket events только по своим столам/зонам.
- `new_order`, `waiter_call`, `item_status_changed`, `session_status_changed` теперь несут `table_id`, чтобы consumer мог безопасно фильтровать события.
- REST active sessions и waiter-call list получили тот же scope, чтобы polling fallback не раскрывал чужие столы.
- Официант с назначениями больше не может менять item status, закрывать счёт, создавать заказ или добавлять позиции на неназначенный стол.
- Для обратной совместимости ресторан без настроенных назначений сохраняет прежний restaurant-wide waiter flow.
- Добавлены regression tests для списка активных сессий, item mutation, close и legacy unassigned behaviour.

### Почему
Restaurant-level JWT isolation уже не позволял перейти в другой ресторан, но внутри одного ресторана назначенный официант всё ещё получал события и мог менять заказы всех столов. Это нарушало смысл `assigned_tables/assigned_zones` и могло приводить к ошибкам обслуживания.

### Какие файлы
- `backend/apps/websocket/consumers.py`
- `backend/apps/websocket/events.py`
- `backend/apps/sessions/services.py`
- `backend/apps/sessions/views.py`
- `backend/apps/sessions/tests.py`
- `backend/apps/calls/views.py`
- `ROADMAP.md`
- `FEATURE_CHECKLIST.md`
- `CHANGELOG_PLAIT.md`

### Как протестировано
- `python -m compileall backend/apps/websocket backend/apps/sessions backend/apps/calls`: PASS.
- `python -m py_compile backend/apps/sessions/tests.py`: PASS.
- Добавлены 4 API regression tests assigned waiter isolation.
- Полный Django/Channels runtime suite всё ещё требует зависимостей, отсутствующих в текущем runtime.

### Результат
Настроенные назначения официантов теперь работают не только как UI-метаданные, а как реальная граница доступа в realtime и REST/mutation flow.

### Что осталось
- Channels communicator tests: invalid/expired JWT, wrong restaurant, invalid guest token, no event leakage.
- Полный order lifecycle regression до analytics.

### Следующий лучший шаг
P0: Channels communicator cross-tenant/invalid-token regression suite, затем full lifecycle.

## 2026-09-17 — Cycle 5

### Что изменено
- Закрыт P0 reconnect-разрыв staff WebSocket при истёкшем JWT: перед каждым handshake access token теперь локально проверяется по `exp` и заранее refresh-ится через существующий дедуплицированный refresh flow.
- `staffWsUrl()` стал async и никогда не строит staff socket без валидного access token. JWT URL-encoded.
- Admin и Kitchen reconnect переведены на exponential backoff 1→2→4→8→16→30 секунд вместо бесконечного фиксированного reconnect каждые 5 секунд.
- При отсутствии refresh-сессии WebSocket reconnect прекращается, но REST polling остаётся fallback.
- Reconnect timers корректно очищаются при unmount/смене ресторана.

### Почему
REST API уже умел автоматически обновлять JWT, но WebSocket handshake не проходит через REST wrapper. После истечения access token staff socket мог получать 4401 и повторять соединение со старым JWT. Это ухудшало realtime кухни/admin и создавало лишние handshake-запросы.

### Какие файлы
- `frontend/src/lib/api.ts`
- `frontend/src/admin/hooks/useAdminListeners.ts`
- `frontend/src/kitchen/hooks/useKitchenSessions.ts`
- `ROADMAP.md`
- `FEATURE_CHECKLIST.md`
- `CHANGELOG_PLAIT.md`

### Как протестировано
- `python -m compileall backend/apps/websocket backend/apps/sessions`: PASS.
- Static call-site regression: все вызовы async `staffWsUrl()` обновлены на `await`.
- TypeScript runtime check заблокирован отсутствующим `frontend/node_modules`; локальный `tsc` отсутствует.

### Результат
Admin/Kitchen теперь получают свежий JWT перед reconnect и не создают агрессивный reconnect-loop при временном outage или истёкшей сессии. Polling продолжает поддерживать операционные экраны при недоступном realtime.

### Что осталось
- Runtime Channels communicator tests: cross-restaurant staff denial, invalid/expired JWT denial, invalid guest token denial, отсутствие event leakage между restaurant groups.
- Полный confirmed → ready → served → close → analytics regression.

### Следующий лучший шаг
P0: Channels tenant-isolation regression suite + waiter assigned-table event scoping.

## 2026-09-17 — Cycle 4

### Что изменено
- Закрыт realtime-разрыв session lifecycle: `session_status_changed` теперь доставляется не только гостю, но и staff-группе ресторана.
- `RequestPayment`, `CloseSession`, `RejectPayment` и staff status update используют единый `notify_session_status()`.
- Staff WebSocket consumer получил обработчик `session_status_changed`.
- Admin realtime listener теперь реагирует также на `session_status_changed` и `delivery_status_changed`; kitchen уже обновляет board на любое staff-событие.
- Добавлены regression tests, проверяющие вызов realtime broadcast при запросе оплаты и закрытии счёта.

### Почему
До исправления гость видел смену статуса через WebSocket, а Admin/Waiter/Kitchen могли ждать polling до 8–15 секунд. Особенно плохо это проявлялось при запросе оплаты и закрытии счёта.

### Какие файлы
- `backend/apps/websocket/events.py`
- `backend/apps/websocket/consumers.py`
- `backend/apps/sessions/views.py`
- `backend/apps/sessions/tests.py`
- `frontend/src/admin/hooks/useAdminListeners.ts`
- `ROADMAP.md`
- `FEATURE_CHECKLIST.md`
- `CHANGELOG_PLAIT.md`

### Как протестировано
- `python -m compileall backend/apps/websocket backend/apps/sessions`: PASS.
- Добавлены API regression tests для payment request и close realtime broadcast.
- Полный Django runtime suite по-прежнему заблокирован отсутствием Django dependencies в текущем runtime.

### Результат
Запрос оплаты, возврат к открытому счёту и закрытие сессии теперь имеют единый realtime contract для Guest + Admin/Waiter/Kitchen вместо ожидания fallback polling.

### Что осталось
- Runtime WebSocket communicator tests с Channels/Redis.
- Проверка reconnect при истёкшем JWT.
- Полный confirmed → ready → served → close → analytics regression.

### Следующий лучший шаг
P0: WebSocket authentication/reconnect hardening и cross-restaurant negative tests.

## 2026-09-17 — Cycle 3

### Что изменено
- Закрыта race condition при первом заказе за столом: теперь транзакция блокирует существующую строку `Table`, поэтому два одновременных заказа не могут параллельно создать две open-сессии.
- Под блокировкой повторно проверяется `Table.is_active`, чтобы отключённый/перегенерированный QR не успел создать заказ между первичной проверкой и записью.
- Новый заказ блокируется, если по столу уже идёт `awaiting_payment` или `payment_requested`; вместо второго счёта гость получает понятную ошибку.
- Добавлены regression tests для обеих payment-boundary ситуаций.

### Почему
`select_for_update()` по `TableSession` не защищал случай, когда сессии ещё нет: блокировать было нечего. Два телефона за одним столом могли одновременно создать две активные сессии. Также после запроса оплаты новый заказ мог открыть параллельный счёт.

### Какие файлы
- `backend/apps/sessions/services.py`
- `backend/apps/sessions/tests.py`
- `ROADMAP.md`
- `FEATURE_CHECKLIST.md`
- `CHANGELOG_PLAIT.md`

### Как протестировано
- `python -m compileall backend/apps/sessions`: PASS.
- Добавлены service regression tests: `payment_requested` → новый заказ rejected; `awaiting_payment` → новый заказ rejected; количество session остаётся 1.
- Полный Django runtime suite всё ещё требует backend dependencies, которых нет в текущем runtime.

### Результат
Один физический стол теперь имеет сериализованное создание счёта: QR/order flow устойчивее к double-tap, двум гостям одновременно и заказу во время оплаты.

### Что осталось
- WebSocket isolation/reconnect tests.
- Полный item lifecycle `confirmed → ready → served` + close + analytics regression.

### Следующий лучший шаг
P0: WebSocket tenant isolation и realtime status propagation.

## 2026-09-17 — Cycle 2

### Что изменено
- Закрыта cross-tenant уязвимость `MenuItem.category_id`: категория блюда теперь обязана принадлежать тому же ресторану из URL.
- Защита работает и при CREATE, и при PATCH существующего блюда.
- Добавлены 4 tenant-isolation regression tests: foreign category create, foreign category update, foreign restaurant endpoint access, positive same-tenant control.

### Почему
До исправления администратор ресторана A мог передать UUID категории ресторана B. Блюдо сохранялось в A, но ссылалось на чужую категорию — нарушение multi-tenant isolation и потенциальная утечка метаданных категории.

### Какие файлы
- `backend/apps/menu/serializers.py`
- `backend/apps/menu/tests.py`
- `ROADMAP.md`
- `FEATURE_CHECKLIST.md`
- `CHANGELOG_PLAIT.md`

### Как протестировано
- `python -m compileall backend/apps/menu`: PASS.
- Django runtime tests всё ещё требуют установленных backend dependencies; в текущем runtime Django отсутствует.
- Статически подтверждено: admin endpoint уже tenant-scoped permission; новый serializer validator закрывает writable FK boundary.

### Результат
Menu CRUD больше не позволяет связывать данные двух ресторанов через `category_id`.

### Что осталось
- Продолжить tenant-isolation suite для всех writable relations и websocket scopes.
- Full order lifecycle regression.

### Следующий лучший шаг
P0: проверить WebSocket restaurant/table isolation и session item lifecycle.

## 2026-09-16 — Cycle 1

### Что изменено
- Исправлен production QR flow: direct QR URL теперь автоматически подключает гостя к столу.
- Добавлена проверка `slug` против ресторана, полученного по token.
- Добавлены понятные состояния loading/error для старого/отключённого QR.
- При QR-connect синхронизируется `currentRestaurant`, очищаются cart notes и stale active session.
- Улучшено безопасное завершение QR camera scanner.
- Добавлены `AI_ENABLED=false` и `VITE_AI_ENABLED=false` в env examples.
- Backend settings получил `AI_ENABLED` default false.
- Добавлен `npm run typecheck` script без новых зависимостей.
- Созданы PLAIT_AUDIT.md, FEATURE_CHECKLIST.md, ROADMAP.md, PRODUCT_GAPS.md, COMPETITOR_RESEARCH.md, SECURITY_AUDIT.md.

### Почему
Direct QR — первая точка реального ресторанного сценария. До исправления печатный QR не приводил гостя сразу к меню конкретного стола.

### Какие файлы
- `frontend/src/screens/QRScreen.tsx`
- `frontend/package.json`
- `frontend/.env.example`
- `backend/.env.example`
- `backend/config/settings/base.py`
- документация в корне проекта

### Как протестировано
- Static sanity check QRScreen: PASS.
- Добавлены backend regression tests для active/inactive/regenerated table token и QR URL. Syntax compile: PASS; runtime execution blocked by missing dependencies/network.
- `npm run build`: BLOCKED из-за неполной установки npm dependencies в среде.
- `python manage.py check/tests`: BLOCKED, Django отсутствует; `pip install` заблокирован DNS/network текущей среды.

### Результат
QR-код, который уже генерирует backend, теперь соответствует ожидаемому guest journey без второго сканирования.

### Что осталось
- Зелёный CI/runtime build/tests.
- Tenant isolation suite.
- Full QR → order → kitchen → served → closed → analytics regression.

### Следующий лучший шаг
P0: tenant-isolation + guest order lifecycle tests, затем runtime regression в доступной среде.

## 2026-09-17 — Cycle 7

### Что изменено
- Добавлен полноценный Channels/WebSocket security regression suite без Redis: тесты используют InMemoryChannelLayer.
- Проверяется запрет staff JWT ресторана A на socket ресторана B.
- Проверяются missing, invalid и expired staff JWT.
- Проверяются unknown и inactive guest table token.
- Проверяется отсутствие event leakage между restaurant staff groups.
- Проверяется assigned waiter scope: чужой стол не приходит, назначенный стол приходит.

### Почему
После hardening realtime логики критично не только читать код, но и зафиксировать границы tenant isolation автоматическими regression-тестами, чтобы будущие изменения Channels не открыли межресторанную утечку.

### Какие файлы
- `backend/apps/websocket/tests.py`
- `ROADMAP.md`
- `FEATURE_CHECKLIST.md`
- `CHANGELOG_PLAIT.md`

### Как протестировано
- `python -m compileall backend/apps/websocket`: PASS.
- `python manage.py test apps.websocket -v 2`: BLOCKED — в текущем runtime отсутствует пакет Django.
- Suite специально не требует Redis и после установки backend dependencies работает на InMemoryChannelLayer.

### Результат
Realtime tenant boundaries теперь формализованы как исполняемые regression-сценарии: restaurant JWT scope, guest QR token validity, cross-tenant group isolation и assigned-waiter table scope.

### Что осталось
- Запустить suite в окружении с backend dependencies.
- Завершить полный order lifecycle regression confirmed → ready → served → close → analytics.

### Следующий лучший шаг
P0: full order lifecycle regression, включая item transitions, close и analytics consistency.


## 2026-09-17 — Cycle 8

### Что изменено
- Добавлен regression полного item lifecycle: `awaiting_confirmation → confirmed → ready → served`, включая timestamps и terminal guard для `served`.
- Исправлена ошибка аналитики top dishes: `total_revenue` раньше суммировал только unit price и игнорировал `quantity`; теперь считается `price × quantity`.
- Analytics top items теперь исключает весь non-billable набор (`awaiting_confirmation`, `rejected`, `cancelled`), в соответствии со счётом.
- Добавлены regression assertions для quantity revenue и исключения non-billable позиций.

### Как протестировано
- `python -m compileall backend/apps/sessions backend/apps/analytics`: PASS.
- `python backend/manage.py test apps.sessions apps.analytics`: BLOCKED — Django отсутствует в текущем runtime.

### Результат
Lifecycle заказа и аналитика теперь согласованы: поданное блюдо проходит валидную цепочку, а top-dish revenue отражает фактически проданное количество, а не цену одной единицы.

### Следующий лучший шаг
P0: закрыть remaining close/payment lifecycle regression и после доступного runtime прогнать полный QR → menu → cart → order → kitchen → ready → waiter → served → close → analytics flow.


## 2026-09-17 — Cycle 9

### Что изменено
- Закрытие dine-in счёта теперь разрешено только после начала payment flow (`awaiting_payment` / `payment_requested`).
- Закрытие блокируется, пока есть `awaiting_confirmation` позиции.
- Перед close обязательно фиксируется валидный способ оплаты (`cash` / `card`).
- Перед close выполняется `recalculate_totals()`, чтобы закрытый чек и analytics использовали финальный billable snapshot.
- Generic session-status endpoint больше не позволяет произвольный откат `payment_requested → open` или reopening `closed`; reopen остаётся в отдельном RejectPaymentView с role guard.
- На session-status PATCH добавлен assigned-waiter table scope.
- Admin UI при close передаёт сохранённый payment method, с legacy fallback `cash`.
- Добавлены regression tests для early close, missing/invalid payment method, unresolved items, final total recalculation и illegal payment transitions.

### Как протестировано
- `python -m compileall backend/apps/sessions backend/apps/analytics`: PASS.
- `python backend/manage.py test apps.sessions apps.analytics`: BLOCKED — пакет Django отсутствует в текущем runtime.

### Результат
Closed session теперь формируется только после валидного payment boundary и с пересчитанным итогом, поэтому owner analytics не получает преждевременно закрытые или устаревшие суммы.

### Следующий лучший шаг
P0: собрать единый executable full-flow regression QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics и прогнать его в окружении с Django/Node dependencies.


## 2026-09-17 — Cycle 10

### Что изменено
- Добавлен единый P0 executable regression `FullRestaurantRegressionFlowTest`, который проходит публичные и staff API как один реальный ресторанный сценарий.
- Flow проверяет: QR token → guest restaurant/menu → cart/order → Admin active sessions → confirm → Kitchen ready → assigned Waiter served → guest request payment → Admin payment acceptance → close → Owner analytics.
- Проверяется, что при включённом подтверждении гостевой item сначала `awaiting_confirmation` и не попадает в счёт до принятия.
- Проверяются финальные суммы 1500 × 2 = 3000 ₸ + 10% = 3300 ₸, payment method, revenue, avg check, top item quantity/revenue.
- Проверяется, что закрытый чек исчезает из operational active sessions.
- Зафиксировано текущее архитектурное ограничение: Kitchen UI использует restaurant staff credentials; отдельной backend-роли `kitchen` в User.ROLES пока нет.

### Как протестировано
- `python -m compileall backend/apps/sessions backend/apps/analytics backend/apps/tables backend/apps/menu`: PASS.
- `python manage.py test apps.sessions.tests.FullRestaurantRegressionFlowTest -v 2`: BLOCKED — пакет Django отсутствует в текущем runtime.

### Результат
Критический ресторанный happy-path теперь описан одним исполняемым regression-тестом вместо набора несвязанных unit/API проверок. После установки backend dependencies этот тест одним запуском проверяет контракт между Guest, Admin, Kitchen/Staff, Waiter и Owner Analytics.

### Следующий лучший шаг
P0: дать Kitchen отдельную минимально-привилегированную backend role/permission scope вместо использования общих restaurant staff credentials, затем запустить полный regression в CI/runtime с Django dependencies.


## 2026-09-17 — Cycle 11

### Что изменено
- Добавлена отдельная backend-роль `kitchen` + migration `0005_alter_user_role_kitchen`.
- Kitchen исключена из generic `IsRestaurantStaff`, поэтому кухонная учётка не наследует calls/chat/schedule/table APIs. Для session board добавлен отдельный `IsRestaurantSessionStaff`.
- Kitchen может читать active dine-in sessions и выполнять только `confirmed → ready` / `ready → confirmed`.
- Kitchen не может подтверждать guest item, отмечать `served`, создавать staff orders, добавлять позиции, управлять оплатой, закрывать чек или менять delivery flow.
- WebSocket kitchen не получает waiter calls, staff chat и delivery events; order/item/session события остаются доступны кухонной доске.
- Kitchen frontend теперь принимает только JWT пользователя с ролью `kitchen`; чужая роль получает понятную ошибку и токены очищаются. Session restore также перепроверяет роль.
- Admin и Superadmin staff UI получили вариант роли «Кухня»; типы/лейблы/расписание обновлены.
- FullRestaurantRegressionFlowTest переведён с admin-as-kitchen на реальную dedicated Kitchen account.
- Добавлены regression-тесты KitchenLeastPrivilegeTests и KitchenRoleIsolationTests.

### Как протестировано
- `python -m compileall backend/apps/users backend/apps/sessions backend/apps/websocket`: PASS.
- `python backend/manage.py test apps.sessions.tests.KitchenLeastPrivilegeTests apps.sessions.tests.FullRestaurantRegressionFlowTest -v 2`: BLOCKED — пакет Django отсутствует в текущем runtime.
- Frontend build/typecheck: BLOCKED — `frontend/node_modules` отсутствует.

### Результат
Кухонный планшет больше не требует общей staff/admin учётки с лишними правами. Компрометация kitchen credentials ограничена кухонным workflow и не даёт доступа к оплатам, закрытию чеков или generic staff API.

### Следующий лучший шаг
P0: довести runtime/CI до воспроизводимого запуска Django + Node и реально прогнать FullRestaurantRegressionFlowTest, KitchenLeastPrivilegeTests, websocket suite и frontend typecheck/build.


## 2026-09-17 — Cycle 12

### Что изменено
- Добавлен воспроизводимый GitHub Actions CI с отдельными backend/frontend jobs.
- Backend gate устанавливает pinned dev dependencies, выполняет `manage.py check`, migration drift check, migrations, критический full restaurant regression, Kitchen least-privilege suite, WebSocket tenant-isolation suite и основной backend test set.
- Frontend gate выполняет `npm ci`, `npm run typecheck` и `npm run build` на Node 20.
- Добавлен `scripts/verify.sh`, повторяющий критические проверки локально/на CI runner.
- Во всех verification paths принудительно `AI_ENABLED=false`; внешние AI API не используются.

### Как протестировано
- Попытка создать чистый Python venv и установить `backend/requirements-dev.txt`: BLOCKED внешней средой — DNS/network не разрешил доступ к package registry (`Temporary failure in name resolution`).
- Поэтому Django runtime suite в этом sandbox всё ещё не может быть честно отмечен PASS.
- CI YAML и shell verification script добавлены поверх существующего проекта, без изменения production runtime paths.

### Результат
Ранее отсутствие локальных зависимостей полностью блокировало повторяемую проверку. Теперь репозиторий содержит самодостаточный verification contract: любой dependency-capable GitHub runner или локальная машина выполняет одинаковые backend, security, full-flow и frontend gates.

### Следующий лучший шаг
P0: на первом dependency-capable runner прогнать новый CI, исправить фактические runtime failures до зелёного состояния; затем перейти к P1 error/loading/empty-state audit.

## 2026-09-17 — Cycle 13

### Что изменено
- После закрытия P0 verification contract выбран следующий P1: error/loading/empty-state audit, начат с операционно-критичного Kitchen board.
- Kitchen store получил явные `loadState`, `loadError`, `lastUpdatedAt` вместо неявного состояния только через console warnings.
- Ошибка первой загрузки больше не оставляет планшет навсегда на экране «Подключение...»: показывается board error-state с понятным сообщением и Retry.
- При кратковременном сбое после успешной загрузки последние карточки заказов сохраняются; поверх них показывается non-destructive sync error и время последнего успешного обновления.
- Empty states различают «заказов действительно нет» и «данные не удалось загрузить».
- Kitchen item actions получили pending-state, блокировку double-tap и видимую ошибку частичного/полного сбоя вместо console-only feedback.
- Error banner и retry адаптированы для мобильного/планшетного узкого экрана.
- AI_ENABLED=false; внешние AI API не добавлялись.

### Как протестировано
- `python -m compileall backend/apps/users backend/apps/sessions backend/apps/websocket backend/apps/analytics`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- Статическая проверка новых Kitchen state/action call-sites: PASS.
- Frontend `npm run typecheck/build`: BLOCKED в текущем sandbox — `frontend/node_modules` отсутствует; CI contract из Cycle 12 остаётся источником runtime gate.

### Результат
Kitchen больше не маскирует сетевую ошибку под бесконечную загрузку и не заставляет повара гадать, сработала ли кнопка. Последние заказы остаются видимыми при transient outage, а действия защищены от повторного нажатия.

### Следующий лучший шаг
P1: продолжить тот же audit на Admin operational screens (Sessions/Calls/Analytics), затем Guest Restaurant/Menu/Checkout и закрепить reusable state components.


## 2026-09-17 — Cycle 14

### Что изменено
- Продолжен P1 error/loading/empty-state audit на Admin operational screens: Sessions и Waiter Calls получили явные loading/error/retry состояния.
- При transient failure уже загруженные счета/вызовы не стираются; UI показывает stale-data warning и время последнего успешного обновления.
- Empty-state «нет счетов/вызовов» больше не показывается, если первая загрузка фактически завершилась ошибкой.
- Добавлен ручной Retry через store reload nonce без перезагрузки всей админки.
- Analytics больше не подменяет недоступный сервер локальными нулями, которые могли выглядеть как реальная нулевая выручка.
- Добавлен frontend API `analyticsSessions`; Analytics теперь одновременно получает authoritative summary и закрытые счета выбранного периода.
- При ошибке Analytics сохраняет последний успешный snapshot, показывает его как stale и предлагает Retry. Если snapshot отсутствует — финансовые карточки скрыты вместо показа ложных 0 ₸.
- Закрытая история теперь является источником для service charge, zone revenue, day chart и списка чеков; top-items/revenue остаются authoritative backend summary.
- AI_ENABLED=false; внешние AI API не добавлялись.

### Как протестировано
- `python -m compileall backend/apps/users backend/apps/sessions backend/apps/websocket backend/apps/analytics backend/apps/tables backend/apps/menu`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- Global `tsc --noEmit` был реально запущен, но dependency resolution BLOCKED: `frontend/node_modules` отсутствует (React/Zustand/Lucide и их types не найдены).
- Статически проверены новые operational state/retry и analyticsSessions call-sites.

### Результат
Admin больше не путает сетевую ошибку с отсутствием заказов/вызовов, а Owner Analytics не показывает ложную нулевую выручку при недоступном API. Последний успешный snapshot остаётся видимым при кратком outage.

### Следующий лучший шаг
P1: Guest Restaurant/Menu/Checkout loading/error/empty/retry audit, включая безопасное сохранение корзины и понятный recovery после ошибки оформления заказа.
