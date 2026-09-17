# CHANGELOG_PLAIT.md

## 2026-09-17 — Cycle 19

### Что изменено
- Реализован P1 Bulk tables 1–N end-to-end.
- Добавлен atomic backend endpoint массового создания диапазона столов; batch либо создаётся полностью, либо не создаётся вовсе.
- Добавлены проверки диапазона, лимит 200 за операцию, защита от дублей, tenant isolation и учёт max_tables тарифа.
- Admin/Manager могут массово создавать столы; Waiter/Kitchen и чужой tenant не могут.
- В Tables UI добавлена мобильная форма «Столы 1–N», optional zone, loading/error states и понятный вывод конфликтующих номеров.
- После создания список столов перечитывается из backend; существующие QR/print и realtime/session UI продолжают работать поверх новых столов.
- Добавлены backend regression tests bulk create, duplicate atomic abort, invalid range и role/tenant permissions.
- AI_ENABLED=false; внешние AI API не подключались.

### Проверка
- GitHub Actions CI запущен на актуальной plait-staging; окончательный production-ready статус будет выставлен только после green backend + frontend gates.
- Существующий critical lifecycle regression остаётся CI gate: QR → menu → cart/order → admin → kitchen → ready → waiter → served → payment → close → analytics.

### Результат
Ресторану больше не нужно вручную создавать 20–50 столов по одному. Plait сокращает время первичной настройки и подготавливает данные для следующего P1 — массового QR PDF export.

### Следующий лучший шаг
P1: Bulk QR PDF export.

## 2026-09-17 — Cycle 18

### Что изменено
- Реализован P1 Onboarding Wizard поверх существующих restaurant/menu/table/staff API без дублирования CRUD.
- Admin/Manager видят readiness по реальным данным: профиль ресторана, меню, столы/QR, команда; Waiter/Kitchen мастер не показывается.
- Go Live заблокирован до выполнения обязательных шагов и публикует ресторан через защищённый settings PATCH.
- Добавлены loading/error состояния, guest preview и mobile bottom sheet.
- AI_ENABLED=false сохранён.

### Проверка
- Frontend typecheck/build PASS; backend check/migrations/full suite PASS; critical restaurant lifecycle PASS.

## 2026-09-17 — Cycle 17

### Что изменено
- Закрыт оставшийся P0 runtime verification без ослабления production payment guard.
- Подтверждены tenant isolation, Kitchen least privilege, assigned-waiter scope и WebSocket isolation.
- AI_ENABLED=false сохранён.

## Earlier cycles
Полная история Cycles 1–16 сохранена в git history.
