from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from inventarios.models import Laboratorio
import random
from tenants.models import Tenant

class Command(BaseCommand):
    help = 'Genera laboratorios de prueba'

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
        nombres = [
            "Lab FarmaBol", "BioGen", "SaludPlus", "Andes Pharma",
            "NovaLab", "Meditech", "VitalLab", "CuraMed",
            "PharmaLife", "EcoLab"
        ]

        paises = ["Bolivia", "Argentina", "Brasil", "Chile", "Perú"]

        for nombre in nombres:
            obj, created = Laboratorio.objects.get_or_create(
                nombre=nombre,
                defaults={
                    "pais": random.choice(paises),
                    "telefono": f"+5917{random.randint(1000000, 9999999)}",
                    "email": f"{nombre.lower().replace(' ', '')}@mail.com",
                    "direccion": "Dirección de prueba",
                    "contacto_representante": "Juan Pérez",
                }
            )

            if created:
                self.stdout.write(self.style.SUCCESS(f"✔ {nombre} creado"))
            else:
                self.stdout.write(self.style.WARNING(f"⚠ {nombre} ya existe"))

    def handle(self, *args, **kwargs):
        tenants = self._resolve_tenants(kwargs.get("schema"), kwargs.get("all_tenants", False))
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                self.stdout.write(f"[{tenant.schema_name}] Sembrando laboratorios demo...")
                self._seed_for_current_schema()
                self.stdout.write(self.style.SUCCESS(f"[{tenant.schema_name}] Seeder de laboratorios completado con éxito."))