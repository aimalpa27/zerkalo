# Cycle 58 verification

Final P0 acceptance run for the current main after Cycle 55–57 regression repairs.

Acceptance gates:
- Django check + migration drift + migrations
- critical QR → menu → cart → order → admin → kitchen → ready → waiter → served → close → analytics
- full backend suite
- realtime tenant isolation and Kitchen least privilege
- frontend npm ci + typecheck + build

AI_ENABLED=false. No external AI APIs.
