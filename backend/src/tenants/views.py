import stripe
from datetime import datetime, timedelta, timezone as dt_timezone
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
from .services import create_billing_portal_session, create_subscription_checkout_session, create_tenant_with_admin


def _calcular_fecha_fin(subscription_id, billing_cycle="monthly"):
    """
    Calcula fecha_fin de la suscripción.
    Prioridad 1: obtener current_period_end directamente de Stripe (más preciso).
    Prioridad 2: calcular manualmente basado en billing_cycle.
    """
    if subscription_id:
        try:
            stripe.api_key = settings.STRIPE_SECRET_KEY
            stripe_sub = stripe.Subscription.retrieve(subscription_id)
            period_end = getattr(stripe_sub, "current_period_end", None)
            if period_end:
                return datetime.fromtimestamp(period_end, tz=dt_timezone.utc)
        except Exception:
            pass

    # Fallback: calcular desde ahora según ciclo de facturación
    now = timezone.now()
    if billing_cycle == "annual":
        return now + timedelta(days=365)
    return now + timedelta(days=30)


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

    # El frontend envía su origen para que las URLs de retorno sean dinámicas
    frontend_origin = request.data.get("frontend_origin", "").rstrip("/")
    if not frontend_origin:
        frontend_origin = getattr(settings, "SAAS_PUBLIC_BASE_URL", "http://localhost:5173")

    # {CHECKOUT_SESSION_ID} es reemplazado por Stripe automáticamente al redirigir
    success_url = f"{frontend_origin}/admin/suscripcion?status=ok&sid={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{frontend_origin}/admin/suscripcion?status=cancel"

    try:
        session = create_subscription_checkout_session(
            tenant=tenant,
            plan=plan,
            billing_cycle=billing_cycle,
            success_url=success_url,
            cancel_url=cancel_url,
        )
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
        # event_obj es un dict en el webhook (no StripeObject)
        metadata = event_obj.get("metadata", {}) or {}
        tenant_id = metadata.get("tenant_id")
        plan_id = metadata.get("plan_id")
        billing_cycle = metadata.get("billing_cycle", "monthly")
        tenant = Tenant.objects.filter(id=tenant_id).first()
        plan = Plan.objects.filter(id=plan_id).first()
        if tenant and plan:
            from django.db import transaction
            subscription_id = event_obj.get("subscription", "") or ""
            customer_id = event_obj.get("customer", "") or ""
            fecha_fin = _calcular_fecha_fin(subscription_id, billing_cycle)

            with transaction.atomic():
                if subscription_id:
                    Suscripcion.objects.get_or_create(
                        stripe_subscription_id=subscription_id,
                        defaults={
                            "tenant": tenant, "plan": plan, "estado": "active",
                            "fecha_inicio": timezone.now(), "fecha_fin": fecha_fin,
                            "auto_renovar": True, "stripe_customer_id": customer_id,
                        },
                    )
                else:
                    Suscripcion.objects.create(
                        tenant=tenant, plan=plan, estado="active",
                        fecha_inicio=timezone.now(), fecha_fin=fecha_fin,
                        auto_renovar=True, stripe_customer_id=customer_id,
                    )
            tenant.status = "activo"
            tenant.paid_start_at = tenant.paid_start_at or timezone.now()
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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verificar_sesion_checkout(request):
    """
    Verifica directamente con Stripe que la sesión de checkout fue pagada
    y crea/actualiza la suscripción sin depender del webhook.
    Útil en entornos locales donde Stripe no puede alcanzar el backend.
    """
    session_id = request.data.get("session_id", "").strip()
    if not session_id:
        return Response({"detail": "session_id requerido."}, status=status.HTTP_400_BAD_REQUEST)

    tenant = getattr(request, "tenant", None)
    if not tenant or tenant.schema_name == "public":
        return Response({"detail": "Solo desde un tenant."}, status=status.HTTP_400_BAD_REQUEST)

    stripe.api_key = settings.STRIPE_SECRET_KEY
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as exc:
        return Response({"detail": f"No se pudo verificar la sesión: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

    if session.payment_status != "paid":
        return Response({"detail": "El pago no fue completado."}, status=status.HTTP_400_BAD_REQUEST)

    # StripeObject no tiene .get() — accedemos via atributo
    metadata = session.metadata
    plan_id = getattr(metadata, "plan_id", None) if metadata else None
    billing_cycle = getattr(metadata, "billing_cycle", "monthly") if metadata else "monthly"

    plan = Plan.objects.filter(id=plan_id).first()
    if not plan:
        return Response({"detail": "Plan de la sesión no encontrado."}, status=status.HTTP_400_BAD_REQUEST)

    customer_id = session.customer or ""
    subscription_id = session.subscription or ""

    # Calcular fecha_fin: primero desde Stripe, luego fallback manual
    fecha_fin = _calcular_fecha_fin(subscription_id, billing_cycle)

    # get_or_create atómico evita duplicados aunque lleguen dos requests simultáneos
    # (React Strict Mode doble llamada + webhook en producción)
    from django.db import transaction
    with transaction.atomic():
        if subscription_id:
            sub, created = Suscripcion.objects.get_or_create(
                stripe_subscription_id=subscription_id,
                defaults={
                    "tenant": tenant,
                    "plan": plan,
                    "estado": "active",
                    "fecha_inicio": timezone.now(),
                    "fecha_fin": fecha_fin,
                    "auto_renovar": True,
                    "stripe_customer_id": customer_id,
                },
            )
            if not created:
                # Ya existía (webhook llegó antes) — solo actualizamos plan y fecha
                sub.plan = plan
                sub.fecha_fin = fecha_fin
                sub.estado = "active"
                sub.stripe_customer_id = sub.stripe_customer_id or customer_id
                sub.save(update_fields=["plan", "fecha_fin", "estado", "stripe_customer_id", "updated_at"])
        else:
            # Sin subscription_id (poco común): crear solo si no hay otra reciente
            from datetime import timedelta
            reciente = timezone.now() - timedelta(minutes=5)
            sub = Suscripcion.objects.filter(
                tenant=tenant, plan=plan, created_at__gte=reciente
            ).first()
            if not sub:
                sub = Suscripcion.objects.create(
                    tenant=tenant, plan=plan, estado="active",
                    fecha_inicio=timezone.now(), fecha_fin=fecha_fin,
                    auto_renovar=True, stripe_customer_id=customer_id,
                )

    tenant.status = "activo"
    tenant.paid_start_at = tenant.paid_start_at or timezone.now()
    tenant.save(update_fields=["status", "paid_start_at", "updated_at"])

    sub.refresh_from_db()
    return Response(SuscripcionSerializer(sub).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tenant_billing_portal(request):
    """Crea sesión del portal de Stripe para gestionar tarjeta y facturas."""
    tenant = getattr(request, "tenant", None)
    if tenant is None or tenant.schema_name == "public":
        return Response({"detail": "Solo desde un tenant."}, status=status.HTTP_400_BAD_REQUEST)

    role = (
        TenantUser.objects.filter(tenant=tenant, user=request.user, is_active=True)
        .values_list("role", flat=True)
        .first()
    )
    if role != "admin" and not request.user.is_superuser:
        return Response({"detail": "Solo admin del tenant puede acceder al portal."}, status=status.HTTP_403_FORBIDDEN)

    sub = Suscripcion.objects.filter(tenant=tenant, stripe_customer_id__gt="").order_by("-created_at").first()
    if not sub:
        return Response({"detail": "No hay datos de facturación registrados aún."}, status=status.HTTP_404_NOT_FOUND)

    frontend_origin = request.data.get("frontend_origin", "").rstrip("/")
    if not frontend_origin:
        frontend_origin = getattr(settings, "SAAS_PUBLIC_BASE_URL", "http://localhost:5173")
    return_url = f"{frontend_origin}/admin/suscripcion"

    try:
        session = create_billing_portal_session(
            customer_id=sub.stripe_customer_id,
            return_url=return_url,
        )
        return Response({"portal_url": session.url})
    except Exception as exc:
        return Response({"detail": f"No se pudo abrir el portal: {exc}"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def global_superadmin_tenants(request):
    if not request.user.is_superuser:
        return Response({"detail": "Solo superadmin global."}, status=status.HTTP_403_FORBIDDEN)

    tenants = Tenant.objects.prefetch_related(
        "suscripciones__plan"
    ).order_by("-created_at")

    data = []
    for t in tenants:
        t_data = TenantSerializer(t).data

        # Adjuntar suscripción vigente (activa, trial o past_due) o la más reciente
        sub = (
            t.suscripciones.filter(estado__in=["active", "trialing", "past_due"])
            .order_by("-created_at")
            .first()
        ) or t.suscripciones.order_by("-created_at").first()

        if sub:
            t_data["suscripcion"] = {
                "id": sub.id,
                "estado": sub.estado,
                "plan_nombre": sub.plan.nombre,
                "plan_slug": sub.plan.slug,
                "precio_mensual": float(sub.plan.precio_mensual),
                "fecha_inicio": sub.fecha_inicio.isoformat() if sub.fecha_inicio else None,
                "fecha_fin": sub.fecha_fin.isoformat() if sub.fecha_fin else None,
                "auto_renovar": sub.auto_renovar,
            }
        else:
            t_data["suscripcion"] = None

        data.append(t_data)

    return Response(data)


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
