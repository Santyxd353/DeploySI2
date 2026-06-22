from celery import shared_task
from django.core.management import call_command
from django.utils import timezone
from django.db import connection
from django_tenants.utils import tenant_context
from tenants.models import Tenant
from .models import BackupSchedule
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def perform_backup_for_tenant(self, tenant_id):
    """Ejecuta el backup para un tenant específico."""
    try:
        tenant = Tenant.objects.get(id=tenant_id)
        with tenant_context(tenant):
            call_command('backup_db', tenant_id=str(tenant.id), type='auto')
            schedule = BackupSchedule.objects.filter(tenant_id=tenant.id).first()
            if schedule:
                schedule.last_run = timezone.now()
                schedule.next_run = schedule.calculate_next_run()
                schedule.save(update_fields=['last_run', 'next_run'])
        logger.info(f"Backup automático OK para tenant {tenant_id}")
    except Exception as e:
        logger.error(f"Error en backup automático para tenant {tenant_id}: {e}")
        raise self.retry(exc=e, countdown=300)


@shared_task
def check_and_trigger_backups():
    """Revisa todos los tenants y dispara los backups vencidos."""
    now = timezone.now()
    tenants = Tenant.objects.all()

    for tenant in tenants:
        try:
            with tenant_context(tenant):
                schedules = BackupSchedule.objects.filter(
                    is_active=True,
                    next_run__lte=now
                )
                for schedule in schedules:
                    logger.info(f"Disparando backup para tenant {tenant.id}")
                    perform_backup_for_tenant.delay(tenant.id)
        except Exception as e:
            logger.error(f"Error procesando schedules para tenant {tenant.id}: {e}")