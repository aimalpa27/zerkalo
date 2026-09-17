#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export AI_ENABLED=false
export SECRET_KEY="${SECRET_KEY:-local-verification-only-secret}"
export DEBUG="${DEBUG:-True}"
export DATABASE_URL="${DATABASE_URL:-sqlite:///$ROOT/backend/verify.sqlite3}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.development}"

cd "$ROOT/backend"
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput
python manage.py test \
  apps.sessions.tests.FullRestaurantRegressionFlowTest \
  apps.sessions.tests.KitchenLeastPrivilegeTests \
  apps.websocket.tests.WebsocketTenantIsolationTests -v 2
python manage.py test apps.users apps.restaurants apps.menu apps.tables apps.sessions apps.calls apps.analytics apps.websocket -v 1

cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  echo "frontend/node_modules missing. Run npm ci first." >&2
  exit 2
fi
npm run typecheck
npm run build
