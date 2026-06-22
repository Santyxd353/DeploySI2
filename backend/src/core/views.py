from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.contrib.auth.tokens import default_token_generator
from django.db.models import Q
from django.conf import settings
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.dateparse import parse_datetime
from urllib.parse import urlparse, urlunparse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    AdminUserCreateSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    PermisoCatalogoSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    RolCreateUpdateSerializer,
    RolSerializer,
    UserSerializer,
    BitacoraSistemaSerializer,
)
from .audit import log_auth_event
from .models import BitacoraSistema
from .rbac import (
    ROLES_PROTEGIDOS,
    ROLE_ADMIN,
    ROLE_CLIENTE,
    ROLE_FARMACEUTICO,
    asignar_rol_usuario,
    crear_rol,
    obtener_catalogo_permisos,
    obtener_rol_usuario,
    obtener_roles_disponibles,
    obtener_permisos_rol,
    actualizar_permisos_rol,
    seed_roles_y_permisos,
    tiene_permiso,
)
from .security import (
    clear_failures_and_lock,
    consume_rate_limit,
    get_client_ip,
    is_locked,
    register_failure,
)
from .authentication import get_tenant_cookie_name
from tenants.models import TenantUser
from clientes.models import Cliente


def _build_frontend_auth_url(path, request=None):
    base_url = settings.SAAS_PUBLIC_BASE_URL
    parsed = urlparse(base_url)
    tenant = getattr(request, "tenant", None) if request is not None else None

    if tenant is not None and getattr(tenant, "schema_name", "public") != "public":
        root_domain = settings.SAAS_ROOT_DOMAIN or parsed.hostname or "localhost"
        scheme = parsed.scheme or "http"
        port = f":{parsed.port}" if parsed.port else ""
        netloc = f"{tenant.subdomain}.{root_domain}{port}"
        return urlunparse((scheme, netloc, path, "", "", ""))

    return urlunparse((parsed.scheme or "http", parsed.netloc, path, "", "", ""))


class AdminUsersPagination(PageNumberPagination):
    page_size = 8
    page_size_query_param = "page_size"
    max_page_size = 50


class AdminBitacoraPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def ensure_rbac_seeded_and_user_role(user=None):
    request_tenant = getattr(user, "_request_tenant", None) if user is not None else None

    seed_roles_y_permisos()

    if user is None:
        return

    if request_tenant is None:
        return

    if TenantUser.objects.filter(user=user, tenant=request_tenant, is_active=True).exists():
        return

    if user.is_superuser:
        asignar_rol_usuario(user, ROLE_ADMIN, tenant=request_tenant)
    elif user.is_staff:
        asignar_rol_usuario(user, ROLE_FARMACEUTICO, tenant=request_tenant)
    else:
        asignar_rol_usuario(user, ROLE_CLIENTE, tenant=request_tenant)

    user.save(update_fields=["is_superuser", "is_staff"])


def require_permission_response(user, permission_code, detail_message):
    tenant = getattr(user, "_request_tenant", None)
    if tiene_permiso(user, permission_code, tenant=tenant) or user.is_superuser:
        return None

    return Response({"detail": detail_message}, status=status.HTTP_403_FORBIDDEN)


def count_active_admin_users(tenant=None):
    if tenant is None:
        return get_user_model().objects.filter(is_superuser=True, is_active=True).count()
    return TenantUser.objects.filter(tenant=tenant, role=ROLE_ADMIN, is_active=True).count()


def set_auth_cookies(response, access_token=None, refresh_token=None, request=None):
    cookie_common_kwargs = {
        "httponly": True,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "path": "/",
    }

    access_cookie_name = get_tenant_cookie_name(settings.AUTH_ACCESS_COOKIE_NAME, request) if request else settings.AUTH_ACCESS_COOKIE_NAME
    refresh_cookie_name = get_tenant_cookie_name(settings.AUTH_REFRESH_COOKIE_NAME, request) if request else settings.AUTH_REFRESH_COOKIE_NAME

    if access_token:
        response.set_cookie(
            access_cookie_name,
            access_token,
            max_age=settings.AUTH_ACCESS_COOKIE_AGE,
            **cookie_common_kwargs,
        )

    if refresh_token:
        response.set_cookie(
            refresh_cookie_name,
            refresh_token,
            max_age=settings.AUTH_REFRESH_COOKIE_AGE,
            **cookie_common_kwargs,
        )


