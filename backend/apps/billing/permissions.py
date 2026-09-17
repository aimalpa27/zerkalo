from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    """Тех-команда Plait — управляет всеми ресторанами и тарифами."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'superadmin'
        )