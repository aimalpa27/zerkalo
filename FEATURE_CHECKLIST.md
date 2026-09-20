# FEATURE_CHECKLIST.md

Обозначения: READY / PARTIAL / BROKEN / NOT IMPLEMENTED. Production Ready = только после runtime + regression подтверждения.

| Функция | Статус | Guest | Admin | Kitchen | Backend/DB | Permissions | Mobile | Errors | Tests | Analytics | Production Ready |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Restaurants | PARTIAL | ✓ | ✓ | N/A | ✓ | ✓ | ✓ | partial | partial | partial | NO |
| Menu | PARTIAL | ✓ resilient loading/error/empty/retry + stale snapshot | ✓ CRUD + CSV/XLSX preview/import | reads items | ✓ atomic import | ✓ tenant/role relation hardened | ✓ import bottom-sheet | ✓ preview/row errors/duplicate states | tenant + import regression added; runtime pending | partial | NO |
| Categories | PARTIAL | ✓ | ✓ | N/A | ✓ | ✓ | ✓ | partial | partial | N/A | NO |
| Tables | PARTIAL | ✓ | ✓ + atomic bulk 1–N Admin/Manager | sees table no. | ✓ bulk transaction | ✓ tenant/role/tariff/zone | ✓ | ✓ duplicate/range/limit states | bulk regression added; runtime pending | partial | NO |
| QR Tables | PARTIAL | ✓ FIXED direct flow | ✓ single QR + bulk A4 PDF Admin/Manager | sees table no. | ✓ | ✓ role/tenant | ✓ PDF action mobile-safe | ✓ PDF loading/error + empty guard | PDF helper static typecheck; frontend E2E pending | partial | NO |
| Cart | PARTIAL | ✓ 24h restaurant/table-scoped draft persistence | N/A | N/A | N/A | context-isolated draft | ✓ | ✓ preserved on menu/order failure | missing frontend runtime tests | N/A | NO |
| Orders | PARTIAL | ✓ realtime status + checkout retry without cart loss | ✓ realtime + resilient sessions loading/error/retry | ✓ realtime refresh + JWT reconnect hardened | ✓ session race + status broadcast hardened | ✓ tenant + assigned-waiter table scope | ✓ | payment-boundary error ✓ | full cross-endpoint QR→close→analytics regression added + CI gate | final total/top revenue hardened | NO |
| Kitchen | PARTIAL | N/A | sees statuses + SLA analytics | ✓ dedicated kitchen auth + realtime reload | ✓ dedicated role + lifecycle timestamps | ✓ least privilege: read sessions + confirmed↔ready only | tablet/mobile resilient | ✓ loading/error/empty + retry + stale-data preservation + action errors | regression + Kitchen SLA tests added; runtime pending | ✓ configurable tenant SLA + kitchen/hand-off compliance + live SLA alerts + durable incident history/trends + breach period comparison/station bottlenecks + waiter response/serve avg+p95 + attributed workload + shift/zone operational load | NO |
| Waiter Calls | PARTIAL | ✓ | ✓ resilient loading/error/retry + unified exceptions inbox | N/A | ✓ | ✓ assigned-waiter REST/realtime scope | ✓ | ✓ stale-data warning | backend present | limited | NO |
| Staff | PARTIAL | N/A | ✓ | dedicated kitchen auth | ✓ | ✓ kitchen excluded from generic staff APIs | ✓ | partial | kitchen creation/isolation regression added | limited | NO |
| Analytics | PARTIAL | N/A | ✓ Owner v2: period comparison + operational KPI + retry/stale snapshot | N/A | ✓ authoritative summary + closed history | ✓ Admin/Manager tenant-safe | ✓ responsive KPI cards | ✓ no fake-zero fallback | comparison/KPI/tenant tests + full-flow gate | ✓ revenue/avg check/load/peak/upsell/top items + deterministic daily manager digest (shift coverage/SLA/problem zone) + action drill-down to session/tables/schedule + unified operations exceptions inbox + ownership/response/resolution KPI + per-session operations audit timeline | NO — runtime suite pending |
| Network Menu | READY | Guest consumes normal published menu | Owner canonical CRUD/publish | N/A | ✓ template + branch overrides + idempotent materialization | ✓ Owner canonical; branch Admin/Manager own overrides | ✓ owner panel | ✓ loading/error/empty/publish feedback | network menu regression added; runtime pending | N/A | NO — runtime suite pending |
| Network / Multi-location | READY | N/A | Owner(Admin) consolidated dashboard | denied | ✓ network model + aggregate | ✓ owner-only + support-controlled membership | ✓ | ✓ loading/error/empty/retry | tenant isolation tests added; runtime pending | ✓ branch ranking/revenue/avg check/upsell | NO — runtime suite pending |
| Upsell | IMPLEMENTED | Admin/Manager CRUD | Guest cart + funnel events | RULE-BASED | tenant-safe | active/sellable only | mobile | loading/empty/error | event/tenant tests added | impression→add→conversion + attributed revenue | YES* |
| Loyalty / CRM | READY | ✓ anonymous token + reward progress/redemption, no signup/PII | ✓ Admin/Manager dashboard + program settings | denied | ✓ member + earn/redemption ledgers + session discount | ✓ tenant scoped; Waiter/Kitchen denied | ✓ | ✓ loading/error/empty/retry | earn/settings/redemption regression added; runtime pending | ✓ visits/spend/repeat rate/redemptions/discount | NO — runtime suite pending |
| Payments | PARTIAL | request/method | ✓ guarded close | N/A | ✓ transition guards | ✓ waiter/role scope | ✓ | explicit close errors ✓ | backend regression added | closed-total consistency ✓ | NO |
| Promos | PARTIAL | ✓ | limited | N/A | ✓ | review | ✓ | partial | limited | limited | NO |
| Settings | PARTIAL | consumes | ✓ | N/A | ✓ | ✓ | ✓ | partial | limited | N/A | NO |
| Onboarding | READY | preview | ✓ Admin/Manager wizard | denied | ✓ guarded publish | ✓ role + readiness | ✓ bottom-sheet | ✓ loading/error/retry | backend regression added; runtime blocked by missing Django | N/A | NO — runtime suite pending |
| Delivery/Takeaway | PARTIAL | ✓ | ✓ | partial | ✓ | ✓ | ✓ | partial | backend present | partial | NO |
| Chat | PARTIAL | N/A | ✓ | staff | ✓ | ✓ | ✓ | partial | limited | N/A | NO |
| Schedule | PARTIAL | N/A | ✓ | staff | ✓ | ✓ | ✓ | partial | limited | N/A | NO |
| PWA | PARTIAL | ✓ manifest + offline shell + safe update prompt | N/A | manifest | SW static cache only | transactional API bypass | ✓ | ✓ offline/update recovery | static boundary checks; runtime build via CI | N/A | NO |
| Demo Mode | READY | Guest lifecycle | Admin confirmation | — | Waiter handoff | Kitchen board | Owner analytics | isolated mock data | mobile/desktop | no production writes | YES |

