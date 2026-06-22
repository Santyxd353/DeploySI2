from django.urls import path

from .views import (
    current_tenant_subscription,
    global_login,
    global_superadmin_tenants,
    global_superadmin_toggle_tenant,
    public_plan_list,
    register_tenant,
    stripe_subscription_webhook,
    tenant_billing_portal,
    tenant_checkout_subscription,
    verificar_sesion_checkout,
)
from core.kpis_views import global_kpis

urlpatterns = [
    path("public/plans/", public_plan_list, name="public-plans"),
    path("public/register-tenant/", register_tenant, name="public-register-tenant"),
    path("public/login/", global_login, name="public-global-login"),

    path("billing/checkout/", tenant_checkout_subscription, name="tenant-billing-checkout"),
    path("billing/current/", current_tenant_subscription, name="tenant-billing-current"),
    path("billing/verificar/", verificar_sesion_checkout, name="tenant-billing-verificar"),
    path("billing/portal/", tenant_billing_portal, name="tenant-billing-portal"),
    path("billing/webhook/stripe/", stripe_subscription_webhook, name="billing-webhook-stripe"),

    path("global/tenants/", global_superadmin_tenants, name="global-superadmin-tenants"),
    path("global/tenants/<int:tenant_id>/status/", global_superadmin_toggle_tenant, name="global-superadmin-tenant-status"),
    path("global/kpis/", global_kpis, name="global-kpis"),
]
