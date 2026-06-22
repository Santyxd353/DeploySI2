from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from inventarios.models import Categoria, Subcategoria
import random
from tenants.models import Tenant

class Command(BaseCommand):
    help = 'Genera categorías y subcategorías de prueba'

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
        categorias_data = [
            ("Analgésicos", ["Paracetamol", "Ibuprofeno"]),
            ("Antibióticos", ["Penicilina", "Amoxicilina"]),
            ("Vitaminas", ["Vitamina C", "Vitamina D"]),
            ("Dermatológicos", ["Cremas", "Pomadas"]),
            ("Cardiología", ["Hipertensión"]),
            ("Gastroenterología", ["Antiácidos"]),
            ("Pediatría", ["Jarabes infantiles"]),
            ("Neurología", ["Antidepresivos"]),
            ("Oftalmología", ["Gotas oculares"]),
            ("Endocrinología", ["Diabetes"]),
        ]

        for nombre_cat, subcats in categorias_data:
            categoria, created = Categoria.objects.get_or_create(
                nombre=nombre_cat,
                defaults={
                    "descripcion": f"Categoría de {nombre_cat}"
                }
            )

            if created:
                self.stdout.write(self.style.SUCCESS(f"✔ Categoría creada: {nombre_cat}"))
            else:
                self.stdout.write(self.style.WARNING(f"⚠ Categoría ya existe: {nombre_cat}"))

            # Crear subcategorías
            for sub in subcats:
                sub_obj, sub_created = Subcategoria.objects.get_or_create(
                    nombre=sub,
                    categoria=categoria,
                    defaults={
                        "descripcion": f"Subcategoría de {sub}"
                    }
                )

                if sub_created:
                    self.stdout.write(self.style.SUCCESS(f"   ↳ Subcategoría creada: {sub}"))
                else:
                    self.stdout.write(self.style.WARNING(f"   ↳ Subcategoría ya existe: {sub}"))

    def handle(self, *args, **kwargs):
        tenants = self._resolve_tenants(kwargs.get("schema"), kwargs.get("all_tenants", False))
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                self.stdout.write(f"[{tenant.schema_name}] Sembrando categorías y subcategorías demo...")
                self._seed_for_current_schema()
                self.stdout.write(self.style.SUCCESS(f"[{tenant.schema_name}] Semillero completado correctamente"))