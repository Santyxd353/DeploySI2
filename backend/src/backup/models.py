from django.db import models
from tenants.mixins import TenantAwareModel


class BackupLog(TenantAwareModel):
    BACKUP_TYPES = [
        ('manual', 'Manual'),
        ('auto', 'Automático'),
    ]
    STATUS_CHOICES = [
        ('success', 'Éxito'),
        ('failed', 'Fallido'),
    ]

    timestamp = models.DateTimeField(auto_now_add=True)
    backup_type = models.CharField(max_length=10, choices=BACKUP_TYPES, default='manual')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    file_path = models.CharField(max_length=500, blank=True, null=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Registro de Backup'
        verbose_name_plural = 'Registros de Backup'

    def __str__(self):
        return f"Backup {self.timestamp} - {self.status}"


class BackupSchedule(TenantAwareModel):
    FREQUENCY_CHOICES = [
        ('hourly', 'Cada hora'),
        ('daily', 'Diario'),
        ('weekly', 'Semanal'),
        ('monthly', 'Mensual'),
        ('custom', 'Expresión cron personalizada'),
    ]

    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='daily')
    time_of_day = models.TimeField(
        null=True, blank=True,
        help_text="Hora del día (para diario/semanal/mensual). Formato HH:MM"
    )
    day_of_week = models.IntegerField(
        null=True, blank=True,
        choices=[(i, f'Día {i}') for i in range(0, 7)],
        help_text="0=Domingo, 6=Sábado (para frecuencia semanal)"
    )
    day_of_month = models.IntegerField(
        null=True, blank=True,
        choices=[(i, str(i)) for i in range(1, 32)],
        help_text="Día del mes (para frecuencia mensual)"
    )
    cron_expression = models.CharField(
        max_length=100, null=True, blank=True,
        help_text="Expresión cron (para frecuencia personalizada). Ej: '0 2 * * *'"
    )
    is_active = models.BooleanField(default=True)
    last_run = models.DateTimeField(null=True, blank=True)
    next_run = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Programación de backup'
        verbose_name_plural = 'Programaciones de backup'

    def __str__(self):
        return f"Schedule {self.tenant} - {self.frequency}"

    def calculate_next_run(self, from_time=None):
        """Devuelve la próxima fecha de ejecución usando croniter."""
        from django.utils import timezone
        import croniter
        from datetime import datetime

        if not self.is_active:
            return None

        # Obtener la hora actual y convertirla a la zona horaria configurada (America/La_Paz)
        now = from_time or timezone.now()
        now_local = timezone.localtime(now)

        if self.frequency == 'custom' and self.cron_expression:
            cron = croniter.croniter(self.cron_expression, now_local)
            return cron.get_next(datetime)

        if self.frequency == 'hourly':
            cron_expr = f"{now_local.minute} */1 * * *"
        elif self.frequency == 'daily' and self.time_of_day:
            t = self.time_of_day
            cron_expr = f"{t.minute} {t.hour} * * *"
        elif self.frequency == 'weekly' and self.time_of_day and self.day_of_week is not None:
            t = self.time_of_day
            cron_expr = f"{t.minute} {t.hour} * * {self.day_of_week}"
        elif self.frequency == 'monthly' and self.time_of_day and self.day_of_month:
            t = self.time_of_day
            cron_expr = f"{t.minute} {t.hour} {self.day_of_month} * *"
        else:
            return None

        cron = croniter.croniter(cron_expr, now_local)
        return cron.get_next(datetime)

    def save(self, *args, **kwargs):
        # Actualiza `next_run` antes de guardar
        if self.is_active:
            self.next_run = self.calculate_next_run()
        else:
            self.next_run = None
        super().save(*args, **kwargs)