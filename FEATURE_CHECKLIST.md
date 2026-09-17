# FEATURE_CHECKLIST.md

Обозначения: READY / PARTIAL / BROKEN / NOT IMPLEMENTED. Production Ready = только после runtime + regression подтверждения.

| Функция | Статус | Guest | Admin | Kitchen | Backend/DB | Permissions | Mobile | Errors | Tests | Analytics | Production Ready |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Restaurants | PARTIAL | ✓ | ✓ | N/A | ✓ | ✓ | ✓ | partial | partial | partial | NO |
| Menu | PARTIAL | ✓ | ✓ | reads items | ✓ | ✓ tenant relation hardened | ✓ | partial | tenant regression added | partial | NO |
| Categories | PARTIAL | ✓ | ✓ | N/A | ✓ | ✓ | ✓ | partial | partial | N/A | NO |
| Tables | PARTIAL | ✓ | ✓ | sees table no. | ✓ | ✓ | ✓ | ✓ | backend partial | partial | NO |
| QR Tables | PARTIAL | ✓ FIXED direct flow | ✓ | sees table no. | ✓ | ✓ | ✓ | ✓ | needs frontend E2E | partial | NO |
| Cart | PARTIAL | ✓ | N/A | N/A | N/A | N/A | ✓ | partial | missing frontend tests | N/A | NO |
| Orders | PARTIAL | ✓ realtime status | ✓ realtime + resilient sessions loading/error/retry | ✓ realtime refresh + JWT reconnect hardened | ✓ session race + status broadcast hardened | ✓ tenant + assigned-waiter table scope | ✓ | payment-boundary error ✓ | full cross-endpoint QR→close→analytics regression added + CI gate | final total/top revenue hardened | NO |
| Kitchen | PARTIAL | N/A | sees statuses | ✓ dedicated kitchen auth + realtime reload | ✓ dedicated role | ✓ least privilege: read sessions + confirmed↔ready only | tablet/mobile resilient | ✓ loading/error/empty + retry + stale-data preservation + action errors | regression added + CI gate; sandbox runtime blocked | prep data partial | NO |
| Waiter Calls | PARTIAL | ✓ | ✓ resilient loading/error/retry | N/A | ✓ | ✓ assigned-waiter REST/realtime scope | ✓ | ✓ stale-data warning | backend present | limited | NO |
| Staff | PARTIAL | N/A | ✓ | dedicated kitchen auth | ✓ | ✓ kitchen excluded from generic staff APIs | ✓ | partial | kitchen creation/isolation regression added | limited | NO |
| Analytics | PARTIAL | N/A | ✓ authoritative API + retry/stale snapshot | N/A | ✓ summary + closed history | ✓ | ✓ | ✓ no fake-zero fallback | quantity/non-billable + full-flow regression added | ✓ top-item revenue fixed + closed history | NO |
| Upsell | NOT IMPLEMENTED | — | — | N/A | — | — | — | — | — | — | NO |
| Payments | PARTIAL | request/method | ✓ guarded close | N/A | ✓ transition guards | ✓ waiter/role scope | ✓ | explicit close errors ✓ | backend regression added | closed-total consistency ✓ | NO |
| Promos | PARTIAL | ✓ | limited | N/A | ✓ | review | ✓ | partial | limited | limited | NO |
| Settings | PARTIAL | consumes | ✓ | N/A | ✓ | ✓ | ✓ | partial | limited | N/A | NO |
| Onboarding | NOT IMPLEMENTED | N/A | — | N/A | existing primitives | — | — | — | — | — | NO |
| Delivery/Takeaway | PARTIAL | ✓ | ✓ | partial | ✓ | ✓ | ✓ | partial | backend present | partial | NO |
| Chat | PARTIAL | N/A | ✓ | staff | ✓ | ✓ | ✓ | partial | limited | N/A | NO |
| Schedule | PARTIAL | N/A | ✓ | staff | ✓ | ✓ | ✓ | partial | limited | N/A | NO |
| PWA | PARTIAL | manifest | N/A | manifest | N/A | N/A | ✓ | N/A | missing | N/A | NO |
| Demo Mode | NOT IMPLEMENTED | — | — | — | — | — | — | — | — | — | NO |
