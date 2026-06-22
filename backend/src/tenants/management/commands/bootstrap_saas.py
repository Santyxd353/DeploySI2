from django.core.management import BaseCommand

from tenants.services import ensure_default_plans


class Command(BaseCommand):
    help = "Crea o actualiza los planes base del SaaS"

    def handle(self, *args, **options):
        ensure_default_plans()
        self.stdout.write(self.style.SUCCESS("Planes base sincronizados."))
