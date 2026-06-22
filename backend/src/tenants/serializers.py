from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import Plan, Suscripcion, Tenant, TenantUser


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = (
            "id",
            "nombre",
            "slug",
            "precio_mensual",
            "precio_anual",
            "limite_usuarios",
            "limite_productos",
            "limite_inventario_items",
            "limite_almacenamiento_mb",
            "permite_reportes_ia",
            "permite_backups",
            "permite_predicciones",
        )


class TenantRegisterSerializer(serializers.Serializer):
    nombre_farmacia = serializers.CharField(max_length=160)
    subdominio = serializers.SlugField(max_length=63)
    email_admin = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    telefono = serializers.CharField(max_length=40, required=False, allow_blank=True)
    direccion = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_subdominio(self, value):
        normalized = value.strip().lower()
        if Tenant.objects.filter(subdomain=normalized).exists():
            raise serializers.ValidationError("El subdominio ya esta en uso.")
        return normalized

    def validate_email_admin(self, value):
        return value.strip().lower()


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = (
            "id",
            "name",
            "schema_name",
            "subdomain",
            "contact_email",
            "phone",
            "address",
            "status",
            "trial_start_at",
            "trial_end_at",
            "paid_start_at",
            "created_at",
        )


class TenantMembershipSerializer(serializers.ModelSerializer):
    tenant = TenantSerializer(read_only=True)

    class Meta:
        model = TenantUser
        fields = ("tenant", "role", "is_active", "joined_at")


class SuscripcionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)
    tenant = TenantSerializer(read_only=True)
    en_trial = serializers.SerializerMethodField()

    class Meta:
        model = Suscripcion
        fields = (
            "id",
            "tenant",
            "plan",
            "fecha_inicio",
            "fecha_fin",
            "auto_renovar",
            "estado",
            "stripe_customer_id",
            "stripe_subscription_id",
            "en_trial",
        )

    def get_en_trial(self, obj):
        return obj.estado == "trialing" and obj.tenant.trial_end_at >= timezone.now()


class GlobalLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6)
    subdominio = serializers.SlugField(max_length=63, required=False, allow_blank=True)


class TenantUserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = TenantUser
        fields = ("id", "email", "role", "is_active", "joined_at")
