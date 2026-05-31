from django.apps import AppConfig


class PuntosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "puntos"

    def ready(self):
        from . import signals  # noqa: F401