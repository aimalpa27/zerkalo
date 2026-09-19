# CHANGELOG_PLAIT.md

## 2026-09-20 — Cycle 51

### Что изменено
- Доведён P0 analytics fix из Cycle 50 до main.
- Добавлен отсутствующий operations_exception_kpi в frontend DjangoSummary contract.
- Сохранены tenant/role/realtime boundaries; AI_ENABLED=false.

### Проверка
- Предыдущий CI подтвердил 13/14 critical backend tests; единственный backend blocker был старый analytics crash.
- Запускается новый полный CI после этого коммита.

## 2026-09-20 — Cycle 50

### Что изменено
- Исправлен P0 crash Owner Analytics в конце полного ресторанного lifecycle: удалены undefined `start/end`.
- Service Recovery, SLA и Operations Exception coverage теперь используют единый validated `from/to` date-window и tenant scope.
- Frontend analytics contract синхронизирован с operational sections Django response.
- AI_ENABLED=false; внешние AI API не подключались.

### Проверка
- Изменения минимальные и не меняют Guest/Admin/Manager/Waiter/Kitchen permission boundaries или CRUD/realtime flows.
- После коммита требуется полный CI: backend regression + frontend typecheck/build + QR→menu→cart→order→admin→kitchen→ready→waiter→served→close→analytics.

## 2026-09-17 — Cycle 20

### Что изменено
- Реализован P1 CSV/XLSX Menu Import без внешних runtime-зависимостей.
- Добавлен server-side preview/dry-run: до записи ресторан видит количество новых блюд, дублей и построчные ошибки.
- Импорт поддерживает русские/английские заголовки, CSV с `,`/`;`/tab и XLSX (OOXML), категории, цену, описание, вес, станцию Kitchen/Bar, availability/visibility.
- Запись атомарная: любая validation error блокирует весь import; существующие блюда по имени пропускаются, категории создаются внутри tenant.
- Admin/Manager могут импортировать; Waiter/Kitchen и чужой restaurant получают 403 через существующий permission boundary.
- Добавлен mobile-friendly import modal с file validation, loading, preview table, error/empty states и double-submit protection.

### Как протестировано
- `python -m compileall backend/apps/menu`: PASS.
- Pure CSV parser smoke test с кириллицей/ценой `2 500,50`: PASS.
- `node --check frontend/public/sw.js`: PASS; `bash -n scripts/verify.sh`: PASS.
- Добавлены Django regression tests: preview no-write, commit, category/station mapping, atomic invalid row, existing duplicate skip, Manager allowed, Waiter denied, cross-tenant denied.
- Полный Django runtime и frontend typecheck/build в текущем sandbox заблокированы отсутствующими Django/node_modules; CI regression gate сохранён.

### Результат
Первый ресторан может перенести существующее меню из Excel/CSV вместо ручного ввода десятков блюд.

### Что осталось
P0 runtime gates всё ещё требуют dependency-capable runner. Следующая новая функциональная задача по roadmap — P2 Sales Demo Mode; однако P1 Operational monitoring/SLO/alerting остаётся более высоким приоритетом в Phase 4 и должен быть оценён перед P2.

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


## 2026-09-17 — Cycle 15

### Что изменено
- Завершён P1 error/loading/empty-state audit на Guest Restaurant/Table/Menu/Cart/Checkout.
- Guest menu получил явные `loading / error / empty / retry` состояния вместо бесконечного Spinner при пустом меню или сетевой ошибке.
- При transient menu failure последний успешный snapshot остаётся на экране с предупреждением и временем обновления; ошибка больше не маскируется под «пустое меню».
- Исправлен важный QR/table contract: `TableScreen` теперь передаёт `tableToken` в `useMenu`, поэтому стол обновляет меню через публичный `/guest/<token>/`, а не через generic restaurant path.
- QR connect теперь маппит guest menu через единый `mapDjangoMenuItem`, устраняя расхождение формата между первым QR render и последующим refresh.
- Добавлен restaurant/table-scoped cart draft в `localStorage` с TTL 24 часа. Draft восстанавливается только для того же ресторана и, для dine-in, того же QR table token; недоступные позиции удаляются только после успешной загрузки меню.
- Сетевой сбой меню или оформления заказа больше не очищает корзину. Draft очищается только после подтверждённого успешного order API response.
- Dine-in CartSheet и Delivery/Pickup Checkout получили видимую ошибку отправки, защиту от double-submit и понятный retry; введённые данные/корзина остаются на месте.
- Добавлены отдельные empty states для реально пустого меню и пустой выбранной категории.
- AI_ENABLED=false; внешние AI API не добавлялись.

### Как протестировано
- `python -m compileall backend/apps/users backend/apps/sessions backend/apps/websocket backend/apps/analytics backend/apps/tables backend/apps/menu`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- Global `tsc --noEmit` запущен: runtime dependency resolution по-прежнему BLOCKED отсутствующим `frontend/node_modules` (React/Zustand/Lucide types); отдельная фильтрация изменённых файлов не выявила новых синтаксических ошибок сверх dependency/cascade type errors.
- Статически проверены QR → mapped guest menu → table public refresh, scoped cart restore/prune, failed order preservation и successful-order draft clear.

### Результат
Гость теперь не теряет корзину из-за refresh/краткого обрыва сети и понимает разницу между загрузкой, реальным пустым меню и ошибкой сервера. Повторная отправка заказа безопаснее, а QR-table menu refresh использует правильный публичный guest contract.

### Следующий лучший шаг
P1: PWA service worker/update strategy — offline shell, safe update prompt, cache boundaries для guest assets и запрет кэширования transactional/order API responses.

## 2026-09-17 — Cycle 16

### Что изменено
- Закрыт P1 PWA service worker/update strategy для guest application shell.
- Добавлен собственный `public/sw.js` без внешних PWA/AI-зависимостей: offline fallback для navigation и cache-first + background refresh только для same-origin static assets.
- Transactional/non-GET requests и API семейств sessions/orders/payments/analytics/waiter/calls/auth принципиально не перехватываются service worker, поэтому устаревший cache не может подменить заказ, оплату, вызов или аналитику.
- Добавлена регистрация SW только production-сборке и безопасный update flow: новая версия ждёт явного действия пользователя, затем `SKIP_WAITING` + один controlled reload.
- Guest App показывает компактный mobile-friendly prompt «Доступно обновление Plait» с действиями «Обновить / Позже»; существующий 24h cart draft переживает reload.
- AI_ENABLED=false; внешние AI API не добавлялись.

