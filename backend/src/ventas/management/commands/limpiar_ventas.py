from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from tenants.models import Tenant
from tenants.context import set_current_tenant, clear_current_tenant

class Command(BaseCommand):
    help = 'Limpia todas las ventas y detalles de un tenant'

    def add_arguments(self, parser):
        parser.add_argument('--schema', type=str, default='farmacia1')

    def handle(self, *args, **options):
        schema = options['schema']
        try:
            tenant = Tenant.objects.get(schema_name=schema)
        except Tenant.DoesNotExist:
            self.stderr.write(f"Tenant {schema} no existe")
            return

        with schema_context(schema):
            set_current_tenant(tenant)
            from ventas.models import DetalleVenta, Venta
            detalles_borrados, _ = DetalleVenta.objects.all().delete()
            ventas_borradas, _ = Venta.objects.all().delete()
            self.stdout.write(f"Borrados {detalles_borrados} detalles y {ventas_borradas} ventas en {schema}")
            clear_current_tenant()