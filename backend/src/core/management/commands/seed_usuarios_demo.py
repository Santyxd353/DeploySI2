from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

from clientes.models import Cliente
from core.rbac import (
    ROLE_ADMIN,
    ROLE_CAJERO,
    ROLE_CLIENTE,
    ROLE_FARMACEUTICO,
    asignar_rol_usuario,
    seed_roles_y_permisos,
)
from tenants.context import clear_current_tenant, set_current_tenant
from tenants.models import Tenant


class Command(BaseCommand):
    help = "Crea o actualiza 5 usuarios demo con roles para pruebas de gestion de usuarios."

    DEFAULT_PASSWORD = "SaludPlus2026*"

    USERS = [
        {
            "first_name": "Carlos",
            "last_name": "Mendoza",
            "email": "carlos.mendoza@saludplus.com",
            "role": ROLE_ADMIN,
            "is_active": True,
        },
        {
            "first_name": "Ana",
            "last_name": "Rojas",
            "email": "ana.rojas@saludplus.com",
            "role": ROLE_FARMACEUTICO,
            "is_active": True,
        },
        {
            "first_name": "Luis",
            "last_name": "Torrez",
            "email": "luis.torrez@saludplus.com",
            "role": ROLE_CAJERO,
            "is_active": True,
        },
        {
            "first_name": "Maria",
            "last_name": "Quispe",
            "email": "maria.quispe@saludplus.com",
            "role": ROLE_CLIENTE,
            "is_active": True,
        },
        {
            "first_name": "Jorge",
            "last_name": "Vargas",
            "email": "jorge.vargas@saludplus.com",
            "role": ROLE_CLIENTE,
            "is_active": True,
        },
    ]

    def add_arguments(self, parser):
        parser.add_argument(
            "--schema",
            type=str,
            help="Schema del tenant donde se crearan usuarios demo (ej: farmacia1)",
        )
        parser.add_argument(
            "--all-tenants",
            action="store_true",
            help="Ejecuta el seed en todos los tenants activos.",
        )
        parser.add_argument(
            "--password",
            default=self.DEFAULT_PASSWORD,
            help=(
                "Contrasena comun para usuarios nuevos o para sobrescribir con --reset-password. "
                f"Por defecto: {self.DEFAULT_PASSWORD}"
            ),
        )
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="Sobrescribe la contrasena de los usuarios semilla existentes.",
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

    def _run_for_tenant(self, tenant, password, reset_password):
        with schema_context(tenant.schema_name):
            set_current_tenant(tenant)
            try:
                seed_roles_y_permisos()

                user_model = get_user_model()
                created_count = 0
                updated_count = 0

                for item in self.USERS:
                    email = item["email"].strip().lower()
                    defaults = {
                        "username": email.split("@")[0],
                        "first_name": item["first_name"],
                        "last_name": item["last_name"],
                        "is_active": item["is_active"],
                    }

                    user, created = user_model.objects.get_or_create(email=email, defaults=defaults)

                    if created:
                        user.set_password(password)
                        created_count += 1
                    else:
                        user.first_name = item["first_name"]
                        user.last_name = item["last_name"]
                        user.is_active = item["is_active"]
                        if reset_password:
                            user.set_password(password)
                        updated_count += 1

                    asignar_rol_usuario(user, item["role"])

                    if item["role"] == ROLE_CLIENTE:
                        Cliente.objects.get_or_create(
                            usuario=user,
                            defaults={
                                "tenant": tenant,
                                "tipo": "registrado",
                                "nombres": item["first_name"],
                                "apellidos": item["last_name"],
                                "email": email,
                                "estado": True,
                            },
                        )

                    update_fields = ["first_name", "last_name", "is_active", "is_superuser", "is_staff"]
                    if created or reset_password:
                        update_fields.append("password")

                    user.save(update_fields=update_fields)

                    self.stdout.write(
                        f"[{tenant.schema_name}] - {email} | {item['first_name']} {item['last_name']} | rol={item['role']} | "
                        f"{'creado' if created else 'actualizado'}"
                    )

                self.stdout.write(self.style.SUCCESS(f"[{tenant.schema_name}] Usuarios demo procesados correctamente."))
                self.stdout.write(self.style.SUCCESS(f"[{tenant.schema_name}] Creados: {created_count} | Actualizados: {updated_count}"))
            finally:
                clear_current_tenant()

    def handle(self, *args, **options):
        password = options["password"]
        reset_password = options.get("reset_password", False)
        tenants = self._resolve_tenants(options.get("schema"), options.get("all_tenants", False))
        for tenant in tenants:
            self._run_for_tenant(tenant, password=password, reset_password=reset_password)

        self.stdout.write(
            self.style.WARNING(
                "Recuerda cambiar estas contrasenas en entornos compartidos o de produccion."
            )
        )
