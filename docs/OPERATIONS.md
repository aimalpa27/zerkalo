# Plait production operations

## Health probes

- `GET /health/live` — process liveness only. Use for container liveness/restart decisions.
- `GET /health/ready` — traffic readiness. Returns HTTP 200 only when database, Django cache and Channels realtime layer complete a round-trip; otherwise HTTP 503.
- Probe responses never expose connection URLs, credentials, exception strings, versions or tenant data.
- Do not use `/health/ready` as a high-frequency public monitoring endpoint; 30–60 seconds is sufficient.

Suggested deployment policy: liveness every 30s with 3 consecutive failures before restart; readiness every 30s and remove the instance from traffic immediately on 503. Keep application alerts outside the request path.

## Initial SLOs

These are product targets, not claims about current production performance.

| Signal | Initial target | Alert condition |
|---|---:|---|
| API availability | 99.9% / 30d | readiness failures for 3 consecutive checks |
| Guest menu/API p95 | < 800 ms | p95 > 1.5s for 10 min |
| Order create p95 | < 1.0 s | p95 > 2s for 10 min |
| Realtime order propagation | < 2 s | channel readiness fails or sustained reconnect errors |
| 5xx rate | < 1% | > 2% for 5 min |

## Incident order

1. Check `/health/live`; if down, restart/rollback the API container.
2. Check `/health/ready`; identify only the failed dependency name (`database`, `cache`, `realtime`). Never paste secrets into incident chat.
3. Protect ordering first: if database/realtime is unhealthy, keep the instance out of traffic rather than serving a partially working restaurant flow.
4. After recovery, run `scripts/verify.sh` before promoting a new release.

`AI_ENABLED=false` remains the default verification contract. Monitoring must not depend on any external AI provider.
