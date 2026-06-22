from rest_framework.permissions import BasePermission
from core.rbac import tiene_permiso

class PuedeGestionarCategorias(BasePermission):
    def has_permission(self, request, view):
        return tiene_permiso(request.user, "categorias.gestionar")


class PuedeVerCategorias(BasePermission):
    def has_permission(self, request, view):
        return tiene_permiso(request.user, "categorias.ver")
    

class PuedeGestionarSubcategorias(BasePermission):
    def has_permission(self, request, view):
        return tiene_permiso(request.user, "subcategorias.gestionar")


class PuedeVerSubcategorias(BasePermission):
    def has_permission(self, request, view):
        return tiene_permiso(request.user, "subcategorias.ver")
    
class PuedeGestionarLaboratorios(BasePermission):
    def has_permission(self, request, view):
        return tiene_permiso(request.user, "laboratorios.gestionar")


class PuedeVerLaboratorios(BasePermission):
    def has_permission(self, request, view):
        return tiene_permiso(request.user, "laboratorios.ver")
