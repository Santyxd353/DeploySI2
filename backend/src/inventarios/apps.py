from django.apps import AppConfig

class InventariosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'inventarios'
    verbose_name = 'Módulo de Inventarios'

    def ready(self):
        import inventarios.signals