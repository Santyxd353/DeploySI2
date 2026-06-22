from django.contrib import admin

from .models import Domain, Plan, Suscripcion, Tenant, TenantRole, TenantUser


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "schema_name", "subdomain", "status", "trial_end_at", "created_at")
    search_fields = ("name", "schema_name", "subdomain", "contact_email")
    list_filter = ("status",)


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ("domain", "tenant", "is_primary", "is_custom")
    search_fields = ("domain",)


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("nombre", "slug", "precio_mensual", "precio_anual", "activo")
    list_filter = ("activo",)
    search_fields = ("nombre", "slug")


@admin.register(Suscripcion)
class SuscripcionAdmin(admin.ModelAdmin):
    list_display = ("tenant", "plan", "estado", "fecha_inicio", "fecha_fin", "auto_renovar")
    list_filter = ("estado", "auto_renovar")


@admin.register(TenantUser)
class TenantUserAdmin(admin.ModelAdmin):
    list_display = ("tenant", "user", "role", "is_active", "joined_at")
    list_filter = ("role", "is_active")


@admin.register(TenantRole)
class TenantRoleAdmin(admin.ModelAdmin):
    list_display = ("tenant", "nombre", "updated_at")
    search_fields = ("nombre",)