### Как протестировано
- `python -m compileall backend/apps/users backend/apps/sessions backend/apps/websocket backend/apps/analytics backend/apps/tables backend/apps/menu`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Статически проверены cache boundaries: non-GET и transactional API bypass; navigation offline fallback; static same-origin caching only.
- Frontend typecheck/build остаются runtime-blocked отсутствующим `frontend/node_modules`; CI contract выполняет их на dependency-capable runner.

### Результат
Plait теперь имеет контролируемую PWA update strategy: гость может открыть уже загруженный shell при кратком offline, статические ресурсы повторно используются, но критические ресторанные операции никогда не берутся из stale cache. Обновление приложения не происходит неожиданно посреди оформления заказа.

### Следующий лучший шаг
P1: Onboarding wizard для первых ресторанов — restaurant profile → menu → tables/QR → staff → go-live checklist.


## 2026-09-17 — Cycle 17

### Что изменено
- Реализован P1 Onboarding Wizard поверх существующих restaurant/menu/table/staff API: профиль → меню → столы/QR → команда → Go Live.
- Readiness считается по реальным данным: заполненные name/address/working_hours, минимум одно видимое+доступное блюдо, активный стол и operational staff.
- Добавлен inline profile editor, переходы в существующие Menu/Tables/Staff CRUD, guest preview и mobile bottom-sheet layout.
- Go Live имеет loading/error/retry и double-submit protection; restaurant state обновляется из authoritative API response.
- Backend `RestaurantSettingsSerializer` теперь не позволяет обойти onboarding прямым PATCH `is_public=true`: readiness повторно проверяется сервером.
- Добавлены regression tests: incomplete restaurant rejected, Admin/Manager publish ready restaurant, Waiter/Kitchen receive 403.
- Исправлена загрузка restaurant state в Admin login/session restore: Django snake_case теперь всегда проходит через `mapDjangoRestaurant`, поэтому `isPublic`, `workingHours` и остальные camelCase поля не теряются.
- AI_ENABLED=false; внешние AI API не добавлялись.

### Как протестировано
- `python -m compileall backend/apps/restaurants`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Backend Django runtime tests: BLOCKED — Django отсутствует в текущем runtime.
- Frontend typecheck/build: BLOCKED — `frontend/node_modules` отсутствует.
- Полный executable regression QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся в `scripts/verify.sh`, но в этом sandbox не может быть честно запущен без зависимостей.

### Результат
Новый ресторан получает конкретный self-service путь до публикации, а публичный статус нельзя включить обходным API-вызовом до реальной готовности. Это сокращает ручное подключение ресторана и защищает гостя от пустого QR-меню.

### Следующий лучший шаг
Сначала прогнать уже подготовленные P0 runtime regression gates на dependency-capable runner; если они green — P1 Bulk tables 1–N с atomic duplicate handling и tariff limits.


## 2026-09-17 — Cycle 18

### Что изменено
- Реализован P1 Bulk tables 1–N через отдельный `POST /restaurants/<rest_id>/tables/bulk/`.
- Создание диапазона атомарное: при любом существующем номере весь batch отклоняется без частично созданных столов.
- Backend проверяет диапазон 1..9999, максимум 200 столов за запрос, тарифный `max_tables`, принадлежность зоны ресторану и tenant/role permissions.
- Для конкурентных запросов restaurant row блокируется `select_for_update`, чтобы параллельные batch не обходили лимит тарифа.
- Admin и Manager могут создавать диапазон; Waiter/Kitchen и staff другого ресторана получают 403.
- Admin Tables UI получил mobile-friendly «Столы 1–N»: диапазон, optional zone, loading/double-submit guard, duplicate/range/tariff error states и authoritative merge ответа backend.
- Каждый новый стол сразу получает token/QR URL через существующую модель, поэтому guest QR flow остаётся совместимым.
- Добавлены backend regression tests: success 1–10, Manager access, atomic duplicate rollback, invalid/oversized range, tariff rollback, foreign zone, Waiter/Kitchen denial, cross-tenant denial.
- AI_ENABLED=false; внешние AI API не добавлялись.

### Как протестировано
- `python -m compileall backend/apps/tables`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Django runtime suite: BLOCKED — Django отсутствует в текущем runtime.
- Frontend typecheck/build: BLOCKED — `frontend/node_modules` отсутствует.
- Полный executable regression QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся в `scripts/verify.sh`; runtime execution требует установленных dependencies.

### Результат
Ресторан с 20–50 столами больше не требует ручного создания каждого стола. Массовая операция безопасна: конфликт номера или тарифного лимита не оставляет зал в частично созданном состоянии.

### Следующий лучший шаг
P1: Bulk QR PDF export — после массового создания столов одной операцией получить готовый печатный PDF со всеми QR-кодами.

## 2026-09-17 — Cycle 19

### Что изменено
- Закрыт P1 Bulk QR PDF export поверх существующей Tables/QR реализации без новых runtime-зависимостей.
- Admin/Manager получили действие «Скачать PDF» рядом с существующей печатью QR; Waiter/Kitchen не получают export UI.
- PDF формируется полностью локально в браузере: QR не отправляются во внешний сервис, AI/API/ключи не используются.
- Добавлен dependency-free PDF 1.4 writer: A4 portrait, 4 крупных карточки на страницу, название ресторана, «Стол №N», подсказка гостю и plait.kz.
- Для корректного русского/казахского текста карточка сначала рендерится в Canvas системным шрифтом, затем помещается в PDF как JPEG; внешние font-файлы не нужны.
- Экспорт использует authoritative table token/restaurant slug и существующий QR contract, поэтому скачанный QR ведёт в тот же Guest flow, что одиночный QR и печать.
- Добавлены loading/double-submit guard, empty guard, видимая ошибка генерации и success toast с количеством QR.
- Сохранена отдельная «Печать» как fallback для браузеров/устройств, где скачивание PDF ограничено.
- AI_ENABLED=false; OpenAI/Gemini/Claude/Groq/Mistral и другие внешние AI API не добавлялись.

