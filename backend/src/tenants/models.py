from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone
from django_tenants.models import DomainMixin, TenantMixin


def default_trial_end_at():
    return timezone.now() + timedelta(days=14)


class Tenant(TenantMixin):
    ESTADO_CHOICES = [
        ("activo", "Activo"),
        ("suspendido", "Suspendido"),
        ("cancelado", "Cancelado"),
    ]

    name = models.CharField(max_length=160)
    subdomain = models.SlugField(max_length=63, unique=True)
    contact_email = models.EmailField()
    phone = models.CharField(max_length=40, blank=True, default="")
    address = models.CharField(max_length=255, blank=True, default="")

    trial_start_at = models.DateTimeField(default=timezone.now)
    trial_end_at = models.DateTimeField(default=default_trial_end_at)
    paid_start_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="activo", db_index=True)

    auto_create_schema = True

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenants_tenant"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.schema_name})"

    @property
    def is_active(self):
        return self.status == "activo"


class Domain(DomainMixin):
    is_custom = models.BooleanField(default=False)

    class Meta:
        db_table = "tenants_domain"


class Plan(models.Model):
    nombre = models.CharField(max_length=80)
    slug = models.SlugField(max_length=40, unique=True)
    precio_mensual = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    precio_anual = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))

    limite_usuarios = models.PositiveIntegerField(default=3)
    limite_productos = models.PositiveIntegerField(default=500)
    limite_inventario_items = models.PositiveIntegerField(default=3000)
    limite_almacenamiento_mb = models.PositiveIntegerField(default=512)

    permite_reportes_ia = models.BooleanField(default=False)
    permite_backups = models.BooleanField(default=False)
    permite_predicciones = models.BooleanField(default=False)

    stripe_price_id_mensual = models.CharField(max_length=120, blank=True, default="")
    stripe_price_id_anual = models.CharField(max_length=120, blank=True, default="")

    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenants_plan"
        ordering = ["precio_mensual", "id"]

    def __str__(self):
        return self.nombre


class Suscripcion(models.Model):
    ESTADO_CHOICES = [
        ("trialing", "Trial"),
        ("active", "Activa"),
        ("past_due", "Vencida"),
        ("canceled", "Cancelada"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="suscripciones")
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="suscripciones")

    fecha_inicio = models.DateTimeField(default=timezone.now)
    fecha_fin = models.DateTimeField(null=True, blank=True)
    auto_renovar = models.BooleanField(default=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="trialing")

    stripe_customer_id = models.CharField(max_length=120, blank=True, default="")
    stripe_subscription_id = models.CharField(max_length=120, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenants_suscripcion"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tenant.schema_name} - {self.plan.slug}"


class TenantRole(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="roles")
    nombre = models.CharField(max_length=60)
    permisos = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenants_tenant_role"
        unique_together = [("tenant", "nombre")]
        ordering = ["nombre"]


class TenantUser(models.Model):
    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("farmaceutico", "Farmaceutico"),
        ("cajero", "Cajero"),
        ("cliente", "Cliente"),
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tenant_memberships")
    role = models.CharField(max_length=60, choices=ROLE_CHOICES, default="cliente")
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenants_tenant_user"
        unique_together = [("tenant", "user")]

    def __str__(self):
        return f"{self.user_id} @ {self.tenant.schema_name} ({self.role})"
