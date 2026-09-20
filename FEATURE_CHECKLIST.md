# FEATURE_CHECKLIST.md

Обозначения: READY / PARTIAL / BROKEN / NOT IMPLEMENTED. Production Ready = только после runtime + regression подтверждения.

| Функция | Статус | Guest | Admin | Kitchen | Backend/DB | Permissions | Mobile | Errors | Tests | Analytics | Production Ready |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Restaurants | PARTIAL | ✓ | ✓ | N/A | ✓ | ✓ | ✓ | partial | partial | partial | NO |
| Menu | PARTIAL | ✓ resilient loading/error/empty/retry + stale snapshot | ✓ CRUD + CSV/XLSX preview/import | reads items | ✓ atomic import | ✓ tenant/role relation hardened | ✓ import bottom-sheet | ✓ preview/row errors/duplicate states | tenant + import regression; full backend suite PASS | partial | NO — public runtime pending |
| Categories | PARTIAL | ✓ | ✓ | N/A | ✓ | ✓ | ✓ | partial | full backend suite PASS | N/A | NO — public runtime pending |
| Tables | PARTIAL | ✓ | ✓ + atomic bulk 1–N Admin/Manager | sees table no. | ✓ bulk transaction | ✓ tenant/role/tariff/zone | ✓ | ✓ duplicate/range/limit states | full backend suite PASS | partial | NO — public runtime pending |
| QR Tables | PARTIAL | ✓ FIXED direct flow | ✓ single QR + bulk A4 PDF Admin/Manager | sees table no. | ✓ | ✓ role/tenant | ✓ PDF action mobile-safe | ✓ PDF loading/error + empty guard | critical lifecycle PASS | partial | NO — public runtime pending |
| Cart | PARTIAL | ✓ 24h restaurant/table-scoped draft persistence | N/A | N/A | N/A | context-isolated draft | ✓ | ✓ preserved on menu/order failure | frontend typecheck/build PASS | N/A | NO — public runtime pending |
| Orders | READY | ✓ realtime status + checkout retry without cart loss | ✓ realtime + resilient sessions loading/error/retry | ✓ realtime refresh + JWT reconnect hardened | ✓ session race + status broadcast hardened | ✓ tenant + assigned-waiter table scope | ✓ | payment-boundary error ✓ | critical 14/14 + backend 219/219 PASS | final total/top revenue hardened | YES* — CI runtime; public-host smoke pending |
| Kitchen | READY | N/A | sees statuses + SLA analytics | ✓ dedicated kitchen auth + realtime reload | ✓ dedicated role + lifecycle timestamps | ✓ least privilege: read sessions + confirmed↔ready only | tablet/mobile resilient | ✓ loading/error/empty + retry + stale-data preservation + action errors | critical regression PASS + full backend suite PASS | ✓ configurable tenant SLA + kitchen/hand-off compliance + live SLA alerts + durable incident history/trends + breach period comparison/station bottlenecks + waiter response/serve avg+p95 + attributed workload + shift/zone operational load | YES* — CI runtime; public-host smoke pending |
| Waiter Calls | PARTIAL | ✓ | ✓ resilient loading/error/retry + unified exceptions inbox | N/A | ✓ | ✓ assigned-waiter REST/realtime scope | ✓ | ✓ stale-data warning | full backend suite PASS | limited | NO — public runtime pending |
| Staff | PARTIAL | N/A | ✓ | dedicated kitchen auth | ✓ | ✓ kitchen excluded from generic staff APIs | ✓ | partial | full backend suite PASS | limited | NO — public runtime pending |
| Analytics | READY | N/A | ✓ Owner v2: period comparison + operational KPI + retry/stale snapshot | N/A | ✓ authoritative summary + closed history | ✓ Admin/Manager tenant-safe | ✓ responsive KPI cards | ✓ no fake-zero fallback | full lifecycle + backend 219/219 PASS | ✓ revenue/avg check/load/peak/upsell/top items + deterministic daily manager digest + operations exceptions + recovery analytics | YES* — CI runtime; public-host smoke pending |
| Network Menu | READY | Guest consumes normal published menu | Owner canonical CRUD/publish | N/A | ✓ template + branch overrides + idempotent materialization | ✓ Owner canonical; branch Admin/Manager own overrides | ✓ owner panel | ✓ loading/error/empty/publish feedback | full backend suite PASS | N/A | NO — public runtime pending |
| Network / Multi-location | READY | N/A | Owner(Admin) consolidated dashboard | denied | ✓ network model + aggregate | ✓ owner-only + support-controlled membership | ✓ | ✓ loading/error/empty/retry | full backend suite PASS | ✓ branch ranking/revenue/avg check/upsell | NO — public runtime pending |
| Upsell | IMPLEMENTED | Admin/Manager CRUD | Guest cart + funnel events | RULE-BASED | tenant-safe | active/sellable only | mobile | loading/empty/error | full backend suite PASS | impression→add→conversion + attributed revenue | YES* |
| Loyalty / CRM | READY | ✓ anonymous token + reward progress/redemption, no signup/PII | ✓ Admin/Manager dashboard + program settings | denied | ✓ member + earn/redemption ledgers + session discount | ✓ tenant scoped; Waiter/Kitchen denied | ✓ | ✓ loading/error/empty/retry | regression present | ✓ visits/spend/repeat rate/redemptions/discount | NO — public runtime pending |
| Payments | PARTIAL | request/method | ✓ guarded close | N/A | ✓ transition guards | ✓ waiter/role scope | ✓ | explicit close errors ✓ | backend regression PASS | closed-total consistency ✓ | NO — Kaspi production path external |
| Promos | PARTIAL | ✓ | limited | N/A | ✓ | review | ✓ | partial | limited | limited | NO |
| Settings | PARTIAL | consumes | ✓ | N/A | ✓ | ✓ | ✓ | partial | full backend suite PASS | N/A | NO — public runtime pending |
| Onboarding | READY | preview | ✓ Admin/Manager wizard | denied | ✓ guarded publish | ✓ role + readiness | ✓ bottom-sheet | ✓ loading/error/retry | backend regression PASS | N/A | NO — public runtime pending |
| Delivery/Takeaway | PARTIAL | ✓ | ✓ | partial | ✓ | ✓ | ✓ | partial | critical realtime contract PASS | partial | NO — public runtime pending |
| Chat | PARTIAL | N/A | ✓ | staff | ✓ | ✓ | ✓ | partial | limited | N/A | NO |
| Schedule | PARTIAL | N/A | ✓ | staff | ✓ | ✓ | ✓ | partial | limited | N/A | NO |
| PWA | PARTIAL | ✓ manifest + offline shell + safe update prompt | N/A | manifest | SW static cache only | transactional API bypass | ✓ | ✓ offline/update recovery | frontend typecheck/build PASS | N/A | NO — public runtime pending |
| Demo Mode | READY | Guest lifecycle | Admin confirmation | — | Waiter handoff | Kitchen board | Owner analytics | isolated mock data | mobile/desktop | no production writes | YES |