### Как протестировано
- `tsc --noEmit --target ES2020 --module ESNext --lib ES2020,DOM src/admin/lib/qrPdf.ts`: PASS.
- `python -m compileall -q backend/apps/tables`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Полный `npm run typecheck/build`: BLOCKED отсутствующим `frontend/node_modules`; установка зависимостей в текущем runtime упёрлась в network timeout.
- Полный `scripts/verify.sh` / Django regression QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics: BLOCKED отсутствующим Django в runtime; executable gate сохранён без ослабления.

### Результат
После массового создания столов ресторан может одним действием скачать готовый A4 PDF со всеми QR и сразу отправить его в печать. Это убирает ручную выгрузку QR по одному и завершает связку Bulk tables → Bulk QR для подключения первого зала.

### Следующий лучший шаг
P1: CSV/XLSX menu import — массовая загрузка категорий/позиций с preview, validation, duplicate strategy и atomic import вместо ручного ввода меню.


## 2026-09-18 — Cycle 21

### Что изменено
- Закрыт P1 Operational monitoring/SLO foundation без внешних AI/API.
- Добавлен публичный `GET /health/live`: минимальный process probe без auth и без tenant/system metadata.
- Добавлен `GET /health/ready`: fail-closed проверка database + Django cache + Channels realtime; любой dependency failure возвращает HTTP 503.
- Readiness не возвращает URL, credentials, exception text, версии или tenant data; latency выдаётся только по имени dependency.
- Realtime readiness делает реальный Channels group add/discard, поэтому проверяет доступность channel layer, а не только наличие настройки.
- Добавлены regression tests на public liveness, GET-only contract, successful readiness, DB/cache/realtime 503 и отсутствие утечки exception text.
- `scripts/verify.sh` теперь запускает health regression до полного ресторанного flow.
- Добавлен `docs/OPERATIONS.md`: initial SLO targets, alert thresholds и короткий incident runbook.
- AI_ENABLED=false; внешние AI API не добавлялись.

### Как протестировано
- `python -m compileall backend/config`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- Static URL/probe contract inspection: PASS.
- Попытка установить backend dev dependencies: BLOCKED DNS (`asgiref==3.11.1` не удалось получить), поэтому Django runtime tests и полный QR→analytics regression в этом sandbox честно не отмечены PASS.
- Frontend не изменялся в Cycle 21; предыдущий frontend runtime gate остаётся dependency-blocked.

### Результат
Deployment-платформа теперь может отличить живой процесс от экземпляра, который нельзя пускать к ресторанному трафику из-за DB/cache/realtime. Это создаёт базу для автоматического restart/traffic removal и SLO alerting без раскрытия инфраструктурных секретов.

### Следующий лучший шаг
Сначала P0 runtime confirmation на dependency-capable runner. Если gate green — P2 Sales Demo Mode как следующий незакрытый продуктовый приоритет.


## 2026-09-18 — Cycle 22

### Что изменено
- Закрыт P2 Sales Demo Mode без backend mutation и без внешних AI/API.
- На стартовом экране Admin добавлен отдельный «Демо для ресторана» без логина и без production JWT.
- Демо полностью изолировано от production data: не запускает admin REST listeners/WebSocket и не вызывает CRUD endpoints.
- Реализован интерактивный lifecycle из 8 стадий: QR → cart → order → Admin confirm → Kitchen preparing/ready → Waiter served → close → Owner analytics.
- Можно вручную переключаться между Guest/Admin/Kitchen/Waiter/Owner view, при этом текущая стадия подсвечивает ответственную роль.
- Owner view показывает демонстрационное изменение выручки и количества закрытых счетов только после финального close.
- Добавлены mobile/desktop responsive layout, progress, reset, completion state и явная маркировка SALES DEMO / production данные не изменяются.
- AI_ENABLED=false; OpenAI/Gemini/Claude/Groq/Mistral и другие внешние AI API не добавлялись.

### Как протестировано
- Static integration inspection: AdminApp route + ModeScreen entry + isolated SalesDemoScreen: PASS.
- `python -m compileall backend`: PASS (backend не менялся).
- `bash -n scripts/verify.sh`: PASS.
- `npm run typecheck`: BLOCKED отсутствующими frontend dependencies; TypeScript parser дошёл до проекта, но React/lucide/zustand modules отсутствуют.
- `npm ci`: повторно BLOCKED network/container timeout, поэтому production build честно не отмечен PASS.
- Django runtime/full QR→analytics regression остаётся dependency-blocked в текущем sandbox и не ослаблялся.

### Результат
Продажник или основатель может показать ресторану полный путь Plait за 1–2 минуты без логина, тестового ресторана и риска изменить реальные заказы. Демо подчёркивает не отдельный QR, а ценность всей цепочки Guest → персонал → Owner analytics.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым при появлении dependency-capable runner. Из продуктовых задач следующий P2 — Support/admin diagnostics; после него Rule-based Upsell Engine.


## 2026-09-18 — Cycle 23

### Что изменено
- Закрыт P2 Support/admin diagnostics без внешних AI/API.
- Добавлен защищённый `GET /api/v1/restaurants/<rest_id>/diagnostics/` для Admin/Manager своего ресторана и Plait superadmin.
- Snapshot показывает только безопасные operational-сигналы: DB/cache/realtime boolean health, количество активных столов/блюд/сотрудников/открытых счетов, статус публикации/подписки и факт настройки iiko без API key.
- Добавлены actionable warnings: ресторан не опубликован, нет активных столов, нет доступного меню, нет активного staff, degraded dependency.
- Endpoint намеренно не отдаёт raw logs, customer PII, exception text, DB/Redis URLs, credentials, API keys или версии инфраструктуры.
- Admin desktop/sidebar и mobile drawer получили раздел «Диагностика» с loading/error/retry, dependency cards, operational counts, warnings и timestamp. Waiter/Kitchen UI не получают этот раздел, backend также возвращает 403.
- Добавлены regression tests: Admin snapshot, Manager access, Waiter denial, cross-tenant denial и проверка отсутствия секретных полей.
- AI_ENABLED=false; внешние AI API не добавлялись.

