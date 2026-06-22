from django.conf import settings
from django.http import JsonResponse
from django.db import connection
from django.urls import set_urlconf
from django_tenants.middleware.main import TenantMainMiddleware

from .context import clear_current_tenant, set_current_tenant
from .models import Domain, Suscripcion, Tenant, TenantUser


class DevTenantHeaderMiddleware:
    """
    Fallback para desarrollo local: permite resolver el tenant usando
    el header X-Tenant-Subdomain cuando el frontend corre en un subdominio
    local pero llama al backend por localhost:8000.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        subdomain = (request.headers.get("X-Tenant-Subdomain") or "").strip().lower()
        if subdomain:
            tenant = Tenant.objects.filter(subdomain=subdomain, status="activo").first()
            # Permite forzar tenant por header en desarrollo, incluso si localhost
            # ya resolvio a otro tenant por dominio.
            # Tambien forzamos ROOT_URLCONF siempre para evitar que una peticion
            # quede accidentalmente en PUBLIC_SCHEMA_URLCONF.
            if tenant is not None:
                request.tenant = tenant
                tenant.domain_url = f"{subdomain}.localhost"
                connection.set_tenant(tenant)
                # Reset urlconf to ROOT_URLCONF (tenant routes).
                request.urlconf = settings.ROOT_URLCONF
                set_urlconf(settings.ROOT_URLCONF)

        return self.get_response(request)


class TenantContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant = getattr(request, "tenant", None)
        set_current_tenant(tenant)
        try:
            return self.get_response(request)
        finally:
            clear_current_tenant()


class TenantAccessMiddleware:
    """
    Bloquea acceso a tenants no activos y valida limites simples por plan.
    """

    MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant = getattr(request, "tenant", None)
        if tenant is None or getattr(tenant, "schema_name", "public") == "public":
            return self.get_response(request)

        if tenant.status != "activo":
            return JsonResponse({"detail": "Tenant suspendido o inactivo."}, status=403)

        if request.method in self.MUTATING_METHODS:
            denied = self._validate_limits(request, tenant)
            if denied is not None:
                return denied

        return self.get_response(request)

    def _validate_limits(self, request, tenant):
        sub = (
            Suscripcion.objects.select_related("plan")
            .filter(tenant=tenant)
            .order_by("-created_at")
            .first()
        )
        if sub is None or sub.plan is None:
            return None

        path = request.path.lower()
        plan = sub.plan

        if "/api/admin/users" in path and request.method == "POST":
            members = TenantUser.objects.filter(tenant=tenant, is_active=True).count()
            if members >= plan.limite_usuarios:
                return JsonResponse({"detail": "Limite de usuarios alcanzado para tu plan."}, status=402)

        if "/api/inventarios/productos" in path and request.method == "POST":
            from inventarios.models import Producto

            productos = Producto.objects.count()
            if productos >= plan.limite_productos:
                return JsonResponse({"detail": "Limite de productos alcanzado para tu plan."}, status=402)

        return None
