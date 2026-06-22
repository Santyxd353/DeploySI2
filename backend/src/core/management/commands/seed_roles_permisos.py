from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

from core.rbac import seed_roles_y_permisos, sincronizar_roles_usuarios_existentes
from tenants.context import clear_current_tenant, set_current_tenant
from tenants.models import Tenant


class Command(BaseCommand):
    help = "Crea permisos semilla en español y grupos base de roles para farmacia."

    def add_arguments(self, parser):
        parser.add_argument(
            "--schema",
            type=str,
            help="Schema del tenant donde se ejecutara el seed (ej: farmacia1)",
        )
        parser.add_argument(
            "--all-tenants",
            action="store_true",
            help="Ejecuta el seed en todos los tenants activos.",
        )
        parser.add_argument(
            "--sincronizar-usuarios",
            action="store_true",
            help="Asigna rol inicial a usuarios existentes segun su estado actual.",
        )

    def _resolve_tenants(self, schema_name=None, all_tenants=False):
        if schema_name and all_tenants:
            raise ValueError("No uses --schema y --all-tenants al mismo tiempo.")

        if schema_name:
            tenant = Tenant.objects.filter(schema_name=schema_name).first()
            if tenant is None:
                raise ValueError(f"No existe tenant con schema '{schema_name}'.")
            return [tenant]

        if all_tenants:
            return list(Tenant.objects.filter(status="activo").exclude(schema_name="public").order_by("id"))

        raise ValueError("Debes indicar --schema o --all-tenants para ejecutar este seed.")

    def _run_for_tenant(self, tenant, sync_users=False):
        with schema_context(tenant.schema_name):
            set_current_tenant(tenant)
            try:
                seed_roles_y_permisos()
                self.stdout.write(self.style.SUCCESS(f"[{tenant.schema_name}] Permisos y roles semilla creados/actualizados."))
                if sync_users:
                    sincronizar_roles_usuarios_existentes()
                    self.stdout.write(self.style.SUCCESS(f"[{tenant.schema_name}] Usuarios existentes sincronizados con roles base."))
            finally:
                clear_current_tenant()

    def handle(self, *args, **options):
        tenants = self._resolve_tenants(options.get("schema"), options.get("all_tenants", False))
        for tenant in tenants:
            self._run_for_tenant(tenant, sync_users=options.get("sincronizar_usuarios", False))
