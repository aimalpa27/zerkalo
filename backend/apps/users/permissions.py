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
    """Любой сотрудник ресторана `rest_id`, либо superadmin."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'superadmin':
            return True
        rest_id = view.kwargs.get('rest_id')
        return rest_id is not None and str(request.user.restaurant_id) == str(rest_id)