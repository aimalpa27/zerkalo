# ROADMAP.md

## PHASE 1 — Production Ready

| Title | Priority | Business impact | Complexity | Estimate | Dependencies | Status |
|---|---|---:|---:|---:|---|---|
| Direct QR auto-connect | P0 | Critical | S | 1–2h | guest endpoint | DONE 2026-09-16 |
| Reproducible frontend/backend CI | P0 | Critical | M | 0.5–1d | registry/network/CI | DONE 2026-09-17 — GitHub Actions + local verify script |
| Tenant isolation regression suite | P0 | Critical | M | 0.5–1d | Django tests | DONE 2026-09-17 — full backend runtime + WebSocket cross-tenant suite green |
| Full order lifecycle regression | P0 | Critical | L | 1–2d | runtime deps | DONE 2026-09-17 — QR → menu → cart/order → admin → kitchen → ready → waiter → served → payment → close → analytics green |
| Kitchen least-privilege role | P0 | Critical | M | 0.5–1d | users/sessions/realtime | DONE 2026-09-17 |
| Realtime reconnect/status propagation | P0 | Critical | M | 0.5–1d | Redis/Channels | DONE 2026-09-17 |
| Error/loading/empty state audit | P1 | High | M | 1d | core screens | DONE 2026-09-17 |
| PWA service worker/update strategy | P1 | High | M | 0.5–1d | Vite | DONE 2026-09-17 |

## PHASE 2 — First 10 restaurants

| Title | Priority | Business impact | Complexity | Estimate | Dependencies | Status |
|---|---|---:|---:|---:|---|---|
| Onboarding wizard | P1 | Critical | L | 2–4d | restaurant/menu/table/staff APIs | DONE 2026-09-17 — Admin/Manager readiness wizard, real-data progress, role isolation, mobile sheet, Go Live publication + preview; CI/regression green |
| Bulk tables 1–N | P1 | High | M | 0.5–1d | table API | TODO |
| Bulk QR PDF export | P1 | High | M | 1d | tables | TODO |
| CSV/XLSX menu import | P1 | High | L | 1–2d | menu CRUD | TODO |
| Sales Demo Mode | P2 | High | M | 1–2d | stable core | TODO |
| Support/admin diagnostics | P2 | Medium | M | 1d | logs | TODO |

## PHASE 3 — 50 restaurants

| Title | Priority | Business impact | Complexity | Estimate | Dependencies | Status |
|---|---|---:|---:|---:|---|---|
| Rule-based Upsell Engine | P2 | High revenue | L | 2–3d | menu/order models | TODO |
| Upsell analytics | P2 | High revenue proof | M | 1–2d | upsell events | TODO |
| Owner business dashboard v2 | P2 | High retention | L | 2–3d | analytics | TODO |
| Kaspi production payment path | P2 | High | L | TBD | external account | WAIT |
| Poster integration | P3 | High acquisition | L | TBD | external API/account | TODO |

## PHASE 4 — 100 restaurants

- Multi-location/network owner dashboard — P2 — TODO.
- Central menu templates and branch overrides — P2 — TODO.
- Loyalty/CRM minimal viable — P3 — TODO.
- Reservation only if demanded by real customers — P3 — TODO.
- Operational monitoring/SLO/alerting — P1 — TODO.

## PHASE 5 — Restaurant OS

- Deeper POS integrations instead of rebuilding full POS prematurely.
- Advanced staff efficiency and kitchen SLA analytics.
- Inventory only if integration coverage is insufficient.
- AI remains disabled until owner explicitly requests “Подключаем AI”.
