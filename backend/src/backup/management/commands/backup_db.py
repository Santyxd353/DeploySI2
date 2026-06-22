from django.core.management.base import BaseCommand
from backup.backup_service import create_backup
from backup.models import BackupLog
from tenants.models import Tenant

class Command(BaseCommand):
    help = 'Realiza un backup de la base de datos y archivos media (por tenant o completo)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--type',
            type=str,
            default='manual',
            choices=['manual', 'auto']
        )
        parser.add_argument(
            '--tenant_id',
            type=int,
            help='ID del tenant (si se omite, backup completo)'
        )

    def handle(self, *args, **options):
        backup_type = options['type']
        tenant_id = options.get('tenant_id')
        tenant = None

        if tenant_id:
            try:
                tenant = Tenant.objects.get(id=tenant_id)
            except Tenant.DoesNotExist:
                self.stderr.write(self.style.ERROR(f'Tenant con ID {tenant_id} no existe'))
                return

        try:
            file_path, size = create_backup(tenant=tenant)  # nuevo parámetro
            BackupLog.objects.create(
                tenant=tenant,  # asignar tenant si corresponde
                backup_type=backup_type,
                status='success',
                file_path=file_path,
                file_size=size
            )
            self.stdout.write(self.style.SUCCESS(f'Backup creado: {file_path}'))
        except Exception as e:
            BackupLog.objects.create(
                tenant=tenant,
                backup_type=backup_type,
                status='failed',
                error_message=str(e)
            )
            self.stderr.write(self.style.ERROR(f'Error en backup: {str(e)}'))