def clear_auth_cookies(response, request=None):
    access_cookie_name = get_tenant_cookie_name(settings.AUTH_ACCESS_COOKIE_NAME, request) if request else settings.AUTH_ACCESS_COOKIE_NAME
    refresh_cookie_name = get_tenant_cookie_name(settings.AUTH_REFRESH_COOKIE_NAME, request) if request else settings.AUTH_REFRESH_COOKIE_NAME
    response.delete_cookie(access_cookie_name, path="/")
    response.delete_cookie(refresh_cookie_name, path="/")
    response.delete_cookie(settings.AUTH_ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(settings.AUTH_REFRESH_COOKIE_NAME, path="/")


def auth_throttled_response():
    return Response(
        {"detail": "Demasiadas solicitudes. Intenta nuevamente en unos minutos."},
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def login_locked_response():
    return Response(
        {"detail": "Demasiados intentos de inicio de sesion. Espera unos minutos e intenta nuevamente."},
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def health(request):
    return JsonResponse({"status": "ok", "service": "backend"})


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    client_ip = get_client_ip(request)
    allowed = consume_rate_limit(
        scope="register",
        identifier=client_ip,
        limit=settings.AUTH_REGISTER_MAX_REQUESTS_PER_IP,
        window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SEC,
    )
    if not allowed:
        return auth_throttled_response()

    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()

    tenant = getattr(request, "tenant", None)
    if tenant is not None and getattr(tenant, "schema_name", "public") != "public":
        TenantUser.objects.update_or_create(
            tenant=tenant,
            user=user,
            defaults={"role": ROLE_CLIENTE, "is_active": True},
        )
        Cliente.objects.get_or_create(
            usuario=user,
            defaults={
                "tenant": tenant,
                "tipo": "registrado",
                "nombres": user.first_name,
                "apellidos": user.last_name,
                "email": user.email,
                "estado": True,
            },
        )

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    verify_url = f"{_build_frontend_auth_url('/verify-email', request=request)}?uid={uid}&token={token}"

    send_mail(
        subject="Verifica tu correo - Farmacia SaludPlus",
        message=(
            "Gracias por registrarte en Farmacia SaludPlus.\n\n"
            f"Confirma tu cuenta en el siguiente enlace: {verify_url}\n\n"
            "Si no creaste esta cuenta, ignora este mensaje."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )

    log_auth_event(request, "register", outcome="success", user_id=user.id, email=user.email)

    return Response(
        {
            "detail": "Registro completado. Revisa tu correo para activar tu cuenta.",
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    email = request.data.get("email", "")
    password = request.data.get("password", "")
    normalized_email = email.strip().lower()
    client_ip = get_client_ip(request)

    ip_allowed = consume_rate_limit(
        scope="login",
        identifier=client_ip,
        limit=settings.AUTH_LOGIN_MAX_REQUESTS_PER_IP,
        window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SEC,
    )
    if not ip_allowed:
        return auth_throttled_response()

    ip_scope = "login-ip"
    email_scope = "login-email"

    if is_locked(ip_scope, client_ip) or (normalized_email and is_locked(email_scope, normalized_email)):
        log_auth_event(request, "login", outcome="locked", email=normalized_email)
        return login_locked_response()

    user_model = get_user_model()
    user = user_model.objects.filter(email__iexact=normalized_email).first()

    if not user or not user.is_active or not user.check_password(password):
        register_failure(
            scope=ip_scope,
            identifier=client_ip,
            threshold=settings.AUTH_LOGIN_LOCK_THRESHOLD,
            base_lock_seconds=settings.AUTH_LOGIN_LOCK_BASE_SEC,
            max_lock_seconds=settings.AUTH_LOGIN_LOCK_MAX_SEC,
            failure_ttl_seconds=settings.AUTH_LOGIN_FAILURE_TTL_SEC,
        )

        if normalized_email:
            register_failure(
                scope=email_scope,
                identifier=normalized_email,
                threshold=settings.AUTH_LOGIN_LOCK_THRESHOLD,
                base_lock_seconds=settings.AUTH_LOGIN_LOCK_BASE_SEC,
                max_lock_seconds=settings.AUTH_LOGIN_LOCK_MAX_SEC,
                failure_ttl_seconds=settings.AUTH_LOGIN_FAILURE_TTL_SEC,
            )

        log_auth_event(request, "login", outcome="failure", email=normalized_email)
        return Response(
            {"detail": "Credenciales invalidas."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    clear_failures_and_lock(ip_scope, client_ip)
    if normalized_email:
        clear_failures_and_lock(email_scope, normalized_email)

    user._request_tenant = getattr(request, "tenant", None)
    ensure_rbac_seeded_and_user_role(user)

    update_last_login(None, user)
    log_auth_event(request, "login", outcome="success", user_id=user.id, email=user.email)

    refresh = RefreshToken.for_user(user)
    response = Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user, context={"request": request}).data,
        }
    )
    set_auth_cookies(response, access_token=str(refresh.access_token), refresh_token=str(refresh), request=request)
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_session(request):
    refresh_token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME) or request.data.get("refresh")
    if not refresh_token:
        log_auth_event(request, "refresh", outcome="failure", reason="missing-refresh-token")
        return Response({"detail": "Sesion no disponible para renovar."}, status=status.HTTP_401_UNAUTHORIZED)

    serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
    serializer.is_valid(raise_exception=True)

    access_token = serializer.validated_data.get("access")
    rotated_refresh_token = serializer.validated_data.get("refresh")

    response = Response(
        {
            "access": access_token,
            "refresh": rotated_refresh_token,
        }
    )
    set_auth_cookies(response, access_token=access_token, refresh_token=rotated_refresh_token, request=request)
    log_auth_event(request, "refresh", outcome="success")
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
def logout(request):
    response = Response({"detail": "Sesion cerrada correctamente."}, status=status.HTTP_200_OK)
    clear_auth_cookies(response, request=request)
    log_auth_event(request, "logout", outcome="success")
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_email(request):
    uid = request.data.get("uid", "")
    token = request.data.get("token", "")

    if not uid or not token:
        return Response({"detail": "Enlace de verificacion invalido."}, status=status.HTTP_400_BAD_REQUEST)

    user_model = get_user_model()
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = user_model.objects.get(pk=user_id)
    except (TypeError, ValueError, OverflowError, user_model.DoesNotExist):
        log_auth_event(request, "verify-email", outcome="failure", reason="invalid-uid")
        return Response({"detail": "Enlace de verificacion invalido."}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        log_auth_event(request, "verify-email", outcome="failure", user_id=user.id, reason="invalid-token")
        return Response({"detail": "El enlace de verificacion ha expirado o no es valido."}, status=status.HTTP_400_BAD_REQUEST)

    if not user.is_active:
        user.is_active = True
        user.save(update_fields=["is_active"])

    log_auth_event(request, "verify-email", outcome="success", user_id=user.id, email=user.email)
    return Response({"detail": "Correo verificado correctamente. Ya puedes iniciar sesion."}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    request.user._request_tenant = getattr(request, "tenant", None)
    ensure_rbac_seeded_and_user_role(request.user)
    return Response(UserSerializer(request.user, context={"request": request}).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admin_users_list(request):
    request.user._request_tenant = getattr(request, "tenant", None)
    if request.method == "GET":
        permission_denied = require_permission_response(
            request.user,
            "usuarios.ver",
            "No tienes permisos para ver usuarios.",
        )
        if permission_denied:
            return permission_denied

        user_model = get_user_model()
        users = user_model.objects.all().order_by("-date_joined")

        search = request.query_params.get("search", "").strip()
        role = request.query_params.get("role", "all").strip().lower()
        status_filter = request.query_params.get("status", "all").strip().lower()

        if search:
            users = users.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        if role != "all":
            tenant = getattr(request, "tenant", None)
            member_ids = TenantUser.objects.filter(tenant=tenant, role=role, is_active=True).values_list("user_id", flat=True)
            users = users.filter(id__in=member_ids)

        if status_filter == "active":
            users = users.filter(is_active=True)
        elif status_filter == "inactive":
            users = users.filter(is_active=False)

        paginator = AdminUsersPagination()
        paged_users = paginator.paginate_queryset(users, request)
        serializer = AdminUserSerializer(paged_users, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    permission_denied = require_permission_response(
        request.user,
        "usuarios.gestionar",
        "Solo administradores pueden crear usuarios desde el panel.",
    )
    if permission_denied:
        return permission_denied

    serializer = AdminUserCreateSerializer(data=request.data, context={"tenant": getattr(request, "tenant", None), "request": request})
    serializer.is_valid(raise_exception=True)
    created_user = serializer.save()
    
    from .audit import log_system_event
    log_system_event(
        request=request,
        accion="CREATE",
        modulo="usuarios",
        resultado="SUCCESS",
        mensaje=f"Usuario creado: {created_user.email} con rol {obtener_rol_usuario(created_user, tenant=getattr(request, 'tenant', None))}",
        entidad="User",
        entidad_id=str(created_user.id),
    )
    
    return Response(AdminUserSerializer(created_user, context={"request": request}).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_user_update(request, user_id):
    request.user._request_tenant = getattr(request, "tenant", None)
    permission_denied = require_permission_response(
        request.user,
        "usuarios.gestionar",
        "Solo administradores pueden editar roles y estado de usuarios.",
    )
    if permission_denied:
        return permission_denied

    user_model = get_user_model()
    try:
        target_user = user_model.objects.get(id=user_id)
    except user_model.DoesNotExist:
        return Response({"detail": "Usuario no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        if request.user.id == target_user.id:
            return Response({"detail": "No puedes eliminar tu propia cuenta."}, status=status.HTTP_400_BAD_REQUEST)

        if obtener_rol_usuario(target_user, tenant=getattr(request, "tenant", None)) == ROLE_ADMIN and target_user.is_active and count_active_admin_users(getattr(request, "tenant", None)) <= 1:
            return Response(
                {"detail": "No puedes eliminar el ultimo administrador activo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if target_user.is_active:
            target_user.is_active = False
            target_user.save(update_fields=["is_active"])

        from .audit import log_system_event
        log_system_event(
            request=request,
            accion="DELETE",
            modulo="usuarios",
            resultado="SUCCESS",
            mensaje=f"Usuario desactivado: {target_user.email}",
            entidad="User",
            entidad_id=str(target_user.id),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = AdminUserUpdateSerializer(
        target_user,
        data=request.data,
        partial=True,
        context={"request_user": request.user, "tenant": getattr(request, "tenant", None), "request": request},
    )
    serializer.is_valid(raise_exception=True)
    updated_user = serializer.save()

    from .audit import log_system_event
    cambios = []
    if "first_name" in request.data:
        cambios.append(f"nombre={request.data.get('first_name')}")
    if "last_name" in request.data:
        cambios.append(f"apellido={request.data.get('last_name')}")
    if "email" in request.data:
        cambios.append(f"email={request.data.get('email')}")
    if "role" in request.data:
        cambios.append(f"rol={request.data.get('role')}")
    if "is_active" in request.data:
        cambios.append(f"activo={request.data.get('is_active')}")
    
    log_system_event(
        request=request,
        accion="UPDATE",
        modulo="usuarios",
        resultado="SUCCESS",
        mensaje=f"Usuario actualizado: {updated_user.email} - Cambios: {', '.join(cambios) if cambios else 'N/A'}",
        entidad="User",
        entidad_id=str(updated_user.id),
    )

    return Response(AdminUserSerializer(updated_user, context={"request": request}).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admin_roles_list(request):
    request.user._request_tenant = getattr(request, "tenant", None)
    permission_denied = require_permission_response(
        request.user,
        "usuarios.gestionar",
        "No tienes permisos para gestionar roles.",
    )
    if permission_denied:
        return permission_denied

    ensure_rbac_seeded_and_user_role(request.user)

    if request.method == "GET":
        roles = obtener_roles_disponibles(tenant=getattr(request, "tenant", None))
        serializer = RolSerializer(roles, many=True, context={"request": request})
        return Response(serializer.data)

    serializer = RolCreateUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    role_name = serializer.validated_data["nombre"]
    role_permissions = serializer.validated_data.get("permisos", [])

    try:
        role_group = crear_rol(role_name, role_permissions, tenant=getattr(request, "tenant", None))
    except ValueError as ex:
        return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    from .audit import log_system_event
    log_system_event(
        request=request,
        accion="CREATE",
        modulo="roles",
        resultado="SUCCESS",
        mensaje=f"Rol creado: {role_name} con {len(role_permissions)} permisos",
        entidad="Group",
        entidad_id=str(getattr(role_group, "id", "")),
    )

    return Response(RolSerializer(role_group.nombre, context={"request": request}).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_role_detail(request, role_name):
    request.user._request_tenant = getattr(request, "tenant", None)
    permission_denied = require_permission_response(
        request.user,
        "usuarios.gestionar",
        "No tienes permisos para gestionar roles.",
    )
    if permission_denied:
        return permission_denied

    normalized_role_name = role_name.strip().lower()

    tenant = getattr(request, "tenant", None)
    available_roles = set(obtener_roles_disponibles(tenant=tenant))
    if normalized_role_name not in available_roles:
        return Response({"detail": "Rol no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        if normalized_role_name in ROLES_PROTEGIDOS:
            return Response({"detail": "No se puede eliminar un rol protegido."}, status=status.HTTP_400_BAD_REQUEST)

        if TenantUser.objects.filter(tenant=tenant, role=normalized_role_name, is_active=True).exists():
            return Response(
                {"detail": "No se puede eliminar el rol porque tiene usuarios asignados."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from tenants.models import TenantRole

        role_obj = TenantRole.objects.filter(tenant=tenant, nombre=normalized_role_name).first()
        role_id = role_obj.id if role_obj else ""
        if role_obj:
            role_obj.delete()
        
        from .audit import log_system_event
        log_system_event(
            request=request,
            accion="DELETE",
            modulo="roles",
            resultado="SUCCESS",
            mensaje=f"Rol eliminado: {normalized_role_name}",
            entidad="Group",
            entidad_id=str(role_id),
        )
        
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = RolCreateUpdateSerializer(data={"nombre": normalized_role_name, "permisos": request.data.get("permisos", [])})
    serializer.is_valid(raise_exception=True)

    role_permissions = serializer.validated_data.get("permisos", [])
    try:
        actualizar_permisos_rol(normalized_role_name, role_permissions, tenant=tenant)
    except ValueError as ex:
        return Response({"detail": str(ex)}, status=status.HTTP_400_BAD_REQUEST)

    from .audit import log_system_event
    log_system_event(
        request=request,
        accion="UPDATE",
        modulo="roles",
        resultado="SUCCESS",
        mensaje=f"Permisos actualizados para rol: {normalized_role_name} - {len(role_permissions)} permisos asignados",
        entidad="Group",
        entidad_id=normalized_role_name,
    )

    return Response({"nombre": normalized_role_name, "permisos": obtener_permisos_rol(normalized_role_name, tenant=tenant)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_permisos_catalogo(request):
    permission_denied = require_permission_response(
        request.user,
        "usuarios.gestionar",
        "No tienes permisos para ver el catalogo de permisos.",
    )
    if permission_denied:
        return permission_denied

    serializer = PermisoCatalogoSerializer(obtener_catalogo_permisos(), many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_bitacora_list(request):
    permission_denied = require_permission_response(
        request.user,
        "usuarios.gestionar",
        "No tienes permisos para ver la bitacora del sistema.",
    )
    if permission_denied:
        return permission_denied

    queryset = BitacoraSistema.objects.select_related("usuario").exclude(accion__iexact="REFRESH")

    accion = request.query_params.get("accion", "").strip()
    modulo = request.query_params.get("modulo", "").strip()
    resultado = request.query_params.get("resultado", "").strip()
    usuario_id = request.query_params.get("usuario_id", "").strip()
    fecha_desde = request.query_params.get("fecha_desde", "").strip()
    fecha_hasta = request.query_params.get("fecha_hasta", "").strip()

    if accion:
        queryset = queryset.filter(accion__iexact=accion)
    if modulo:
        queryset = queryset.filter(modulo__iexact=modulo)
    if resultado:
        queryset = queryset.filter(resultado__iexact=resultado)
    if usuario_id.isdigit():
        queryset = queryset.filter(usuario_id=int(usuario_id))

    if fecha_desde:
        parsed = parse_datetime(fecha_desde)
        if parsed:
            queryset = queryset.filter(fecha_hora__gte=parsed)

    if fecha_hasta:
        parsed = parse_datetime(fecha_hasta)
        if parsed:
            queryset = queryset.filter(fecha_hora__lte=parsed)

    paginator = AdminBitacoraPagination()
    paged_events = paginator.paginate_queryset(queryset, request)
    serializer = BitacoraSistemaSerializer(paged_events, many=True)
    return paginator.get_paginated_response(serializer.data)


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request(request):
    client_ip = get_client_ip(request)
    allowed = consume_rate_limit(
        scope="password-reset-request",
        identifier=client_ip,
        limit=settings.AUTH_RESET_MAX_REQUESTS_PER_IP,
        window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SEC,
    )
    if not allowed:
        return auth_throttled_response()

    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    user_model = get_user_model()
    user = user_model.objects.filter(email__iexact=email, is_active=True).first()

    if user:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_url = f"{_build_frontend_auth_url('/reset-password', request=request)}?uid={uid}&token={token}"

        send_mail(
            subject="Recuperacion de contrasena - Farmacia SaludPlus",
            message=(
                "Recibimos una solicitud para restablecer tu contrasena.\n\n"
                f"Ingresa al siguiente enlace: {reset_url}\n\n"
                "Si no solicitaste este cambio, ignora este mensaje."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )

    log_auth_event(request, "password-reset-request", outcome="accepted", email=email)

    return Response(
        {
            "detail": "Si el correo existe, te enviaremos un enlace para restablecer tu contrasena.",
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    uid = serializer.validated_data["uid"]
    token = serializer.validated_data["token"]
    password = serializer.validated_data["password"]

    user_model = get_user_model()
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = user_model.objects.get(pk=user_id)
    except (TypeError, ValueError, OverflowError, user_model.DoesNotExist):
        log_auth_event(request, "password-reset-confirm", outcome="failure", reason="invalid-uid")
        return Response({"detail": "Enlace de recuperacion invalido."}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        log_auth_event(request, "password-reset-confirm", outcome="failure", user_id=user.id, reason="invalid-token")
        return Response({"detail": "El enlace ha expirado o no es valido."}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(password)
    user.save(update_fields=["password"])
    log_auth_event(request, "password-reset-confirm", outcome="success", user_id=user.id)

    return Response({"detail": "Contrasena actualizada correctamente."}, status=status.HTTP_200_OK)
