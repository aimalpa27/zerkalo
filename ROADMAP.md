# ROADMAP.md

## PHASE 1 — Production Ready

| Title | Priority | Business impact | Complexity | Estimate | Dependencies | Status |
|---|---|---:|---:|---:|---|---|
| Direct QR auto-connect | P0 | Critical | S | 1–2h | guest endpoint | DONE 2026-09-16 |
| Reproducible frontend/backend CI | P0 | Critical | M | 0.5–1d | registry/network/CI | DONE 2026-09-17 — GitHub Actions + local verify script |
| Backend public runtime / ASGI deployment | P0 | Critical | M | 0.5d | Render + Postgres + Redis | CODE READY 2026-09-19 — root Render Blueprint, production settings, migrations, ASGI/Daphne, liveness probe; external account/env provisioning pending |
| Tenant isolation regression suite | P0 | Critical | M | 0.5–1d | Django/Channels tests | RUNTIME PASS 2026-09-20 — staff JWT restaurant boundary + invalid/expired JWT + inactive/unknown guest token + cross-restaurant event isolation + assigned-waiter table scope + guest table-token isolation |
| Full order lifecycle regression | P0 | Critical | L | 1–2d | runtime deps | VERIFYING CYCLE 58 — 14/14 critical regression already PASS; current main includes Cycle 55–57 fixture/model-contract repairs; final full-suite CI triggered on current main |
| Kitchen least-privilege role | P0 | Critical | M | 0.5–1d | users/sessions/realtime | RUNTIME PASS 2026-09-20 — generic APIs deny Kitchen; dedicated lifecycle scope preserved; critical regression 14/14 PASS |
| Realtime reconnect/status propagation | P0 | Critical | M | 0.5–1d | Redis/Channels | RUNTIME PASS (critical matrix) 2026-09-20 — status broadcast + JWT refresh/backoff + assigned-waiter realtime/API table scope + communicator tenant/table isolation matrix |
| Error/loading/empty state audit | P1 | High | M | 1d | core screens | DONE 2026-09-17 — Kitchen Cycle 13; Admin Sessions/Calls/Analytics Cycle 14; Guest Restaurant/Table/Menu/Cart/Checkout recovery + cart draft persistence Cycle 15 |
| PWA service worker/update strategy | P1 | High | M | 0.5–1d | Vite | DONE 2026-09-17 — offline shell + safe update prompt + transactional API cache bypass |

## PHASE 2 — First 10 restaurants

| Title | Priority | Business impact | Complexity | Estimate | Dependencies | Status |
|---|---|---:|---:|---:|---|---|
| Onboarding wizard | P1 | Critical | L | 2–4d | restaurant/menu/table/staff APIs | DONE 2026-09-17 — real-data readiness + guarded Go Live + mobile recovery |
| Bulk tables 1–N | P1 | High | M | 0.5–1d | table API | DONE 2026-09-17 — atomic range API + tariff/duplicate/tenant guards + Admin/Manager mobile UI |
| Bulk QR PDF export | P1 | High | M | 1d | tables | DONE 2026-09-17 — dependency-free A4 PDF download + branded 4-up QR cards + Admin/Manager UI |
| CSV/XLSX menu import | P1 | High | L | 1–2d | menu CRUD | DONE 2026-09-17 — preview + atomic import + category creation + duplicate/role/tenant guards |
| Sales Demo Mode | P2 | High | M | 1–2d | stable core | DONE 2026-09-18 — isolated read-only lifecycle demo across Guest/Admin/Kitchen/Waiter/Owner + analytics |
| Support/admin diagnostics | P2 | Medium | M | 1d | logs | DONE 2026-09-18 — tenant-safe Admin/Manager support snapshot + DB/cache/realtime + readiness warnings |

## PHASE 3 — 50 restaurants

| Title | Priority | Business impact | Complexity | Estimate | Dependencies | Status |
|---|---|---:|---:|---:|---|---|
| Rule-based Upsell Engine | P2 | High revenue | L | 2–3d | menu/order models | DONE 2026-09-18 — deterministic Admin/Manager CRUD + guest cart recommendations + tenant/sellability guards |
| Upsell analytics | P2 | High revenue proof | M | 1–2d | upsell events | DONE 2026-09-18 — impression/add/conversion funnel + server-validated attribution + Owner revenue proof |
| Owner business dashboard v2 | P2 | High retention | L | 2–3d | analytics | DONE 2026-09-18 — period comparison + table utilization + peak hour/day + mobile Owner KPI |
| Kaspi production payment path | P2 | High | L | TBD | external account | WAIT |
| Poster integration | P3 | High acquisition | L | TBD | external API/account | TODO |

## PHASE 4 — 100 restaurants

- Multi-location/network owner dashboard — P2 — DONE 2026-09-18.
- Central menu templates and branch overrides — P2 — DONE 2026-09-18.
- Loyalty/CRM minimal viable — P3 — DONE 2026-09-18.
- Loyalty reward redemption/settings — P3 — DONE 2026-09-18.
- Reservation only if demanded by real customers — P3 — TODO.
- Operational monitoring/SLO/alerting — P1 — DONE 2026-09-18.

## PHASE 5 — Restaurant OS

- Deeper POS integrations instead of rebuilding full POS prematurely.
- Advanced staff efficiency and kitchen SLA analytics — P4 — DONE 2026-09-18.
- Configurable restaurant SLA targets — P4 — DONE 2026-09-18.
- SLA alerts & escalation — P4 — DONE 2026-09-18.
- SLA incident trends — P4 — DONE 2026-09-18.
- Shift-aware operational analytics — P4 — DONE 2026-09-18.
- Manager daily operations digest — P4 — DONE 2026-09-18.
- Daily digest action drill-down — P4 — DONE 2026-09-18.
- Operations exceptions inbox — P4 — DONE 2026-09-18.
- Operations exception ownership & resolution — P4 — DONE 2026-09-18.
- Operations timeline / audit trail — P4 — DONE 2026-09-18.
- Inventory only if integration coverage is insufficient.
- AI remains disabled until owner explicitly requests “Подключаем AI”.
- Table service quality summary — P4 — DONE 2026-09-18.
- Service recovery notes — P4 — DONE 2026-09-18.
- Service recovery analytics UI — P4 — DONE 2026-09-18.
- Service recovery action tracking — P4 — DONE 2026-09-19.