## Operations

| Support Diagnostics | READY | Admin/Manager tenant-safe snapshot: dependencies, counts, subscription, iiko config state, warnings; no secrets/PII/raw logs | NO — Django runtime suite pending |

| Area | Status | Coverage | Production Ready |
|---|---|---|---|
| Operations / Health | PARTIAL | `/health/live` + `/health/ready` DB/cache/realtime, non-sensitive 503, tests + SLO runbook | NO — runtime dependency suite pending |
| Backend deployment | READY (code) | Root Render Blueprint deploys Django ASGI/Daphne from `/backend`, runs migrations before start, uses `/health/live`, production settings, `AI_ENABLED=false`, and explicit Postgres/Redis/CORS/hosts env boundaries | NO — external Render service + env values still need provisioning |
| Realtime tenant isolation | READY (code) | Staff JWT restaurant boundary; missing/invalid/expired JWT denial; active guest-token validation; cross-restaurant staff event isolation; assigned-waiter dine-in table scope; guest table-token event isolation; delivery/pickup preserved as restaurant-wide FOH because it has no table | NO — Channels runtime suite pending |

### Cycle 42 — Table Service Quality Summary
- READY (code-complete, runtime pending): per-session deterministic service quality summary from authoritative lifecycle timestamps.
- Admin/Manager/Waiter: order→confirm, confirm→ready, ready→served, service duration, SLA/calls/exceptions, completed/rejected counts.
- Kitchen: preparation-only summary; no FOH calls/handoff/exceptions exposure.
- Mobile: responsive 2/3-column KPI grid inside Session Detail; shares timeline loading/error/retry state.
- AI_ENABLED=false; no external AI APIs.

