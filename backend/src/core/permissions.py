from rest_framework import permissions

from core.rbac import ROLE_ADMIN, ROLE_FARMACEUTICO, obtener_rol_usuario


class IsPharmacistOrAdmin(permissions.BasePermission):
    """
    Permite el acceso solo a usuarios con rol 'admin' o 'farmaceutico' en el tenant actual.
    El rol se resuelve via TenantUser (RBAC) — NO mediante user.role (que no existe como campo).
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = obtener_rol_usuario(request.user)
        return role in (ROLE_ADMIN, ROLE_FARMACEUTICO)


class IsAdmin(permissions.BasePermission):
    """
    Permite acceso solo a usuarios con rol ADMIN.
    Usado en HU-36 para restricción de permisos.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        role = obtener_rol_usuario(request.user)
        return role == ROLE_ADMIN


class IsAdminOrPharmacist(permissions.BasePermission):
    """
    Permite acceso a ADMIN y FARMACEUTICO.
    Usado en HU-36 para gestión de ventas.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        role = obtener_rol_usuario(request.user)
        return role in [ROLE_ADMIN, ROLE_FARMACEUTICO]
