from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from tenants.models import Tenant
from tenants.context import set_current_tenant, clear_current_tenant

class Command(BaseCommand):
    help = 'Diagnostica ventas por mes para un tenant'

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
            from ventas.models import Venta
            from django.db.models import Count
            from django.db.models.functions import ExtractMonth, ExtractYear

            distribucion = Venta.objects.annotate(
                mes=ExtractMonth('created_at'),
                ano=ExtractYear('created_at')
            ).values('ano', 'mes').annotate(
                total=Count('id')
            ).order_by('ano', 'mes')

            for d in distribucion:
                self.stdout.write(f"{d['ano']}-{d['mes']:02d}: {d['total']} ventas")
            self.stdout.write(f"Total ventas: {Venta.objects.count()}")
            clear_current_tenant()