### Как протестировано
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Target Django diagnostics tests: BLOCKED — Django отсутствует в текущем runtime.
- `npm run typecheck`: BLOCKED неполным `node_modules` из предыдущего архива (отсутствуют @types/react/@types/babel и другие type definitions); это dependency state, не TypeScript diagnostic нового экрана.
- Полный QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся в `scripts/verify.sh` и не ослаблялся; runtime требует Django dependencies.

### Результат
Поддержка и администратор ресторана теперь могут за один экран понять, готов ли ресторан принимать QR-заказы и какой слой требует внимания, не получая доступ к секретам или данным гостей. Это сокращает время диагностики инцидента и делает поддержку первых десятков ресторанов масштабируемее.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым при dependency-capable runner. Следующий незакрытый продуктовый P2 — Rule-based Upsell Engine с полностью детерминированными правилами при AI_ENABLED=false.

## 2026-09-18 — Cycle 24

### Что изменено
- Закрыт P2 Rule-based Upsell Engine полностью детерминированно при `AI_ENABLED=false`.
- Добавлена модель `UpsellRule`: trigger dish → recommended dish, priority, active flag; unique pair и запрет self-recommendation на уровне БД.
- Admin/Manager получили tenant-safe CRUD `/restaurants/<rest_id>/upsell-rules/`; Waiter/Kitchen не имеют доступа, foreign menu items отклоняются.
- Guest QR endpoint отдаёт только активные правила, где trigger и recommendation доступны и видимы. Недоступное/скрытое блюдо никогда не предлагается.
- Guest cart больше не показывает случайные первые 20 блюд: рекомендации появляются только по правилам ресторана, если trigger уже в корзине; уже добавленные позиции исключаются, priority соблюдается, дубли схлопываются.
- В Menu Manager добавлена mobile-friendly панель «Умные допродажи без AI» с create/list/delete, loading/empty/error feedback.
- Добавлены backend regression tests для Admin CRUD, Waiter denial, cross-tenant item rejection и Guest sellability filtering.
- Никакие OpenAI/Gemini/Claude/Groq/Mistral или другие внешние AI API не подключались.

### Как протестировано
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- `npm run typecheck`: BLOCKED неполным `node_modules` (React/lucide/zustand и type declarations отсутствуют); существующие unrelated TS diagnostics также видимы после missing-module errors.
- Django runtime/full QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics: BLOCKED отсутствующим Django runtime dependency; regression gate сохранён.

### Результат
Ресторан теперь сам задаёт точные допродажи вроде «бургер → Cola» или «кофе → десерт». Гость видит релевантное дополнение прямо в корзине, а Plait получает revenue-механику без AI-стоимости, внешних API и недетерминированных рекомендаций.

### Следующий лучший шаг
P2 Upsell analytics: фиксировать impression/accept/conversion и дополнительную выручку, чтобы Owner видел доказуемый эффект правил.


## 2026-09-18 — Cycle 25

### Что изменено
- Закрыт P2 Upsell Analytics при `AI_ENABLED=false`.
- Добавлены privacy-safe события impression/add/conversion для детерминированных upsell-правил.
- Guest impression/add принимаются только для активного sellable rule текущего QR-стола; cross-tenant rule возвращает 404.
- Checkout передаёт `upsell_rule_id` только для позиции, добавленной через recommendation. Backend считает conversion только если rule принадлежит ресторану, recommended item совпадает, а trigger item присутствует в том же заказе.
- Дополнительная выручка считается сервером по фактической цене и quantity заказанной upsell-позиции, а не по клиентскому числу.
- Owner Analytics получил funnel: показы → добавления → покупки → conversion rate → доказанная дополнительная выручка + топ правил.
- Добавлены regression tests на public event tracking, tenant isolation и owner funnel aggregation.
- Внешние AI API не подключались.

### Следующий лучший шаг
P2 Owner business dashboard v2: retention-oriented KPI, сравнение периодов и операционные SLA поверх уже авторитетной аналитики.

## 2026-09-18 — Cycle 26

### Что изменено
- Закрыт P2 Owner Business Dashboard v2 при `AI_ENABLED=false`.
- Analytics summary теперь возвращает сравнение выбранного периода с предыдущим окном той же длины: выручка, средний чек, закрытые счета и процент изменения.
- Добавлены операционные KPI по закрытым dine-in сессиям: загрузка активных столов, среднее время стола, лучший час и лучший день по выручке.
- Загрузка считается как доля фактически занятого времени активных столов в выбранном календарном окне; delivery/pickup исключены, чтобы не искажать показатель.
- Owner/Admin экран получил mobile-friendly блоки «Динамика бизнеса» и «Операционные KPI», сохранив Upsell revenue proof и существующие top dishes/zones/history.
- Нулевая база прошлого периода показывается как «нет базы сравнения», а не как ложные бесконечные проценты.
- Добавлены regression tests на period comparison, operational KPI, Admin/Manager access, Waiter denial и cross-tenant isolation.
- Внешние AI API не подключались.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым техническим gate. Следующий продуктовый P2 — Multi-location/network owner dashboard, если P0 runner всё ещё недоступен.

### Проверка Cycle 26
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- `npm run typecheck`: BLOCKED dependency state — отсутствуют `react`, `react/jsx-runtime`, `lucide-react`, `zustand` и другие frontend packages; runner также показывает ранее существующие downstream diagnostics после missing-module errors.
- Django runtime/full regression: BLOCKED — `ModuleNotFoundError: django` в текущем runner. Regression gate QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics сохранён без ослабления.

## 2026-09-18 — Cycle 27

### Что изменено
- Реализован P2 Multi-location / Network Owner Dashboard при `AI_ENABLED=false`.
- Добавлена tenant-safe модель `RestaurantNetwork`: основной ресторан-владелец + проверенный набор филиалов.
- Admin основного ресторана может создать сеть и видеть consolidated dashboard; Manager/Waiter/Kitchen и администратор чужого ресторана не получают сетевую аналитику.
- Подключение/отключение филиалов намеренно доступно только `superadmin`: владелец сети не может сам присвоить чужой tenant по UUID. Это закрывает cross-tenant escalation.
- Network analytics агрегирует только authoritative closed sessions: общая выручка, закрытые счета, средний чек, upsell revenue и рейтинг филиалов.
- Добавлен mobile/desktop Owner UI: create-network empty state, loading/error/retry, consolidated KPI и branch ranking.
- Добавлены regression tests на owner scope, manager/foreign denial, запрет self-claim чужого филиала и support-controlled membership.
- Внешние AI API не подключались.

