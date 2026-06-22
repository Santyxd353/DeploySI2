from django.core.management.base import BaseCommand
from predicciones.services import SalesDataService
from predicciones.ml_model import SalesPredictor

class Command(BaseCommand):
    help = 'Entrena el modelo de predicción de ventas con Random Forest'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Forzar reentrenamiento')

    def handle(self, *args, **options):
        self.stdout.write("Cargando datos históricos...")
        df = SalesDataService.get_training_data()
        
        if df.empty:
            self.stdout.write(self.style.ERROR("No hay datos suficientes para entrenar. Ejecuta seed_ventas_historicas primero."))
            return
        
        self.stdout.write(f"Entrenando con {len(df)} registros, {df['producto_id'].nunique()} productos...")
        
        predictor = SalesPredictor()
        try:
            predictor.train(df)
            self.stdout.write(self.style.SUCCESS("✅ Modelo entrenado y guardado correctamente."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error durante entrenamiento: {str(e)}"))
            import traceback
            traceback.print_exc()