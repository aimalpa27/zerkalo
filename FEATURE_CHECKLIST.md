# FEATURE_CHECKLIST.md

Обозначения: READY / PARTIAL / BROKEN / NOT IMPLEMENTED. Production Ready = только после runtime + regression подтверждения.

| Функция | Статус | Guest | Admin | Kitchen | Backend/DB | Permissions | Mobile | Errors | Tests | Analytics | Production Ready |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Restaurants | PARTIAL | ✓ | ✓ | N/A | ✓ | ✓ | ✓ | partial | partial | partial | NO |
| Menu | PARTIAL | ✓ resilient | ✓ CRUD | reads items | ✓ | ✓ tenant hardened | ✓ | ✓ | regression green | partial | NO |
| Categories | PARTIAL | ✓ | ✓ | N/A | ✓ | ✓ | ✓ | partial | partial | N/A | NO |
| Tables | PARTIAL | ✓ QR | ✓ CRUD + bulk 1–N | read only | ✓ atomic bulk | Admin/Manager mutate; Waiter/Kitchen denied bulk | ✓ responsive | ✓ duplicates/range/plan errors | bulk suite added; CI running | partial | NO |
| QR Tables | PARTIAL | ✓ direct flow | ✓ | sees table no. | ✓ | ✓ | ✓ | ✓ | lifecycle regression green | partial | NO |
| Cart | PARTIAL | ✓ 24h scoped draft | N/A | N/A | N/A | context-isolated | ✓ | ✓ | lifecycle regression green | N/A | NO |
| Orders | PARTIAL | ✓ realtime | ✓ realtime | ✓ realtime | ✓ | ✓ | ✓ | ✓ | full lifecycle green | ✓ | NO |
| Kitchen | PARTIAL | N/A | sees statuses | ✓ dedicated | ✓ | ✓ least privilege | ✓ | ✓ | regression green | partial | NO |
| Waiter Calls | PARTIAL | ✓ | ✓ | N/A | ✓ | ✓ assigned scope | ✓ | ✓ | backend present | limited | NO |
| Staff | PARTIAL | N/A | ✓ | dedicated auth | ✓ | ✓ | ✓ | partial | isolation green | limited | NO |
| Analytics | PARTIAL | N/A | ✓ | N/A | ✓ | ✓ | ✓ | ✓ | full-flow green | ✓ | NO |
| Upsell | NOT IMPLEMENTED | — | — | N/A | — | — | — | — | — | — | NO |
| Payments | PARTIAL | request/method | ✓ guarded close | N/A | ✓ | ✓ | ✓ | ✓ | regression green | ✓ | NO |
| Promos | PARTIAL | ✓ | limited | N/A | ✓ | review | ✓ | partial | limited | limited | NO |
| Settings | PARTIAL | consumes | ✓ | N/A | ✓ | ✓ | ✓ | partial | limited | N/A | NO |
| Onboarding | READY | N/A | ✓ real-data readiness + Go Live | hidden | existing APIs | Admin/Manager only | ✓ | ✓ | green | N/A | YES |
| Delivery/Takeaway | PARTIAL | ✓ | ✓ | partial | ✓ | ✓ | ✓ | partial | backend present | partial | NO |
| Chat | PARTIAL | N/A | ✓ | staff | ✓ | ✓ | ✓ | partial | limited | N/A | NO |
| Schedule | PARTIAL | N/A | ✓ | staff | ✓ | ✓ | ✓ | partial | limited | N/A | NO |
| PWA | PARTIAL | ✓ manifest + offline shell | N/A | manifest | SW static cache only | transactional API bypass | ✓ | ✓ | boundary checks + CI build | N/A | NO |
| Demo Mode | NOT IMPLEMENTED | — | — | — | — | — | — | — | — | — | NO |
