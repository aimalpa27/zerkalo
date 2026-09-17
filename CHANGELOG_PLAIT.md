# CHANGELOG_PLAIT.md

## 2026-09-17 — Cycle 18

### Что изменено
- Реализован P1 Onboarding Wizard поверх существующих restaurant/menu/table/staff API без дублирования CRUD.
- Admin/Manager видят readiness по реальным данным: профиль ресторана, меню, столы/QR, команда; Waiter/Kitchen мастер не показывается.
- Каждый незавершённый шаг ведёт прямо в существующий экран настройки; прогресс пересчитывается из store после CRUD/realtime refresh.
- Go Live заблокирован до выполнения всех обязательных шагов и публикует ресторан через защищённый settings PATCH (`is_public=true`).
- Добавлены loading/error состояния публикации, retry через повторный Go Live, guest preview и dismiss per restaurant.
- Mobile UX сделан как bottom sheet, desktop — centered modal; длинный контент скроллится.
- AI_ENABLED=false сохранён, внешние AI API не подключались.

### Проверка
- GitHub Actions frontend: `npm ci` PASS, `npm run typecheck` PASS, `npm run build` PASS.
- Backend: `manage.py check` PASS, `makemigrations --check --dry-run` PASS, `migrate` PASS.
- Critical restaurant regression QR → menu → cart/order → admin → kitchen → ready → waiter → served → payment → close → analytics: PASS.
- Full backend suite: PASS.

### Результат
Новый ресторан теперь получает понятный путь от пустого аккаунта до опубликованного QR-меню, а Plait получает self-service activation flow для первых 10 ресторанов.

### Следующий лучший шаг
P1: Bulk tables 1–N — массовое создание столов с валидацией дублей и последующим QR export.

## 2026-09-17 — Cycle 17

### Что изменено
- Закрыт оставшийся P0 runtime verification: исправлен stale realtime close regression без ослабления production payment guard.
- Full backend suite теперь проверяет тот же допустимый payment_requested → closed переход, что и production API.
- Подтверждены tenant isolation, Kitchen least privilege, assigned-waiter scope, WebSocket invalid/expired JWT denial и отсутствие cross-restaurant event leakage.
- Подтверждён полный restaurant flow QR → menu → cart/order → admin → kitchen → ready → waiter → served → payment → close → analytics.
- Frontend typecheck/build включены в тот же verification run.
- AI_ENABLED=false сохранён; внешние AI API не подключались.

### Результат
P0 production-regression gates подтверждены runtime-тестами. Следующий приоритет — P1 Onboarding Wizard для первых ресторанов.

## Earlier cycles
Полная история Cycles 1–16 сохранена в git history до Cycle 18; текущий changelog держит последние production-relevant изменения компактными.
