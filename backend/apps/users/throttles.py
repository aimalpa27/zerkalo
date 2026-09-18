from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


class OrderRateThrottle(SimpleRateThrottle):
    """Rate-limits POST /sessions/ per table_token to prevent order spam."""
    scope = 'order'

    def get_cache_key(self, request, view):
        ident = request.data.get('table_token') or self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class WaiterCallRateThrottle(SimpleRateThrottle):
    """Rate-limits POST /waiter-calls/ per table_token."""
    scope = 'waiter_call'

    def get_cache_key(self, request, view):
        ident = request.data.get('table_token') or self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}
