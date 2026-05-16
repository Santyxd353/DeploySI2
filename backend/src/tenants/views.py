import stripe
from django.conf import settings
from django.contrib.auth import authenticate
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.serializers import UserSerializer
from core.views import set_auth_cookies
from .models import Plan, Suscripcion, Tenant, TenantUser
from .serializers import (
    GlobalLoginSerializer,
    PlanSerializer,
    SuscripcionSerializer,
    TenantRegisterSerializer,
    TenantSerializer,
)
from .services import create_subscription_checkout_session, create_tenant_with_admin


@api_view(["GET"])
@permission_classes([AllowAny])
def public_plan_list(request):
    plans = Plan.objects.filter(activo=True).order_by("precio_mensual")
    return Response(PlanSerializer(plans, many=True).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def register_tenant(request):
    serializer = TenantRegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    tenant, admin_user = create_tenant_with_admin(
        nombre_farmacia=serializer.validated_data["nombre_farmacia"],
        subdominio=serializer.validated_data["subdominio"],
        email_admin=serializer.validated_data["email_admin"],
        password=serializer.validated_data["password"],
        telefono=serializer.validated_data.get("telefono", ""),
        direccion=serializer.validated_data.get("direccion", ""),
    )

    return Response(
        {
            "detail": "Farmacia registrada correctamente.",
            "tenant": TenantSerializer(tenant).data,
            "admin_user_id": admin_user.id,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def global_login(request):
    serializer = GlobalLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"].strip().lower()
    password = serializer.validated_data["password"]
    subdominio = serializer.validated_data.get("subdominio", "").strip().lower()

    user = authenticate(request, username=email, password=password)
    if user is None:
        # Fallback por email cuando AUTH_USER_MODEL usa username.
        from django.contrib.auth import get_user_model

        user_model = get_user_model()
        user_obj = user_model.objects.filter(email__iexact=email).first()
        if user_obj and user_obj.check_password(password):
            user = user_obj

    if user is None:
        return Response({"detail": "Credenciales invalidas."}, status=status.HTTP_401_UNAUTHORIZED)

    memberships = TenantUser.objects.select_related("tenant").filter(user=user, is_active=True, tenant__status="activo")
    if subdominio:
        memberships = memberships.filter(tenant__subdomain=subdominio)

    membership = memberships.order_by("-joined_at").first()

    # Si el superadmin entra desde el login global sin subdominio,
    # debe quedarse en el panel global aunque tenga membresias tenant.
    if user.is_superuser and not subdominio:
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user, context={"request": request}).data,
                "tenant": None,
                "global": {
                    "is_superadmin": True,
                    "dashboard_path": "/admin/global/tenants",
                },
            }
        )
        set_auth_cookies(response, access_token=str(refresh.access_token), refresh_token=str(refresh), request=request)
        return response

    if membership is None:
        return Response({"detail": "El usuario no pertenece a un tenant activo."}, status=status.HTTP_403_FORBIDDEN)

    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)

    response = Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user, context={"request": request, "tenant": membership.tenant}).data,
            "tenant": {
                "id": membership.tenant_id,
                "name": membership.tenant.name,
                "subdomain": membership.tenant.subdomain,
                "schema_name": membership.tenant.schema_name,
                "role": membership.role,
                "dashboard_path": "/admin" if membership.role in {"admin", "farmaceutico"} else "/",
            },
        }
    )
    set_auth_cookies(response, access_token=str(refresh.access_token), refresh_token=str(refresh), request=request)
    return response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tenant_checkout_subscription(request):
    tenant = getattr(request, "tenant", None)
    if tenant is None or tenant.schema_name == "public":
        return Response({"detail": "Operacion valida solo desde un tenant."}, status=status.HTTP_400_BAD_REQUEST)

    role = (
        TenantUser.objects.filter(tenant=tenant, user=request.user, is_active=True)
        .values_list("role", flat=True)
        .first()
    )
    if role != "admin" and not request.user.is_superuser:
        return Response({"detail": "Solo admin del tenant puede cambiar plan."}, status=status.HTTP_403_FORBIDDEN)

    plan_slug = request.data.get("plan_slug", "")
    billing_cycle = request.data.get("billing_cycle", "monthly")
    plan = Plan.objects.filter(slug=plan_slug, activo=True).first()
    if plan is None:
        return Response({"detail": "Plan no valido."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        session = create_subscription_checkout_session(tenant=tenant, plan=plan, billing_cycle=billing_cycle)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"checkout_url": session.url, "session_id": session.id})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_tenant_subscription(request):
    tenant = getattr(request, "tenant", None)
    if tenant is None or tenant.schema_name == "public":
        return Response({"detail": "Operacion valida solo dentro de tenant."}, status=status.HTTP_400_BAD_REQUEST)

    suscripcion = (
        Suscripcion.objects.select_related("plan", "tenant")
        .filter(tenant=tenant)
        .order_by("-created_at")
        .first()
    )
    if suscripcion is None:
        return Response({"detail": "No hay suscripcion registrada."}, status=status.HTTP_404_NOT_FOUND)

    return Response(SuscripcionSerializer(suscripcion).data)


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_subscription_webhook(request):
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=settings.STRIPE_WEBHOOK_SECRET,
        )
    except Exception:
        return Response({"detail": "Webhook invalido."}, status=status.HTTP_400_BAD_REQUEST)

    event_type = event.get("type", "")
    event_obj = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        metadata = event_obj.get("metadata", {})
        tenant_id = metadata.get("tenant_id")
        plan_id = metadata.get("plan_id")
        tenant = Tenant.objects.filter(id=tenant_id).first()
        plan = Plan.objects.filter(id=plan_id).first()
        if tenant and plan:
            Suscripcion.objects.create(
                tenant=tenant,
                plan=plan,
                estado="active",
                fecha_inicio=timezone.now(),
                auto_renovar=True,
                stripe_customer_id=event_obj.get("customer", ""),
                stripe_subscription_id=event_obj.get("subscription", ""),
            )
            tenant.status = "activo"
            tenant.paid_start_at = timezone.now()
            tenant.save(update_fields=["status", "paid_start_at", "updated_at"])

    elif event_type == "invoice.payment_failed":
        subscription_id = event_obj.get("subscription", "")
        sub = Suscripcion.objects.filter(stripe_subscription_id=subscription_id).order_by("-created_at").first()
        if sub:
            sub.estado = "past_due"
            sub.save(update_fields=["estado", "updated_at"])
            tenant = sub.tenant
            tenant.status = "suspendido"
            tenant.save(update_fields=["status", "updated_at"])

    elif event_type == "customer.subscription.deleted":
        subscription_id = event_obj.get("id", "")
        sub = Suscripcion.objects.filter(stripe_subscription_id=subscription_id).order_by("-created_at").first()
        if sub:
            sub.estado = "canceled"
            sub.auto_renovar = False
            sub.save(update_fields=["estado", "auto_renovar", "updated_at"])
            tenant = sub.tenant
            tenant.status = "cancelado"
            tenant.save(update_fields=["status", "updated_at"])

    elif event_type == "invoice.payment_succeeded":
        subscription_id = event_obj.get("subscription", "")
        sub = Suscripcion.objects.filter(stripe_subscription_id=subscription_id).order_by("-created_at").first()
        if sub:
            sub.estado = "active"
            sub.save(update_fields=["estado", "updated_at"])
            tenant = sub.tenant
            tenant.status = "activo"
            tenant.save(update_fields=["status", "updated_at"])

    return Response({"received": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def global_superadmin_tenants(request):
    if not request.user.is_superuser:
        return Response({"detail": "Solo superadmin global."}, status=status.HTTP_403_FORBIDDEN)

    tenants = Tenant.objects.order_by("-created_at")
    return Response(TenantSerializer(tenants, many=True).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def global_superadmin_toggle_tenant(request, tenant_id):
    if not request.user.is_superuser:
        return Response({"detail": "Solo superadmin global."}, status=status.HTTP_403_FORBIDDEN)

    tenant = Tenant.objects.filter(id=tenant_id).first()
    if tenant is None:
        return Response({"detail": "Tenant no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get("status", "").strip().lower()
    if new_status not in {"activo", "suspendido", "cancelado"}:
        return Response({"detail": "Estado invalido."}, status=status.HTTP_400_BAD_REQUEST)

    tenant.status = new_status
    tenant.save(update_fields=["status", "updated_at"])
    return Response(TenantSerializer(tenant).data)