### Cycle 44 — Service Recovery Analytics UI
- READY (code/static): Analytics shows recovery count/cost, cause breakdown and exact previous-period deltas from the durable recovery ledger.
- READY (code/static): recent recovery cases include tenant-safe session/table drill-down into the existing Session Detail flow.
- READY (code/static): empty state and responsive 2→4 KPI layout; no AI or inferred causes.
- TESTS ADDED: recovery aggregation/drill-down payload + cross-tenant exclusion; runtime pending dependency-capable runner.

### Cycle 43 — Service Recovery Notes
- READY (code/static): Admin/Manager tenant-safe recovery CRUD for a session: factual reason/note/compensation/author/server timestamp.
- READY (code/static): recovery appears in session audit timeline; Kitchen/Waiter/Guest do not receive manager recovery CRUD.
- READY (code/static): analytics aggregates recovery count, compensation cost and reason breakdown for selected period.
- READY (UI): mobile Session Detail form/list with empty/saving/error feedback.
- TESTS ADDED: create/list/delete, validation, Waiter/Kitchen denial, cross-tenant isolation. Runtime pending dependency-capable runner.
- Production Ready: NO — P0 full lifecycle runtime regression still blocked by missing dependencies.
- [x] P4 Service recovery action tracking — explicit source linkage, tenant/session guards, coverage KPI, mobile source selector (Cycle 45).

### Cycle 46 — Public Backend Runtime Blueprint
- READY (code): root `render.yaml` deploys the existing Django backend as ASGI with Daphne so HTTP + WebSocket use the same public runtime.
- READY (code): migrations run before server startup; `/health/live` is the deployment health probe.
- READY (security): production settings, generated `SECRET_KEY`, explicit DB/Redis/CORS/hosts variables, `AI_ENABLED=false`.
- Runtime provisioning is still external-account work; no fake Production Ready claim until the public service and regression flow pass.

### Cycle 47 — Realtime Tenant Isolation Matrix
- READY (code): valid guest sockets are now explicitly regression-tested for table-token group isolation, not only invalid/inactive token rejection.
- READY (code): staff sockets cover cross-restaurant JWT denial/event isolation and assigned-waiter dine-in table filtering.
- VERIFIED CONTRACT: delivery/pickup realtime remains restaurant-wide FOH because delivery sessions have no table assignment; Kitchen remains excluded from FOH delivery events.
- AI_ENABLED=false; no external AI APIs.
- Runtime execution remains pending a dependency-capable Django/Channels runner.


### Cycle 50 — P0 Full Lifecycle Analytics Fix
- FIXED (code): Owner Analytics no longer references undefined `start/end`; recovery/SLA/exception coverage uses the same validated `from/to` calendar filters as the rest of Analytics.
- FIXED (contract): frontend analytics response type now includes operational analytics sections already returned by Django.
- SAFETY: tenant filters preserved; Guest/Waiter/Kitchen permissions unchanged; AI_ENABLED=false.
- CI/regression rerun required before Production Ready.


### Cycle 51 — P0 Analytics Runtime/Type Contract
- FIXED: Cycle 50 patch is now on main; Owner Analytics uses validated from/to date scope.
- FIXED: Analytics UI contract includes operations_exception_kpi returned by Django.
- VERIFIED from CI #93 before patch: 13/14 critical backend tests passed; realtime tenant isolation and Kitchen least privilege passed.
- AI_ENABLED=false; no external AI APIs.
- Production Ready remains NO until the new CI run is green.

### Cycle 55 — P0 Full Backend Suite Cleanup
- VERIFIED: critical restaurant regression remains 14/14 PASS, including QR→menu→cart→order→admin→kitchen→ready→waiter→served→close→analytics.
- VERIFIED: frontend `npm ci`, typecheck and production build PASS in CI #101.
- FIXED: SLA regression users now satisfy the current required-email auth contract.
- FIXED: Service Recovery source tests import `timedelta` explicitly.
- FIXED: close realtime regression now respects the required payment boundary before close.
- FIXED: manager daily-digest no-current-shift test is timezone-independent instead of hard-coding 23:00–23:30.
- AI_ENABLED=false; no external AI API.
- Full 219-test suite rerun is the acceptance gate for this cleanup.
