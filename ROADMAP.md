# ROADMAP.md

## PHASE 1 — Production Ready

| Title | Priority | Business impact | Complexity | Estimate | Dependencies | Status |
|---|---|---:|---:|---:|---|---|
| Direct QR auto-connect | P0 | Critical | S | 1–2h | guest endpoint | DONE 2026-09-16 |
| Reproducible frontend/backend CI | P0 | Critical | M | 0.5–1d | registry/network/CI | DONE 2026-09-17 — GitHub Actions + local verify script; current sandbox install blocked by DNS |
| Backend public runtime / ASGI deployment | P0 | Critical | M | 0.5d | Render + Postgres + Redis | CODE READY 2026-09-19 — root Render Blueprint, production settings, migrations, ASGI/Daphne, liveness probe; external account/env provisioning pending |
| Tenant isolation regression suite | P0 | Critical | M | 0.5–1d | Django/Channels tests | CODE COMPLETE 2026-09-19 — REST writable relations + staff JWT restaurant boundary + invalid/expired JWT + inactive/unknown guest token + staff restaurant event isolation + assigned-waiter table scope + guest table-token event isolation; runtime execution pending dependency-capable runner |
| Full order lifecycle regression | P0 | Critical | L | 1–2d | runtime deps | FIX APPLIED 2026-09-20 — analytics runtime/date-window + frontend contract blockers fixed; CI rerun pending |
| Kitchen least-privilege role | P0 | Critical | M | 0.5–1d | users/sessions/realtime | DONE 2026-09-17 — dedicated role, action scope, frontend auth, tests |
| Realtime reconnect/status propagation | P0 | Critical | M | 0.5–1d | Redis/Channels | IN PROGRESS — status broadcast + JWT refresh/backoff + assigned-waiter realtime/API table scope + communicator tenant/table isolation matrix DONE in code; runtime execution awaits dependencies |
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

- Multi-location/network owner dashboard — P2 — DONE 2026-09-18 — owner-only consolidated revenue/check/upsell ranking + support-controlled tenant-safe membership.
- Central menu templates and branch overrides — P2 — DONE 2026-09-18 — canonical network menu + idempotent publish + branch price/availability overrides + tenant/role guards.
- Loyalty/CRM minimal viable — P3 — DONE 2026-09-18 — anonymous restaurant-scoped guest identity + visit/spend/points ledger + repeat-rate Owner CRM dashboard.
- Loyalty reward redemption/settings — P3 — DONE 2026-09-18 — restaurant-configurable earn/reward rules + transactional idempotent points redemption + guest progress + CRM redemption analytics.
- Reservation only if demanded by real customers — P3 — TODO.
- Operational monitoring/SLO/alerting — P1 — DONE 2026-09-18 — public liveness + DB/cache/realtime readiness probes, 503 fail-closed contract, probe regression tests, initial SLO/runbook.

## PHASE 5 — Restaurant OS

- Deeper POS integrations instead of rebuilding full POS prematurely.
- Advanced staff efficiency and kitchen SLA analytics — P4 — DONE 2026-09-18 — kitchen avg/p95/SLA + server-attributed waiter response/serve latency, workload samples, no low-sample ranking.
- Configurable restaurant SLA targets — P4 — DONE 2026-09-18 — per-tenant Kitchen/Bar/Ready→Served targets, validated Admin/Manager settings + SLA recalculation.
- SLA alerts & escalation — P4 — DONE 2026-09-18 — 80% warning + breach ledger + role-scoped operational alerts + Owner incident history.
- SLA incident trends — P4 — DONE 2026-09-18 — period comparison + breach/resolution KPIs + peak hour + station bottlenecks from durable incident ledger.
- Shift-aware operational analytics — P4 — DONE 2026-09-18 — deduplicated scheduled shift windows + revenue/check/SLA load and zone revenue/avg-check/SLA breakdown, no staff ranking.
- Manager daily operations digest — P4 — DONE 2026-09-18 — deterministic today revenue/checks/avg-check + shift coverage + active SLA + problem-zone attention, no AI.
- Daily digest action drill-down — P4 — DONE 2026-09-18 — actionable SLA→session, problem-zone→tables, no-shift→schedule navigation + SLA log order links.
- Operations exceptions inbox — P4 — DONE 2026-09-18 — unified tenant/role-safe SLA + waiter calls + aged payment + confirmation queue with 8s refresh and action drill-down.
- Operations exception ownership & resolution — P4 — DONE 2026-09-18 — durable acknowledgement/owner/response timing + source-driven auto-resolution + KPI, no staff ranking.
- Operations timeline / audit trail — P4 — DONE 2026-09-18 — per-session authoritative lifecycle + SLA/call/exception chronology, role/tenant scoped, mobile drill-down.
- Inventory only if integration coverage is insufficient.
- AI remains disabled until owner explicitly requests “Подключаем AI”.
- Table service quality summary — P4 — DONE 2026-09-18 — per-session authoritative order→confirm/prep/handoff timings + SLA/calls/exceptions/service-duration summary, Kitchen least-privilege, no staff score.
- Service recovery notes — P4 — DONE 2026-09-18 — manager/admin factual cause + compensation ledger, audit timeline + period analytics, role/tenant safe, no AI.
- Service recovery analytics UI — P4 — DONE 2026-09-18 — reason/cost breakdown + previous-period deltas + recent-case session drill-down, tenant-safe, no AI.
- Service recovery action tracking — P4 — DONE 2026-09-19 — explicit recovery→SLA/exception linkage + same-session/tenant validation + recovery coverage analytics, no AI.
