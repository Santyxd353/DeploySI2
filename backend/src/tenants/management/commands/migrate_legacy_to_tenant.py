from django.core.management import BaseCommand, call_command
from django.db import connection
from django_tenants.utils import schema_context

from tenants.models import Domain, Plan, Suscripcion, Tenant, TenantUser
from tenants.services import ensure_default_plans


LEGACY_TABLES = [
    "core_bitacora_sistema",
    "inventarios_categoria",
    "inventarios_subcategoria",
    "inventarios_laboratorio",
    "inventarios_producto",
    "inventarios_inventario",
    "inventarios_movimientoinventario",
    "inventarios_entradastock",
    "clientes_cliente",
    "clientes_recetamedica",
    "carrito_carrito",
    "carrito_carritoitem",
    "ventas_venta",
    "ventas_detalleventa",
    "ventas_factura",
    "backup_backuplog",
]


class Command(BaseCommand):
    help = "Migra datos legados (public schema) hacia un tenant por defecto"

    def add_arguments(self, parser):
        parser.add_argument("--schema", default="farmacia_principal")
        parser.add_argument("--subdomain", default="farmacia-principal")
        parser.add_argument("--domain", default="farmacia-principal.localhost")
        parser.add_argument("--name", default="Farmacia Principal")
        parser.add_argument("--email", default="admin@farmacia.local")

    def handle(self, *args, **options):
        schema_name = options["schema"]
        subdomain = options["subdomain"]
        domain = options["domain"]
        name = options["name"]
        email = options["email"]

        ensure_default_plans()
        free_plan = Plan.objects.get(slug="gratuito")

        tenant, _ = Tenant.objects.get_or_create(
            schema_name=schema_name,
            defaults={
                "name": name,
                "subdomain": subdomain,
                "contact_email": email,
                "status": "activo",
            },
        )

        Domain.objects.get_or_create(tenant=tenant, domain=domain, defaults={"is_primary": True})

        self.stdout.write("Aplicando migraciones de tenant...")
        call_command("migrate_schemas", schema_name=schema_name, interactive=False, verbosity=0)

        self.stdout.write("Copiando datos desde public al schema tenant...")
        with connection.cursor() as cursor:
            for table in LEGACY_TABLES:
                if not self._table_exists(cursor, "public", table):
                    continue
                if not self._table_exists(cursor, schema_name, table):
                    continue

                columns = self._common_columns(cursor, "public", table, schema_name, table)
                if not columns:
                    continue

                cols_sql = ", ".join(columns)
                cursor.execute(f'SET search_path TO "{schema_name}", public;')
                cursor.execute(f'TRUNCATE TABLE "{schema_name}"."{table}" RESTART IDENTITY CASCADE;')
                cursor.execute(
                    f'INSERT INTO "{schema_name}"."{table}" ({cols_sql}) '
                    f'SELECT {cols_sql} FROM "public"."{table}";'
                )

                if "tenant_id" in columns:
                    cursor.execute(
                        f'UPDATE "{schema_name}"."{table}" SET tenant_id = %s WHERE tenant_id IS NULL;',
                        [tenant.id],
                    )

        with schema_context(schema_name):
            from django.contrib.auth import get_user_model
            from core.rbac import ROLE_ADMIN, ROLE_CAJERO, ROLE_CLIENTE, ROLE_FARMACEUTICO

            user_model = get_user_model()
            for user in user_model.objects.all():
                role = ROLE_CLIENTE
                if user.is_superuser:
                    role = ROLE_ADMIN
                elif user.is_staff:
                    role = ROLE_FARMACEUTICO
                TenantUser.objects.update_or_create(
                    tenant=tenant,
                    user=user,
                    defaults={"role": role, "is_active": True},
                )

        Suscripcion.objects.get_or_create(
            tenant=tenant,
            plan=free_plan,
            defaults={"estado": "active", "auto_renovar": False},
        )

        self.stdout.write(self.style.SUCCESS("Migracion legacy a tenant completada."))

    def _table_exists(self, cursor, schema, table):
        cursor.execute(
            """
            SELECT EXISTS(
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = %s AND table_name = %s
            )
            """,
            [schema, table],
        )
        return cursor.fetchone()[0]

    def _common_columns(self, cursor, source_schema, source_table, target_schema, target_table):
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            [source_schema, source_table],
        )
        source_columns = [row[0] for row in cursor.fetchall()]

        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            [target_schema, target_table],
        )
        target_columns = {row[0] for row in cursor.fetchall()}

        return [col for col in source_columns if col in target_columns]