### Проверка Cycle 27
- P0 dependency install повторён: BLOCKED DNS (`asgiref` не разрешается), поэтому Django runtime/full regression нельзя честно отметить PASS.
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Frontend typecheck/build остаётся dependency-blocked неполным `node_modules`.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым техническим gate. Следующий продуктовый P2 — Central menu templates + branch overrides, чтобы сеть могла управлять меню централизованно без потери локальных цен/доступности.


## 2026-09-18 — Cycle 28

### Что изменено
- Закрыт P2 Central Menu Templates + Branch Overrides при `AI_ENABLED=false`.
- Добавлены canonical network menu items и локальные overrides филиала для цены/доступности/видимости.
- Owner/Admin основного ресторана управляет шаблоном и публикует его во все verified branches; Manager/Waiter/Kitchen не могут менять canonical menu.
- Admin/Manager филиала может менять только overrides своего verified branch; cross-tenant branch override запрещён.
- Publish идемпотентен через `network_template_item`: повторная публикация обновляет связанные блюда вместо дублей. Категории создаются по имени внутри каждого tenant.
- Guest flow не менялся: после публикации гости получают обычные sellable MenuItem через существующий QR endpoint.
- Добавлен mobile-friendly Owner panel с loading/error/empty/busy states, добавлением/удалением canonical dishes и publish feedback.
- Добавлены regression tests canonical CRUD/publish, branch override, idempotency, role denial и foreign-branch isolation.
- Внешние AI API не подключались.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым техническим gate. Следующий продуктовый приоритет — P3 Poster integration (если доступен внешний sandbox/account); иначе P3 Loyalty/CRM minimal viable.

## 2026-09-18 — Cycle 29

### Что изменено
- Закрыт P3 Loyalty/CRM Minimal Viable при `AI_ENABLED=false`.
- Guest QR-заказ автоматически получает анонимный restaurant-scoped loyalty token в localStorage; телефон, email и обязательная регистрация не требуются.
- Backend добавляет `LoyaltyMember` и идемпотентный ledger `LoyaltyVisit`: закрытый счёт начисляется ровно один раз, даже при повторном вызове close/reward.
- На закрытии authoritative bill фиксируются visits, lifetime spend и детерминированные points (1 балл за полные 1 000 ₸).
- Public status endpoint защищён связкой active table token + restaurant-scoped member token; token другого ресторана не раскрывает данные.
- Admin/Manager получили tenant-safe CRM dashboard: members, returning guests, repeat rate, visits, member revenue, average member spend и top-50 анонимных профилей. Waiter/Kitchen не имеют доступа.
- Добавлены loading/error/retry/empty states и mobile/desktop CRM UI.
- Добавлены regression tests: idempotent reward, guest tenant isolation, Admin dashboard, Waiter denial, foreign-tenant denial.
- Внешние AI API не подключались.

### Проверка Cycle 29
- Python compileall, shell syntax и service-worker syntax проверены локально.
- Django/full regression запускается через `scripts/verify.sh`; результат зависит от наличия runtime dependencies в runner.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым техническим gate. Следующий продуктовый P3 — loyalty reward redemption/configuration (порог/награда/списание) либо Poster integration при доступном sandbox/account.

## 2026-09-18 — Cycle 30

### Что изменено
- Закрыт P3 Loyalty Reward Redemption + Program Settings при `AI_ENABLED=false`.
- Admin/Manager управляет программой: включение, баллы за 1 000 ₸, порог награды и фиксированная скидка.
- Guest cart показывает баланс/прогресс и позволяет применить награду, только когда сервер подтверждает достаточный баланс.
- Добавлен идемпотентный `LoyaltyRedemption`: один session не может списать баллы дважды; списание выполняется транзакционно с row lock.
- Скидка хранится в authoritative `TableSession.loyalty_discount_amount` и учитывается при каждом `recalculate_totals`, поэтому close/analytics не возвращают старую сумму.
- CRM dashboard показывает количество использованных наград и общую сумму выданных скидок.
- Добавлены role/tenant validation и regression tests для настроек, idempotent redemption и guest progress/privacy.
- Внешние AI API не подключались.

### Следующий лучший шаг
P0 runtime confirmation остаётся главным gate. Следующий доступный P3 — Reservation only if demanded; без подтверждённого спроса разумнее перейти к Advanced staff/kitchen SLA analytics (P4/Restaurant OS), если Poster/Kaspi остаются WAIT по внешним credentials.


## 2026-09-18 — Cycle 31

### Что изменено
- Закрыт P4 Advanced Kitchen SLA Analytics при `AI_ENABLED=false`.
- Owner/Admin Analytics теперь считает фактические времена `confirmed → ready` и `ready → served` по authoritative timestamp каждого SessionItem.
- Добавлены average и p95 приготовления, SLA compliance, количество просроченных блюд, отдельные показатели Kitchen/Bar и час с максимальным числом SLA-просрочек.
- Цели по умолчанию детерминированы без AI: Kitchen ≤20 мин, Bar ≤10 мин. Неизвестные станции используют безопасный target 20 мин.
- Неполные и нелогичные timestamp (ready раньше confirmed) исключаются из denominator вместо ложных нулей. Cancelled/rejected/awaiting_confirmation также исключены.
- Frontend получил responsive Kitchen SLA блок с KPI, станциями, empty state и перегруженным часом; существующие loading/error/stale-data состояния Analytics сохранены.
- Добавлены regression tests для avg/p95, station targets, late classification и исключения неполных/invalid timestamps.
- Внешние AI API не подключались.

### Проверка Cycle 31
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Target Django test suite: BLOCKED — runner не содержит Django (`ModuleNotFoundError: django`).
- Full QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся в regression gate и требует dependency-capable runner.

