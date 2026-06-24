import re

from django.contrib.auth import get_user_model

from tenants.context import get_current_tenant
from tenants.models import TenantRole, TenantUser

ROLE_ADMIN = "admin"
ROLE_FARMACEUTICO = "farmaceutico"
ROLE_CAJERO = "cajero"
ROLE_CLIENTE = "cliente"
ROLE_REPARTIDOR = "repartidor"

ROLES_DISPONIBLES = [ROLE_ADMIN, ROLE_FARMACEUTICO, ROLE_CAJERO, ROLE_CLIENTE, ROLE_REPARTIDOR]
ROLES_BASE = [ROLE_ADMIN, ROLE_FARMACEUTICO, ROLE_CAJERO, ROLE_CLIENTE, ROLE_REPARTIDOR]
ROLES_PROTEGIDOS = {ROLE_ADMIN}

PERMISOS_CATALOGO = {
    "usuarios.ver": "Puede ver usuarios",
    "usuarios.gestionar": "Puede gestionar usuarios",
    "productos.ver": "Puede ver productos",
    "productos.gestionar": "Puede gestionar productos",
    "inventario.ver": "Puede ver inventario",
    "inventario.gestionar": "Puede gestionar inventario",
    "inventario.registrar_entrada": "Puede registrar entradas de stock",
    "pedidos.ver": "Puede ver pedidos",
    "pedidos.gestionar": "Puede gestionar pedidos",
    "ventas.ver": "Puede ver ventas",
    "ventas.gestionar": "Puede gestionar ventas",
    "reportes.ver": "Puede ver reportes",
    "tratamientos.ver": "Puede ver tratamientos",
    "tratamientos.gestionar": "Puede gestionar tratamientos",
    "clientes.ver": "Puede ver clientes",
    "clientes.gestionar": "Puede gestionar clientes",
    "categorias.ver": "Puede ver categorias",
    "categorias.gestionar": "Puede gestionar categorias",
    "subcategorias.ver": "Puede ver subcategorias",
    "subcategorias.gestionar": "Puede gestionar subcategorias",
    "laboratorios.ver": "Puede ver laboratorios",
    "laboratorios.gestionar": "Puede gestionar laboratorios",
    "opiniones.ver": "Puede ver opiniones",
    "opiniones.gestionar": "Puede gestionar opiniones",
    "publicidad.ver": "Puede ver campañas publicitarias",
    "publicidad.gestionar": "Puede gestionar campañas publicitarias",
}

PERMISOS_ROL = {
    ROLE_ADMIN: set(PERMISOS_CATALOGO.keys()),
    ROLE_FARMACEUTICO: {
        "publicidad.ver",
        "productos.ver",
        "productos.gestionar",
        "inventario.ver",
        "inventario.gestionar",
        "inventario.registrar_entrada",
        "pedidos.ver",
        "pedidos.gestionar",
        "ventas.ver",
        "ventas.gestionar",
        "reportes.ver",
        "tratamientos.ver",
        "tratamientos.gestionar",
        "clientes.ver",
        "categorias.ver",
        "categorias.gestionar",
        "subcategorias.ver",
        "subcategorias.gestionar",
        "laboratorios.ver",
        "laboratorios.gestionar",
        "opiniones.ver",
        "opiniones.gestionar",
    },
    ROLE_CAJERO: {
        "productos.ver",
        "pedidos.ver",
        "pedidos.gestionar",
        "ventas.ver",
        "ventas.gestionar",
        "reportes.ver",
        "tratamientos.ver",
        "clientes.ver",
        "clientes.gestionar",
        "categorias.ver",
        "subcategorias.ver",
        "laboratorios.ver",
        "opiniones.ver",
    },
    ROLE_CLIENTE: set(),
    ROLE_REPARTIDOR: {
        "pedidos.ver",
        "pedidos.gestionar",
    },
}


def normalizar_nombre_rol(role_name: str) -> str:
    role = (role_name or "").strip().lower().replace(" ", "_")
    if not re.fullmatch(r"[a-z0-9_]{3,40}", role):
        raise ValueError("El nombre del rol debe tener entre 3 y 40 caracteres (a-z, 0-9, _).")
    return role


def _perm_to_codename(permission_code: str) -> str:
    return permission_code.replace(".", "_")


def _resolve_tenant(tenant=None):
    if tenant is not None:
        return tenant
    current = get_current_tenant()
    if current is not None and getattr(current, "schema_name", "public") != "public":
        return current
    return None


def seed_roles_y_permisos():
    return None


def obtener_roles_disponibles(tenant=None):
    resolved_tenant = _resolve_tenant(tenant)
    roles = set(ROLES_DISPONIBLES)
    if resolved_tenant is not None:
        custom_roles = TenantRole.objects.filter(tenant=resolved_tenant).values_list("nombre", flat=True)
        roles.update(custom_roles)
    return sorted(roles)


