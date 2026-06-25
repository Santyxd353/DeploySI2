from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from tenants.models import Tenant
from tenants.context import set_current_tenant, clear_current_tenant
from predicciones.services import SalesDataService
from predicciones.ml_model import SalesPredictor

class Command(BaseCommand):
    help = 'Entrena el modelo de prediccion de ventas con Random Forest'

    def add_arguments(self, parser):
        parser.add_argument('--schema', type=str, default='farmacia1', help='Schema del tenant')
        parser.add_argument('--all-tenants', action='store_true', help='Entrenar en todos los tenants activos')
        parser.add_argument('--force', action='store_true', help='Forzar reentrenamiento')

    def handle(self, *args, **options):
        if options['all_tenants']:
            tenants = Tenant.objects.filter(status='activo').exclude(schema_name='public')
        else:
            schema = options['schema']
            try:
                tenants = [Tenant.objects.get(schema_name=schema)]
            except Tenant.DoesNotExist:
                self.stderr.write(f"Tenant '{schema}' no existe")
                return

        for tenant in tenants:
            with schema_context(tenant.schema_name):
                set_current_tenant(tenant)
                self.stdout.write(f"[{tenant.schema_name}] Cargando datos historicos...")
                try:
                    df = SalesDataService.get_training_data()

                    if df.empty:
                        self.stdout.write(self.style.WARNING(f"[{tenant.schema_name}] No hay datos. Ejecuta el seed primero."))
                        continue

                    self.stdout.write(f"[{tenant.schema_name}] Entrenando con {len(df)} registros, {df['producto_id'].nunique()} productos...")

                    predictor = SalesPredictor()
                    predictor.train(df)
                    self.stdout.write(self.style.SUCCESS(f"[{tenant.schema_name}] Modelo entrenado y guardado."))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"[{tenant.schema_name}] Error: {str(e)}"))
                    import traceback
                    traceback.print_exc()
                finally:
                    clear_current_tenant()