### Следующий лучший шаг
P0 runtime confirmation остаётся главным gate. При том же внешнем blocker следующий независимый Restaurant OS блок — staff efficiency analytics: waiter response/serve latency и workload без рейтинга сотрудников по неподтверждённым данным.

## 2026-09-18 — Cycle 32

### Что изменено
- Закрыт P4 Staff Efficiency Analytics при `AI_ENABLED=false`.
- SessionItem получил серверную атрибуцию `confirmed_by` и `served_by`; актор записывается только для роли Waiter, поэтому действия Kitchen/Admin/Manager не превращаются в ложную персональную метрику официанта.
- Owner/Admin Analytics считает `order created → waiter confirmed` и `ready → served`: avg, p95 и объём валидных samples.
- Исторические строки без actor attribution и нелогичные timestamps исключаются вместо догадок.
- Персональный operational breakdown показывается только при ≥3 подтверждённых действиях; это не рейтинг и не score сотрудников.
- Добавлен responsive блок «Скорость команды» с empty state и mobile layout.
- Добавлены regression tests server attribution, averages и исключения legacy unattributed history.
- Внешние AI API не подключались.

### Проверка Cycle 32
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Target Django suite: BLOCKED — runner не содержит Django (`ModuleNotFoundError: django`).
- `npm run typecheck`: BLOCKED — отсутствуют React/framer-motion/lucide и frontend dependency tree.
- Полный QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся в regression gate и требует dependency-capable runner.

### Следующий лучший шаг
P0 runtime confirmation остаётся главным gate. При сохранении внешнего blocker следующий независимый Restaurant OS блок — configurable SLA targets per restaurant/branch вместо глобальных 20/10 минут.


## 2026-09-18 — Cycle 33

### Что изменено
- Закрыт P4 Configurable SLA Targets при `AI_ENABLED=false`.
- Restaurant получил tenant-scoped цели Kitchen, Bar и Ready→Served с безопасными defaults 20/10/5 минут и validation 1–180 минут.
- Admin/Manager меняют цели через существующий защищённый settings API; Waiter/Kitchen и чужой tenant не имеют доступа.
- Owner Analytics больше не использует глобальные 20/10: late/compliance пересчитываются относительно целей конкретного ресторана.
- Добавлен отдельный handoff SLA: measured/late/compliance для Ready→Served.
- Frontend Analytics получил responsive редактор SLA с loading/saving/error state и автоматическим refresh после сохранения.
- Добавлены regression tests custom prep/handoff targets, settings permissions и boundary validation.
- Внешние AI API не подключались.

### Проверка Cycle 33
- Static/build/runtime проверки запускаются через `scripts/verify.sh`; dependency-capable runtime остаётся P0 gate.

### Следующий лучший шаг
P0 runtime confirmation остаётся главным gate. При сохранении blocker следующий независимый P4 — SLA alerts/escalation: realtime operational warning при превышении configured target без AI.

## 2026-09-18 — Cycle 34

### Что изменено
- Закрыт P4 SLA Alerts & Escalation при `AI_ENABLED=false`.
- Добавлен tenant-scoped `SLAIncident` ledger: breach фиксируется один раз на item/kind, после восстановления workflow автоматически закрывается, история сохраняется для Owner.
- Операционный endpoint рассчитывает warning на 80% configured SLA и overdue на 100% без AI/внешних сервисов.
- Kitchen получает только preparation alerts; Waiter — только Ready→Served; Admin/Manager — оба типа. Assigned waiter ограничен своими столами, cross-tenant запрещён.
- Kitchen board и Admin Sessions получают живые предупреждения через существующий 8-секундный operational polling; не требуется Celery/cron. Analytics показывает журнал последних SLA-инцидентов и resolved/active state.
- Добавлены regression tests warning→overdue, durable incident, resolve/history, role scope и tenant isolation.

### Следующий лучший шаг
P0 runtime confirmation остаётся главным gate. При сохранении blocker следующий независимый P4 — SLA incident analytics/trends: breach rate по дням/часам/станциям и trend comparison без персонального score.


## 2026-09-18 — Cycle 35

### Что изменено
- Закрыт P4 SLA Incident Trends при `AI_ENABLED=false`.
- Owner/Admin Analytics агрегирует durable SLAIncident ledger за выбранный период: breaches, resolved/active, resolution rate и среднее время устранения.
- Добавлено сравнение количества breaches с предыдущим периодом той же длины без ложного infinity при нулевой базе.
- Добавлены bottleneck breakdown по Kitchen/Bar/Ready→Served и пиковый час SLA-инцидентов. Warning на 80% SLA намеренно не считается breach.
- Tenant isolation сохраняется: агрегация фильтруется restaurant_id и использует существующий защищённый Analytics endpoint.
- Frontend получил responsive loading-compatible SLA trends block и корректный empty state.
- Добавлены regression tests aggregation/resolution/station breakdown и cross-tenant exclusion.
- Внешние AI API не подключались.

### Проверка Cycle 35
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Target Django suite: BLOCKED — runner не содержит Django (`ModuleNotFoundError: django`).
- Frontend typecheck: BLOCKED — dependency tree runner неполный.
- Full QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся P0 runtime gate.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым. При сохранении blocker следующий независимый P4 — shift-aware operational analytics: SLA/load по сменам и зонам без персонального score.


## 2026-09-18 — Cycle 36

### Что изменено
- Закрыт P4 Shift-aware Operational Analytics при `AI_ENABLED=false`.
- Owner/Admin Analytics теперь агрегирует закрытые счета и SLA breaches по реальным окнам из Schedule (date/start/end) и по зонам столов.
- Одинаковые интервалы нескольких сотрудников схлопываются в одно окно: выручка, счета и SLA не дублируются из-за параллельного графика персонала.
- Для смен показываются staff_count, закрытые счета, выручка и SLA breaches; для зон — счета, выручка, средний чек и SLA breaches.
- Поддержаны overnight-интервалы смен; персональный score/leaderboard намеренно не строится.
- Mobile UI использует одноколоночные карточки и переходит в две колонки для зон на широком экране; empty state сохранён.
- Добавлены regression tests для shift/zone aggregation и защиты от двойного учёта при совпадающих сменах.
- Внешние AI API не подключались.

