from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from rest_framework import serializers

from .rbac import (
    ROLE_ADMIN,
    ROLE_CLIENTE,
    PERMISOS_CATALOGO,
    asignar_rol_usuario,
    normalizar_nombre_rol,
    obtener_catalogo_permisos,
    obtener_permisos_rol,
    obtener_roles_disponibles,
    obtener_permisos_usuario,
    obtener_rol_usuario,
    puede_acceder_backoffice,
)
from .models import BitacoraSistema


def _generate_unique_username(email):
    user_model = get_user_model()
    base = (email.split("@")[0] or "usuario").strip().replace(" ", "")[:120] or "usuario"
    candidate = base
    index = 1
    while user_model.objects.filter(username=candidate).exists():
        candidate = f"{base}{index}"
        index += 1
    return candidate


def _tenant_from_context(serializer_instance):
    request = serializer_instance.context.get("request") if serializer_instance.context else None
    if request is not None and getattr(request, "tenant", None) is not None:
        return getattr(request, "tenant", None)
    if serializer_instance.context:
        return serializer_instance.context.get("tenant")
    return None


class RegisterSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(required=True, max_length=150)
    last_name = serializers.CharField(required=True, max_length=150)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = get_user_model()
        fields = ("first_name", "last_name", "email", "password")

    def validate_email(self, value):
        user_model = get_user_model()
        normalized = value.strip().lower()
        if user_model.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("Este correo ya esta registrado.")
        return normalized

    def create(self, validated_data):
        from django.conf import settings

        user_model = get_user_model()
        validated_data["username"] = _generate_unique_username(validated_data["email"])
        user = user_model.objects.create_user(**validated_data)
        user.is_active = settings.DEBUG
        user.save(update_fields=["is_active"])
        return user


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    can_access_admin = serializers.SerializerMethodField()
    permisos = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ("id", "username", "first_name", "last_name", "email", "role", "can_access_admin", "permisos")

    def get_role(self, obj):
        return obtener_rol_usuario(obj, tenant=_tenant_from_context(self))

    def get_can_access_admin(self, obj):
        return puede_acceder_backoffice(obj, tenant=_tenant_from_context(self))

    def get_permisos(self, obj):
        return obtener_permisos_usuario(obj, tenant=_tenant_from_context(self))


class AdminUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    can_access_admin = serializers.SerializerMethodField()
    permisos = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "can_access_admin",
            "permisos",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
        )

    def get_role(self, obj):
        return obtener_rol_usuario(obj, tenant=_tenant_from_context(self))

    def get_can_access_admin(self, obj):
        return puede_acceder_backoffice(obj, tenant=_tenant_from_context(self))

    def get_permisos(self, obj):
        return obtener_permisos_usuario(obj, tenant=_tenant_from_context(self))


class AdminUserUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False)
    role = serializers.CharField(required=False)
    is_active = serializers.BooleanField(required=False)
    password = serializers.CharField(write_only=True, min_length=6, required=False)

    def _count_active_admins(self):
        user_model = get_user_model()
        return (
            user_model.objects.filter(is_active=True)
            .filter(Q(is_superuser=True) | Q(groups__name=ROLE_ADMIN))
            .distinct()
            .count()
        )

    def validate_email(self, value):
        user_model = get_user_model()
        normalized = value.strip().lower()
        exists = user_model.objects.filter(email__iexact=normalized).exclude(id=self.instance.id).exists()
        if exists:
            raise serializers.ValidationError("Este correo ya esta registrado.")
        return normalized

    def validate_role(self, value):
        role = normalizar_nombre_rol(value)
        if role not in set(obtener_roles_disponibles()):
            raise serializers.ValidationError("El rol indicado no existe.")
        return role

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Debes enviar al menos un campo para actualizar.")

        request_user = self.context.get("request_user")
        target_user = self.instance
        current_role = obtener_rol_usuario(target_user)
        next_role = attrs.get("role", current_role)
        next_active = attrs.get("is_active", target_user.is_active)

        if "password" in attrs:
            validate_password(attrs["password"])

        if current_role == ROLE_ADMIN and target_user.is_active and (not next_active or next_role != ROLE_ADMIN):
            if self._count_active_admins() <= 1:
                raise serializers.ValidationError("No puedes quitar o desactivar el ultimo administrador activo.")

        if request_user and target_user and request_user.id == target_user.id:
            requested_role = attrs.get("role")
            requested_active = attrs.get("is_active")

            if requested_active is False:
                raise serializers.ValidationError("No puedes desactivar tu propia cuenta.")

            if requested_role and requested_role != ROLE_ADMIN:
                raise serializers.ValidationError("No puedes quitarte el rol de administrador a ti mismo.")

        return attrs

    def update(self, instance, validated_data):
        update_fields = []

        if "first_name" in validated_data:
            instance.first_name = validated_data["first_name"]
            update_fields.append("first_name")

        if "last_name" in validated_data:
            instance.last_name = validated_data["last_name"]
            update_fields.append("last_name")

        if "email" in validated_data:
            instance.email = validated_data["email"]
            update_fields.append("email")

        role = validated_data.get("role")
        if role:
            asignar_rol_usuario(instance, role)
            update_fields.extend(["is_superuser", "is_staff"])

        if "is_active" in validated_data:
            instance.is_active = validated_data["is_active"]
            update_fields.append("is_active")

        if "password" in validated_data:
            instance.set_password(validated_data["password"])
            update_fields.append("password")

        if "email" in validated_data and not instance.username:
            instance.username = _generate_unique_username(validated_data["email"])
            update_fields.append("username")

        if update_fields:
            # Preserve deterministic update fields and avoid duplicates.
            unique_update_fields = list(dict.fromkeys(update_fields))
            instance.save(update_fields=unique_update_fields)
        return instance


class AdminUserCreateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.CharField(default=ROLE_CLIENTE)
    is_active = serializers.BooleanField(default=True)

    def validate_role(self, value):
        role = normalizar_nombre_rol(value)
        if role not in set(obtener_roles_disponibles()):
            raise serializers.ValidationError("El rol indicado no existe.")
        return role

    def validate_email(self, value):
        user_model = get_user_model()
        normalized = value.strip().lower()
        if user_model.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("Este correo ya esta registrado.")
        return normalized

    def create(self, validated_data):
        user_model = get_user_model()
        role = validated_data.pop("role", ROLE_CLIENTE)
        is_active = validated_data.pop("is_active", True)

        validated_data["username"] = _generate_unique_username(validated_data["email"])

        user = user_model.objects.create_user(**validated_data)
        user.is_active = is_active

        asignar_rol_usuario(user, role)

        user.save(update_fields=["is_active", "is_superuser", "is_staff"])
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class RolSerializer(serializers.Serializer):
    nombre = serializers.CharField()
    permisos = serializers.ListField(child=serializers.CharField(), required=False)

    def to_representation(self, instance):
        return {
            "nombre": instance if isinstance(instance, str) else instance.name,
            "permisos": obtener_permisos_rol(instance if isinstance(instance, str) else instance.name),
        }


class RolCreateUpdateSerializer(serializers.Serializer):
    nombre = serializers.CharField(required=True)
    permisos = serializers.ListField(child=serializers.CharField(), required=False, default=list)

    def validate_nombre(self, value):
        return normalizar_nombre_rol(value)

    def validate_permisos(self, value):
        catalog = set(obtener_catalogo_permisos())
        invalid = [code for code in value if code not in catalog]
        if invalid:
            raise serializers.ValidationError(f"Permisos invalidos: {', '.join(invalid)}")
        return sorted(set(value))


class PermisoCatalogoSerializer(serializers.Serializer):
    codigo = serializers.CharField()
    nombre = serializers.CharField()

    def to_representation(self, instance):
        return {
            "codigo": instance,
            "nombre": PERMISOS_CATALOGO.get(instance, instance),
        }


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True, min_length=6)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Las contrasenas no coinciden."})

        validate_password(attrs["password"])
        return attrs


class BitacoraSistemaSerializer(serializers.ModelSerializer):
    usuario_email = serializers.EmailField(source="usuario.email", read_only=True, allow_null=True)
    usuario_nombre = serializers.CharField(source="usuario.first_name", read_only=True, allow_null=True)
    usuario_apellido = serializers.CharField(source="usuario.last_name", read_only=True, allow_null=True)
    usuario_rol = serializers.SerializerMethodField()

    class Meta:
        model = BitacoraSistema
        fields = (
            "id",
            "fecha_hora",
            "usuario",
            "usuario_email",
            "usuario_nombre",
            "usuario_apellido",
            "usuario_rol",
            "accion",
            "modulo",
            "entidad",
            "entidad_id",
            "resultado",
            "mensaje",
            "ip_origen",
            "navegador",
            "ruta",
            "metodo_http",
        )

    def get_usuario_rol(self, obj):
        if not obj.usuario:
            return None
        return obtener_rol_usuario(obj.usuario)
