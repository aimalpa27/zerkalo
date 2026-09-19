from rest_framework.permissions import BasePermission


class IsRestaurantAdmin(BasePermission):
    """Admin/manager ресторана `rest_id`, либо superadmin (тех-поддержка Plait — доступ ко всем)."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'superadmin':
            return True
        rest_id = view.kwargs.get('rest_id')
        return (
            rest_id is not None
            and str(request.user.restaurant_id) == str(rest_id)
            and request.user.is_admin_or_manager
        )


class IsRestaurantStaff(BasePermission):
    """Generic front-of-house staff for restaurant-scoped non-kitchen APIs.

    Kitchen is intentionally excluded here. Kitchen access must be granted only
    through an endpoint-specific permission such as IsRestaurantSessionStaff,
    which keeps its least-privilege lifecycle scope explicit.
    """
    allowed_roles = {'admin', 'manager', 'waiter', 'cashier'}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'superadmin':
            return True
        rest_id = view.kwargs.get('rest_id')
        return (
            rest_id is not None
            and str(request.user.restaurant_id) == str(rest_id)
            and request.user.role in self.allowed_roles
        )


class IsRestaurantSessionStaff(BasePermission):
    """Tenant-safe roles allowed to participate in the order lifecycle.

    Kept separate from generic IsRestaurantStaff so kitchen least-privilege is
    explicit and future non-operational roles are not admitted accidentally.
    """
    allowed_roles = {'admin', 'manager', 'waiter', 'cashier', 'kitchen'}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'superadmin':
            return True
        rest_id = view.kwargs.get('rest_id')
        return (
            rest_id is not None
            and str(request.user.restaurant_id) == str(rest_id)
            and request.user.role in self.allowed_roles
        )