### Проверка Cycle 36
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Установка backend dependencies повторно проверена: BLOCKED внешним DNS (`asgiref` не может быть загружен), поэтому Django runtime suite недоступен.
- Full QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся P0 runtime gate.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым. При сохранении внешнего blocker следующий независимый Restaurant OS блок — manager daily operations digest: детерминированная сводка revenue/SLA/active incidents/shift coverage без AI.


## 2026-09-18 — Cycle 37

### Что изменено
- Закрыт P4 Manager Daily Operations Digest при `AI_ENABLED=false`.
- Analytics теперь всегда возвращает отдельную сводку текущего локального дня независимо от выбранного периода: выручка, закрытые счета, средний чек, SLA breaches, активные SLA-инциденты и покрытие смены.
- Добавлена детерминированная приоритизация внимания: сначала активные SLA, затем проблемная зона, затем отсутствие активной смены; при отсутствии отклонений показывается зелёный stable-state.
- Проблемная зона определяется только по фактическим SLA breaches текущего дня; 80% warning не считается нарушением.
- Учтено текущее покрытие обычных и overnight-смен, без двойного учёта сотрудников.
- Manager/Admin/Owner получают сводку через существующий tenant-safe Analytics endpoint; Waiter/Kitchen доступа к управленческой аналитике не получили; Guest flow не затронут.
- Frontend получил mobile-first блок «Сводка менеджера · сегодня» с KPI, urgent/ warning/ok states и корректным состоянием без проблем.
- Добавлены regression tests authoritative today data, tenant isolation и Waiter denial.
- Внешние AI API не подключались.

### Проверка Cycle 37
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Target Django suite: BLOCKED — runner не содержит Django (`ModuleNotFoundError: django`).
- `npm run typecheck`: BLOCKED — отсутствует frontend dependency tree (`react`, `react/jsx-runtime`, `lucide-react`, `framer-motion` и др.).
- Full QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся P0 runtime gate.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым. При сохранении внешнего blocker следующий независимый P4 — Daily Digest action drill-down: быстрый переход из проблемы к конкретным SLA-инцидентам/зоне/смене без AI.


## 2026-09-18 — Cycle 38

### Что изменено
- Закрыт P4 Daily Digest Action Drill-down при `AI_ENABLED=false`.
- Critical active-SLA attention теперь несёт tenant-safe `session_id`; менеджер одним нажатием переходит в Sessions и открывает конкретный заказ.
- Problem-zone attention ведёт в Tables, отсутствие активной смены — в Schedule. Stable-state остаётся без искусственного действия.
- SLA incident history дополнен `session_id`; из каждой строки журнала можно открыть исходный заказ.
- Навигация использует существующий Zustand store (`setTab`/`setSessionDetail`) без нового router/state layer и без изменения Guest/Kitchen/Waiter lifecycle.
- Добавлены backend regression assertions для action metadata и schedule drill-down.
- Внешние AI API не подключались.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым. При сохранении blocker следующий независимый P4 — Operations exceptions inbox: единый actionable список SLA/calls/payment/order exceptions с role-safe filters и без AI.


## 2026-09-18 — Cycle 39

### Что изменено
- Закрыт P4 Operations Exceptions Inbox при `AI_ENABLED=false`.
- Добавлен единый tenant-safe endpoint очереди исключений: durable SLA breaches, незакрытые waiter calls, оплата без завершения >5 минут и guest items без подтверждения >3 минут.
- Приоритет полностью детерминирован: critical выше warning; AI и внешние сервисы не используются.
- Role scope: Kitchen получает только preparation SLA; Waiter — handoff/front-of-house и только назначенные столы при наличии assignment; Admin/Manager видят ресторан целиком. Cross-tenant запрещён.
- Frontend получил mobile-friendly вкладку «Проблемы» с KPI, фильтрами, loading/error/retry/empty states, polling 8 секунд и drill-down в конкретный Session/Calls.
- Добавлены regression tests unified queue, Kitchen least-privilege и tenant isolation.
- Во время статической регрессии найден и исправлен P0-дефект: `sessions/views.py` импортировал отсутствующий `IsRestaurantSessionStaff`. Permission восстановлен с явным набором operational roles (admin/manager/waiter/cashier/kitchen), tenant guard и superadmin support.

### Проверка Cycle 39
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Target Django tests: BLOCKED — runner не содержит Django (`ModuleNotFoundError: django`).
- Full QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся P0 runtime gate.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым. При сохранении dependency blocker следующий независимый блок — Operations exception acknowledgement/ownership: кто взял проблему, время реакции и resolved lifecycle без персонального score и без AI.

## 2026-09-18 — Cycle 40

### Что изменено
- Закрыт P4 Operations Exception Ownership & Resolution при `AI_ENABLED=false`.
- Добавлен durable `OperationalExceptionState`: first seen, acknowledged by/at, auto-resolved at; источник проблемы остаётся authoritative и не может быть вручную «спрятан» кнопкой resolve.
- Staff может взять видимую для своей роли проблему в работу; Kitchen не может присвоить front-of-house exception, tenant isolation сохранён. Admin/Manager могут снять чужое назначение, обычный сотрудник — нет.
- Unified inbox показывает «В работе», ответственного и server-derived response time; mobile получил отдельную кнопку ownership с saving/error состоянием.
- Когда исходная проблема исчезает (call закрыт, SLA resolved, payment/order condition устранён), state автоматически закрывается и сохраняется для аналитики.
- Analytics получил operations_exception_kpi: total/acknowledged/resolved + avg response/resolution minutes без персонального рейтинга.
- Добавлены regression tests ownership, auto-resolution и Kitchen least-privilege.
- Внешние AI API не подключались.

### Проверка Cycle 40
- Static/build/runtime gates запускаются ниже в артефакте цикла; полный runtime PASS не заявляется без dependency-capable окружения.

## 2026-09-18 — Cycle 41

