import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('farmacia')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Tarea que revisa cada minuto
app.conf.beat_schedule = {
    'check-backup-schedules-every-minute': {
        'task': 'backup.tasks.check_and_trigger_backups',
        'schedule': 60.0,
    },
}