## Operations

| Area | Status | Coverage | Production Ready |
|---|---|---|---|
| Support Diagnostics | READY | Admin/Manager tenant-safe snapshot: dependencies, counts, subscription, iiko config state, warnings; no secrets/PII/raw logs | NO — public runtime pending |
| Operations / Health | READY (code + CI) | `/health/live` + `/health/ready` DB/cache/realtime, non-sensitive 503, tests + SLO runbook | NO — public-host probe pending |
| Backend deployment | READY (code) | Render Blueprint deploys Django ASGI/Daphne from `/backend`, migrations before start, `/health/live`, production settings, `AI_ENABLED=false`, explicit Postgres/Redis/CORS/hosts env boundaries | NO — Railway provisioning attempt blocked because connected account trial expired; paid public runtime still required |
| Realtime tenant isolation | READY (runtime CI) | Staff JWT restaurant boundary; invalid/expired JWT denial; active guest-token validation; cross-restaurant isolation; assigned-waiter dine-in table scope; guest table-token isolation; delivery/pickup restaurant-wide FOH | YES* — CI Redis/Channels runtime; public WSS smoke pending |

### Cycle 50 — P0 Full Lifecycle Analytics Fix
- FIXED: Owner Analytics date-window crash; operational frontend contract synchronized.
- SAFETY: tenant filters and role boundaries preserved; AI_ENABLED=false.

### Cycle 51 — P0 Analytics Runtime/Type Contract
- FIXED: operations_exception_kpi contract and analytics runtime alignment.
- VERIFIED before patch: 13/14 critical backend tests; later cycles closed the remaining failure.

### Cycle 55 — P0 Full Backend Suite Cleanup
- FIXED: stale SLA/recovery/close/digest fixtures without weakening production contracts.
- VERIFIED: critical restaurant regression 14/14 PASS; frontend typecheck/build PASS.

### Cycle 56 — P0 Midnight-safe SLA Trend Regression
- FIXED: SLA trend fixtures are timezone-independent.
- PRESERVED: Guest/Admin/Manager/Waiter/Kitchen/Owner contracts, tenant isolation, payment guard and realtime permissions.

### Cycle 57 — P0 Full-suite Model Contract Cleanup
- FIXED: email-based User fixtures and SessionItem.price fixture contract.
- PRESERVED: production behavior and AI_ENABLED=false.

### Cycle 59 — P0 Acceptance + Public Runtime Attempt
- VERIFIED: GitHub Actions Plait CI #108 completed successfully on the Cycle 58 verification PR.
- VERIFIED: critical restaurant regression 14/14 PASS, including QR→menu→cart→order→admin→kitchen→ready→waiter→served→close→Owner Analytics.
- VERIFIED: full backend suite 219/219 PASS; Django check, migration drift check and migrations PASS with Redis runtime.
- VERIFIED: frontend npm ci, typecheck and production build PASS.
- VERIFIED: `AI_ENABLED=false` in CI; no external AI API used.
- ATTEMPTED: provisioned public Railway project for the remaining P0 ASGI runtime, but Railway rejected creation because the connected account trial has expired. No production code was weakened or changed to work around billing.
- REMAINING P0: provision a paid/public host with PostgreSQL + Redis, then run `/health/live`, `/health/ready`, HTTPS/WSS and mobile production smoke.