### Что изменено
- Закрыт P4 Operations Timeline / Audit Trail при `AI_ENABLED=false`.
- Добавлен tenant-safe timeline endpoint конкретной сессии: открытие счёта, добавление/подтверждение позиции, ready/served, SLA breach/resolution, waiter calls, exception ownership/resolution и закрытие счёта — только из authoritative timestamps/durable ledger, без выдуманных событий.
- Kitchen получает least-privilege timeline без front-of-house/payment/call данных; assigned Waiter ограничен своими столами; cross-tenant доступ запрещён.
- Session Detail получил mobile-friendly «История обслуживания» с loading/error/retry/empty states и severity-маркерами.
- Добавлены regression tests полноты хронологии, сортировки, Kitchen least-privilege и tenant isolation.
- Внешние AI API не подключались.

### Проверка Cycle 41
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Runtime suite запускается ниже; PASS не заявляется без установленного dependency tree.

## 2026-09-18 — Cycle 42

### Что изменено
- Закрыт P4 Table Service Quality Summary при `AI_ENABLED=false`.
- Session timeline endpoint теперь дополнительно возвращает server-derived quality summary без нового event store: средние order→confirm, confirm→ready, ready→served, длительность обслуживания, SLA breaches, waiter calls и operational exceptions.
- Неполные lifecycle timestamps не угадываются: соответствующая метрика остаётся null и не искажает KPI.
- Kitchen получает только preparation summary и SLA preparation breaches; front-of-house calls/handoff/exceptions не раскрываются.
- Session Detail получил mobile-friendly KPI блок рядом с audit trail; отдельного staff score/рейтинга нет.
- Добавлены regression tests точных lifecycle durations и Kitchen least-privilege.
- Внешние AI API не подключались.

### Проверка Cycle 42
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Target Django suite: BLOCKED — runner не содержит Django (`ModuleNotFoundError: django`).
- `npm run typecheck`: BLOCKED — отсутствует frontend dependency tree (`react`, `react/jsx-runtime`, `lucide-react`, `framer-motion` и др.).
- Full QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся P0 runtime gate.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым. При сохранении dependency blocker следующий независимый P4 — Service Recovery Notes: менеджер фиксирует причину/компенсацию по operational exception с audit trail и агрегированной аналитикой причин, без AI.

## 2026-09-18 — Cycle 43

### Что изменено
- Закрыт P4 Service Recovery Notes при `AI_ENABLED=false`.
- Добавлен tenant-scoped durable `ServiceRecoveryNote`: причина, фактическое описание, тип и стоимость компенсации, автор и server timestamp.
- Admin/Manager могут создавать/читать/удалять recovery-записи только для сессий своего ресторана; Waiter/Kitchen не получили доступ к управленческому CRUD, Guest flow не расширялся.
- Recovery автоматически попадает в Operations Timeline как authoritative audit event; Kitchen least-privilege не раскрывает эти FOH-данные.
- Session Detail получил mobile-friendly форму и empty/saving/error feedback для фиксации фактической причины и компенсации.
- Analytics агрегирует число recovery-кейсов, стоимость компенсаций и breakdown по причинам за выбранный период — без персонального score и без AI.
- Добавлены regression tests CRUD, validation, role denial и cross-tenant isolation.
- Внешние AI API не подключались.

### Проверка Cycle 43
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Target Django suite: BLOCKED — runner не содержит Django (`ModuleNotFoundError: django`).
- `npm run typecheck`: BLOCKED — отсутствует frontend dependency tree (`react`, `react/jsx-runtime`, `lucide-react`, `framer-motion`, `zustand` и др.).
- Full QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся P0 runtime gate.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым. При сохранении dependency blocker следующий независимый P4 — Service Recovery Analytics UI: визуальный breakdown причин/стоимости и drill-down к исходным сессиям, без AI.

## 2026-09-18 — Cycle 44

### Что изменено
- Закрыт P4 Service Recovery Analytics UI при `AI_ENABLED=false`.
- Owner/Admin Analytics получил фактические KPI recovery: число кейсов, стоимость компенсаций, breakdown причин и сравнение с предыдущим периодом той же длины.
- Добавлен mobile-friendly визуальный breakdown причин/стоимости и empty state.
- Последние 8 recovery-кейсов возвращают только tenant-scoped session/table metadata и дают drill-down в существующую карточку заказа.
- При нулевой базе прошлого периода процент не выдумывается: показывается `нет базы`.
- Добавлены regression tests recovery aggregation/drill-down payload и cross-tenant exclusion.
- Внешние AI API не подключались.

### Проверка Cycle 44
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Target Django suite: BLOCKED — runner не содержит Django (`ModuleNotFoundError: django`).
- `npm run typecheck`: BLOCKED — отсутствует frontend dependency tree (`react`, `react/jsx-runtime`, `lucide-react`, `framer-motion`, `zustand` и др.).
- Full QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics остаётся P0 runtime gate.

### Следующий лучший шаг
P0 runtime confirmation остаётся первым. При сохранении dependency blocker следующий независимый P4 — Service Recovery Action Tracking: связать recovery с operational exception/SLA и показать долю проблем, где ресторан реально выполнил recovery, без AI.

## 2026-09-19 — Cycle 45

### Что изменено
- Закрыт P4 Service Recovery Action Tracking при `AI_ENABLED=false`.
- `ServiceRecoveryNote` теперь может явно ссылаться на исходный SLA incident или operational exception; сервер валидирует tenant и принадлежность той же session.
- Timeline endpoint отдаёт допустимые recovery sources конкретной session; Manager/Admin выбирает источник в существующей mobile форме, без нового экрана и без AI.
- Analytics считает authoritative serious problems, число явно покрытых recovery-действием проблем и recovery coverage %. Повторные notes на один source не раздувают coverage.
- Добавлены regression tests same-session source linkage, rejection чужой session и recovery source payload/coverage.
- Внешние AI API не подключались.

### Проверка Cycle 45
- `python -m compileall -q backend`: PASS.
- `bash -n scripts/verify.sh`: PASS.
- `node --check frontend/public/sw.js`: PASS.
- Установка backend dependencies повторно запущена: BLOCKED внешним DNS на `asgiref`, поэтому Django runtime suite/full lifecycle не отмечены PASS.

### Следующий лучший шаг
P0 dependency-capable runtime regression остаётся первым. При сохранении внешнего blocker — следующий независимый P4 определяется по ROADMAP после повторной проверки приоритетов.
