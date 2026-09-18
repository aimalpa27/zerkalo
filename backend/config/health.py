"""Minimal production health/readiness probes for Plait.

/livez only proves the Django process can answer HTTP.
/readyz checks dependencies required to safely accept restaurant traffic.
Responses intentionally contain no credentials, URLs, exception text or tenant data.
"""
from __future__ import annotations

import time
from typing import Callable

from django.conf import settings
from django.core.cache import cache
from django.db import connections
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _timed(check: Callable[[], None]) -> tuple[bool, int]:
    started = time.monotonic()
    try:
        check()
        ok = True
    except Exception:  # probe must degrade to 503, never crash or leak details
        ok = False
    return ok, max(0, round((time.monotonic() - started) * 1000))


def _check_database() -> None:
    with connections['default'].cursor() as cursor:
        cursor.execute('SELECT 1')
        cursor.fetchone()


def _check_realtime() -> None:
    layer = get_channel_layer()
    if layer is None:
        raise RuntimeError('channel layer unavailable')
    channel = async_to_sync(layer.new_channel)('plait.health.')
    group = 'plait.health.readiness'
    async_to_sync(layer.group_add)(group, channel)
    async_to_sync(layer.group_discard)(group, channel)


def _check_cache() -> None:
    # Unique enough per process/request and short-lived; no tenant/user data involved.
    key = f"plait:ready:{time.monotonic_ns()}"
    cache.set(key, '1', timeout=5)
    if cache.get(key) != '1':
        raise RuntimeError('cache round-trip failed')
    cache.delete(key)


@never_cache
@require_GET
def live(request):
    return JsonResponse(
        {'status': 'ok', 'service': 'plait-api'},
        headers={'X-Plait-Probe': 'live'},
    )


@never_cache
@require_GET
def ready(request):
    db_ok, db_ms = _timed(_check_database)
    cache_ok, cache_ms = _timed(_check_cache)
    realtime_ok, realtime_ms = _timed(_check_realtime)
    checks = {
        'database': {'ok': db_ok, 'latency_ms': db_ms},
        'cache': {'ok': cache_ok, 'latency_ms': cache_ms},
        'realtime': {'ok': realtime_ok, 'latency_ms': realtime_ms},
    }
    ok = all(item['ok'] for item in checks.values())
    # Keep the payload deliberately small and non-sensitive. Redis/DB URLs,
    # exception messages, versions and environment names are never returned.
    return JsonResponse(
        {'status': 'ready' if ok else 'not_ready', 'checks': checks},
        status=200 if ok else 503,
        headers={'X-Plait-Probe': 'ready'},
    )
