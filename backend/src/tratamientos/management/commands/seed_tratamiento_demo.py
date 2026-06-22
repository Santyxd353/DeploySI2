from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

from inventarios.models import Producto
from tenants.context import clear_current_tenant, set_current_tenant
from tenants.models import Tenant
from tratamientos.models import TratamientoBase


class Command(BaseCommand):
    help = "Crea o actualiza el tratamiento demo (Paracetamol demo 2 min)."

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

    def _seed_for_current_schema(self):
        producto = (
            Producto.objects.filter(estado=True, tratamiento_base__isnull=True).order_by("id").first()
            or Producto.objects.filter(estado=True).order_by("id").first()
        )

        if producto is None:
            self.stdout.write(
                self.style.ERROR("No hay productos activos. Ejecuta seed_productos primero.")
            )
            return

        tratamiento, created = TratamientoBase._base_manager.update_or_create(
            producto=producto,
            defaults={
                "nombre_publico": "Paracetamol demo 2 min",
                "dosis_cantidad": "1.00",
                "unidad_dosis": "tableta",
                "frecuencia_horas": 1,
                "frecuencia_minutos": 2,
                "duracion_dias": 1,
                "duracion_minutos": 5,
                "instrucciones": "Demo: 1 tableta. Reinicio cada 2 min durante 5 min.",
                "activo": True,
            },
        )

        action = "creado" if created else "actualizado"
        self.stdout.write(
            self.style.SUCCESS(
                f"Tratamiento demo {action}: id={tratamiento.id}, producto={producto.nombre_comercial}"
            )
        )

    def handle(self, *args, **options):
        tenants = self._resolve_tenants(options.get("schema"), options.get("all_tenants", False))
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                set_current_tenant(tenant)
                self.stdout.write(f"[{tenant.schema_name}] Ejecutando seed de tratamiento demo...")
                try:
                    self._seed_for_current_schema()
                finally:
                    clear_current_tenant()
