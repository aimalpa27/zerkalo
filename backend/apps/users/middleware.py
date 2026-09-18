import logging

logger = logging.getLogger('apps.security')


class SecurityResponseLoggingMiddleware:
    """
    FIX (RECOMMENDATION → implemented): the audit checklist asks for logging
    of suspicious activity (repeated 401/403 from the same IP, anomaly
    monitoring). Django/DRF do not log 401/403 responses by default — only
    unhandled exceptions and SuspiciousOperation reach `django.security`.

    This middleware logs every 401/403 response on /api/ with the
    requesting IP, path, method and (if authenticated) user id, at WARNING
    level, so they land in the same handlers as other security events
    (console + rotating file in production, see LOGGING in
    config/settings/base.py) and can be alerted on / fed into Sentry or a
    log-based anomaly monitor.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if response.status_code in (401, 403) and request.path.startswith('/api/'):
            user = getattr(request, 'user', None)
            user_id = user.id if user and getattr(user, 'is_authenticated', False) else None
            logger.warning(
                'AUTH_DENIED status=%s method=%s path=%s ip=%s user_id=%s',
                response.status_code,
                request.method,
                request.path,
                _get_ip(request),
                user_id,
            )

        return response


def _get_ip(request) -> str:
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '?')