def obtener_catalogo_permisos():
    return sorted(PERMISOS_CATALOGO.keys())


def crear_rol(role_name, permission_codes, tenant=None):
    role = normalizar_nombre_rol(role_name)
    if role in ROLES_PROTEGIDOS:
        raise ValueError("El rol indicado esta protegido.")

    resolved_tenant = _resolve_tenant(tenant)
    if resolved_tenant is None:
        raise ValueError("No se pudo resolver el tenant para crear el rol.")

    if TenantRole.objects.filter(tenant=resolved_tenant, nombre=role).exists():
        raise ValueError("Ya existe un rol con ese nombre.")

    return TenantRole.objects.create(
        tenant=resolved_tenant,
        nombre=role,
        permisos=sorted(set(permission_codes)),
    )


def actualizar_permisos_rol(role_group, permission_codes, tenant=None):
    catalog = set(PERMISOS_CATALOGO.keys())
    invalid_codes = [code for code in permission_codes if code not in catalog]
    if invalid_codes:
        raise ValueError(f"Permisos no validos: {', '.join(invalid_codes)}")

    resolved_tenant = _resolve_tenant(tenant)
    if resolved_tenant is None:
        raise ValueError("No se pudo resolver el tenant para actualizar el rol.")

    role_name = role_group.nombre if hasattr(role_group, "nombre") else str(role_group)
    role_name = normalizar_nombre_rol(role_name)
    role = TenantRole.objects.filter(tenant=resolved_tenant, nombre=role_name).first()
    if role is None:
        raise ValueError("El rol indicado no existe en este tenant.")

    role.permisos = sorted(set(permission_codes))
    role.save(update_fields=["permisos", "updated_at"])
    return role


def obtener_permisos_rol(role_name, tenant=None):
    normalized = normalizar_nombre_rol(role_name)
    if normalized in PERMISOS_ROL:
        return sorted(PERMISOS_ROL[normalized])

    resolved_tenant = _resolve_tenant(tenant)
    if resolved_tenant is None:
        return []

    role = TenantRole.objects.filter(tenant=resolved_tenant, nombre=normalized).first()
    if role is None:
        return []
    return sorted([perm for perm in role.permisos if perm in PERMISOS_CATALOGO])


def obtener_rol_usuario(user, tenant=None):
    if user.is_superuser:
        return ROLE_ADMIN

    resolved_tenant = _resolve_tenant(tenant)
    if resolved_tenant is not None:
        membership = TenantUser.objects.filter(tenant=resolved_tenant, user=user, is_active=True).first()
        if membership is not None:
            return membership.role

    if user.is_staff:
        return ROLE_FARMACEUTICO

    return ROLE_CLIENTE


def asignar_rol_usuario(user, role, tenant=None):
    role = normalizar_nombre_rol(role)

    resolved_tenant = _resolve_tenant(tenant)
    if resolved_tenant is not None:
        TenantUser.objects.update_or_create(
            tenant=resolved_tenant,
            user=user,
            defaults={"role": role, "is_active": True},
        )

    if role == ROLE_ADMIN:
        user.is_superuser = True
        user.is_staff = True
    elif role in {ROLE_FARMACEUTICO, ROLE_CAJERO}:
        user.is_superuser = False
        user.is_staff = True
    else:
        user.is_superuser = False
        user.is_staff = False


def obtener_permisos_usuario(user, tenant=None):
    role = obtener_rol_usuario(user, tenant=tenant)
    return obtener_permisos_rol(role, tenant=tenant)


def tiene_permiso(user, permission_code, tenant=None):
    if user.is_superuser:
        return True
    return permission_code in set(obtener_permisos_usuario(user, tenant=tenant))


def puede_acceder_backoffice(user, tenant=None):
    if user.is_superuser:
        return True
    return any(
        tiene_permiso(user, permission_code, tenant=tenant)
        for permission_code in [
            "usuarios.ver",
            "productos.ver",
            "inventario.ver",
            "pedidos.ver",
            "ventas.ver",
            "reportes.ver",
            "tratamientos.ver",
            "clientes.ver",
            "categorias.ver",
            "laboratorios.ver",
            "opiniones.ver",
            "publicidad.ver",
        ]
    )


def sincronizar_roles_usuarios_existentes(tenant=None):
    resolved_tenant = _resolve_tenant(tenant)
    if resolved_tenant is None:
        return

    user_model = get_user_model()
    for user in user_model.objects.all():
        if user.is_superuser:
            role = ROLE_ADMIN
        elif user.is_staff:
            role = ROLE_FARMACEUTICO
        else:
            role = ROLE_CLIENTE

        asignar_rol_usuario(user, role, tenant=resolved_tenant)
        user.save(update_fields=["is_superuser", "is_staff"])
