from django.core.management.base import BaseCommand
from django.utils import timezone

from puntos.models import CatalogoCanje


class Command(BaseCommand):
    help = "Desactiva recompensas vencidas (valido_hasta < hoy)."

    def handle(self, *args, **options):
        today = timezone.localdate()
        updated = CatalogoCanje.objects.filter(
            activo=True,
            valido_hasta__isnull=False,
            valido_hasta__lt=today,
        ).update(activo=False)

        self.stdout.write(
            self.style.SUCCESS(
                f"Recompensas vencidas desactivadas: {updated}"
            )
        )
