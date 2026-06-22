"""
Management command: fix_tenant_sequences
- Assigns tenant_id to NULL rows in all TenantAware tables for a given schema.
- Syncs PostgreSQL PK sequences so inserts don't collide.

Usage:
    python manage.py fix_tenant_sequences --schema farmacia_principal
"""
from django.core.management.base import BaseCommand
from django.db import connection


TENANT_TABLES = [
    "inventarios_producto",
    "inventarios_inventario",
    "inventarios_movimientoinventario",
    "inventarios_categoria",
    "inventarios_subcategoria",
    "inventarios_laboratorio",
    "carrito_carrito",
    "carrito_carritoitem",
    "ventas_venta",
    "ventas_detalleventa",
    "ventas_factura",
    "clientes_cliente",
    "core_bitacora_sistema",
    "predicciones_prediccion",
]


class Command(BaseCommand):
    help = "Fix tenant_id=NULL rows and sync PK sequences for a tenant schema."

    def add_arguments(self, parser):
        parser.add_argument("--schema", required=True, help="Tenant schema name, e.g. farmacia_principal")

    def handle(self, *args, **options):
        schema = options["schema"]

        from tenants.models import Tenant  # noqa: PLC0415

        tenant = Tenant.objects.filter(schema_name=schema).first()
        if tenant is None:
            self.stderr.write(f"Tenant with schema '{schema}' not found.")
            return

        connection.set_tenant(tenant)

        with connection.cursor() as cursor:
            # 1. Assign tenant_id to NULL rows
            for table in TENANT_TABLES:
                # Check if table exists in this schema
                cursor.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = %s AND table_name = %s
                    )
                    """,
                    [schema, table],
                )
                if not cursor.fetchone()[0]:
                    self.stdout.write(f"  {table}: table not found, skipping")
                    continue

                # Check if tenant_id column exists
                cursor.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = %s AND table_name = %s AND column_name = 'tenant_id'
                    )
                    """,
                    [schema, table],
                )
                if not cursor.fetchone()[0]:
                    self.stdout.write(f"  {table}: no tenant_id column, skipping")
                    continue

                cursor.execute(
                    f'UPDATE "{schema}"."{table}" SET tenant_id = %s WHERE tenant_id IS NULL',
                    [tenant.id],
                )
                updated = cursor.rowcount
                self.stdout.write(f"  {table}: set tenant_id on {updated} rows")

            # 2. Sync PK sequences
            for table in TENANT_TABLES:
                cursor.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = %s AND table_name = %s
                    )
                    """,
                    [schema, table],
                )
                if not cursor.fetchone()[0]:
                    continue

                try:
                    cursor.execute(
                        f"""
                        SELECT setval(
                            pg_get_serial_sequence('"{schema}"."{table}"', 'id'),
                            COALESCE((SELECT MAX(id) FROM "{schema}"."{table}"), 1),
                            true
                        )
                        """
                    )
                    val = cursor.fetchone()[0]
                    self.stdout.write(f"  {table}: sequence set to {val}")
                except Exception as exc:
                    self.stdout.write(f"  {table}: sequence sync skipped ({exc})")

        self.stdout.write(self.style.SUCCESS(f"Done for schema '{schema}'."))
