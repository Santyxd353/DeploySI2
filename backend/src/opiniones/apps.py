from django.apps import AppConfig


class OpinionesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "opiniones"

    def ready(self):
        import opiniones.signals  # noqa: F401
