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
    """Generic restaurant staff, excluding the least-privilege kitchen role."""

    GENERIC_STAFF_ROLES = {'admin', 'manager', 'waiter', 'cashier'}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'superadmin':
            return True
        rest_id = view.kwargs.get('rest_id')
        return (
            rest_id is not None
            and str(request.user.restaurant_id) == str(rest_id)
            and request.user.role in self.GENERIC_STAFF_ROLES
        )


class IsRestaurantSessionStaff(BasePermission):
    """Tenant guard for restaurant session/order staff endpoints.

    Session flow intentionally includes ``kitchen`` so that a kitchen account
    can read active orders and perform only the transitions explicitly allowed
    by session views.  Those views enforce waiter assignments, kitchen
    least-privilege and payment/close restrictions.  Keeping this permission
    separate prevents kitchen users from gaining access to unrelated generic
    staff APIs such as table management.
    """

    SESSION_STAFF_ROLES = {'admin', 'manager', 'waiter', 'cashier', 'kitchen'}

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'superadmin':
            return True
        rest_id = view.kwargs.get('rest_id')
        return (
            rest_id is not None
            and str(request.user.restaurant_id) == str(rest_id)
            and request.user.role in self.SESSION_STAFF_ROLES
        )
