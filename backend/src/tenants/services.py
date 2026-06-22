from datetime import timedelta

import stripe
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import Domain, Plan, Suscripcion, Tenant, TenantUser


DEFAULT_PLANS = [
    {
        "nombre": "Gratuito",
        "slug": "gratuito",
        "precio_mensual": "0",
        "precio_anual": "0",
        "limite_usuarios": 3,
        "limite_productos": 250,
        "limite_inventario_items": 1200,
        "limite_almacenamiento_mb": 256,
        "permite_reportes_ia": False,
        "permite_backups": False,
        "permite_predicciones": False,
    },
    {
        "nombre": "Basico",
        "slug": "basico",
        "precio_mensual": "19",
        "precio_anual": "190",
        "limite_usuarios": 10,
        "limite_productos": 3000,
        "limite_inventario_items": 15000,
        "limite_almacenamiento_mb": 2048,
        "permite_reportes_ia": True,
        "permite_backups": True,
        "permite_predicciones": True,
    },
    {
        "nombre": "Profesional",
        "slug": "profesional",
        "precio_mensual": "49",
        "precio_anual": "490",
        "limite_usuarios": 30,
        "limite_productos": 20000,
        "limite_inventario_items": 100000,
        "limite_almacenamiento_mb": 10240,
        "permite_reportes_ia": True,
        "permite_backups": True,
        "permite_predicciones": True,
    },
    {
        "nombre": "Enterprise",
        "slug": "enterprise",
        "precio_mensual": "149",
        "precio_anual": "1490",
        "limite_usuarios": 500,
        "limite_productos": 500000,
        "limite_inventario_items": 1000000,
        "limite_almacenamiento_mb": 102400,
        "permite_reportes_ia": True,
        "permite_backups": True,
        "permite_predicciones": True,
    },
]


def ensure_default_plans():
    for payload in DEFAULT_PLANS:
        Plan.objects.update_or_create(slug=payload["slug"], defaults=payload)


@transaction.atomic
def create_tenant_with_admin(*, nombre_farmacia, subdominio, email_admin, password, telefono="", direccion=""):
    ensure_default_plans()
    plan = Plan.objects.get(slug="gratuito")

    schema_name = subdominio.replace("-", "_")

    tenant = Tenant.objects.create(
        schema_name=schema_name,
        name=nombre_farmacia,
        subdomain=subdominio,
        contact_email=email_admin,
        phone=telefono,
        address=direccion,
        trial_start_at=timezone.now(),
        trial_end_at=timezone.now() + timedelta(days=14),
        status="activo",
    )

    root_domain = getattr(settings, "SAAS_ROOT_DOMAIN", "localhost")
    Domain.objects.create(
        tenant=tenant,
        domain=f"{subdominio}.{root_domain}",
        is_primary=True,
        is_custom=False,
    )

    user_model = get_user_model()
    user = user_model.objects.filter(email__iexact=email_admin).first()
    if user is None:
        username = (email_admin.split("@")[0] or "admin").replace(" ", "")[:150]
        base_username = username or "admin"
        seq = 1
        while user_model.objects.filter(username=username).exists():
            username = f"{base_username}{seq}"
            seq += 1

        user = user_model.objects.create_user(
            username=username,
            email=email_admin,
            password=password,
            first_name="Administrador",
            last_name=nombre_farmacia[:100],
            is_active=True,
        )
    else:
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])

    TenantUser.objects.update_or_create(
        tenant=tenant,
        user=user,
        defaults={"role": "admin", "is_active": True},
    )

    Suscripcion.objects.create(
        tenant=tenant,
        plan=plan,
        fecha_inicio=timezone.now(),
        fecha_fin=timezone.now() + timedelta(days=14),
        auto_renovar=False,
        estado="trialing",
    )

    return tenant, user


def _obtener_o_crear_stripe_price(plan, billing_cycle):
    """
    Devuelve el stripe_price_id para el ciclo dado.
    Si no está configurado, lo crea dinámicamente en Stripe (útil en modo prueba)
    y lo persiste en el Plan para reutilizarlo.
    """
    price_id = plan.stripe_price_id_mensual if billing_cycle == "monthly" else plan.stripe_price_id_anual

    if price_id:
        return price_id

    amount = plan.precio_mensual if billing_cycle == "monthly" else plan.precio_anual
    amount_cents = int(round(float(amount) * 100))
    if amount_cents <= 0:
        raise ValueError(f"El plan '{plan.nombre}' no tiene precio configurado para ciclo '{billing_cycle}'.")

    interval = "month" if billing_cycle == "monthly" else "year"
    currency = getattr(settings, "STRIPE_CURRENCY", "usd").lower()

    price = stripe.Price.create(
        unit_amount=amount_cents,
        currency=currency,
        recurring={"interval": interval},
        product_data={"name": f"{plan.nombre} — {billing_cycle}"},
    )

    # Guardar para no recrear en el próximo checkout
    if billing_cycle == "monthly":
        plan.stripe_price_id_mensual = price.id
        plan.save(update_fields=["stripe_price_id_mensual"])
    else:
        plan.stripe_price_id_anual = price.id
        plan.save(update_fields=["stripe_price_id_anual"])

    return price.id


def create_subscription_checkout_session(*, tenant, plan, billing_cycle="monthly", success_url=None, cancel_url=None):
    stripe.api_key = settings.STRIPE_SECRET_KEY

    price_id = _obtener_o_crear_stripe_price(plan, billing_cycle)

    success_url = success_url or getattr(
        settings, "SAAS_BILLING_SUCCESS_URL",
        "http://localhost:5173/admin/suscripcion?status=ok"
    )
    cancel_url = cancel_url or getattr(
        settings, "SAAS_BILLING_CANCEL_URL",
        "http://localhost:5173/admin/suscripcion?status=cancel"
    )

    session = stripe.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "tenant_id": str(tenant.id),
            "plan_id": str(plan.id),
            "billing_cycle": billing_cycle,
        },
    )

    return session


def create_billing_portal_session(*, customer_id, return_url=None):
    """Crea una sesión del portal de facturación de Stripe para gestionar tarjetas/facturas."""
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return_url = return_url or "http://localhost:5173/admin/suscripcion"

    return stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
