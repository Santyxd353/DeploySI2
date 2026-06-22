from django.urls import path

from .views import (
    admin_bitacora_list,
    admin_permisos_catalogo,
    admin_role_detail,
    admin_roles_list,
    admin_user_update,
    admin_users_list,
    health,
    login,
    logout,
    me,
    password_reset_confirm,
    password_reset_request,
    refresh_session,
    register,
    verify_email,
)
from .kpis_views import global_kpis, tenant_kpis, tenant_kpis_detalle

urlpatterns = [
    path("health/", health, name="health"),
    path("auth/register/", register, name="register"),
    path("auth/verify-email/", verify_email, name="verify-email"),
    path("auth/login/", login, name="login"),
    path("auth/refresh/", refresh_session, name="refresh-session"),
    path("auth/logout/", logout, name="logout"),
    path("auth/me/", me, name="me"),
    path("auth/password-reset/request/", password_reset_request, name="password-reset-request"),
    path("auth/password-reset/confirm/", password_reset_confirm, name="password-reset-confirm"),
    path("admin/users/", admin_users_list, name="admin-users-list"),
    path("admin/users/<int:user_id>/", admin_user_update, name="admin-user-update"),
    path("admin/roles/", admin_roles_list, name="admin-roles-list"),
    path("admin/roles/<str:role_name>/", admin_role_detail, name="admin-role-detail"),
    path("admin/permisos/", admin_permisos_catalogo, name="admin-permisos-catalogo"),
    path("admin/bitacora/", admin_bitacora_list, name="admin-bitacora-list"),
    path("admin/kpis/", tenant_kpis, name="tenant-kpis"),
    path("admin/kpis/detalle/", tenant_kpis_detalle, name="tenant-kpis-detalle"),
    path("global/kpis/", global_kpis, name="global-kpis"),
]
