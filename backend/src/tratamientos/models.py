from decimal import Decimal

from django.db import models
from django.utils import timezone
from tenants.mixins import TenantAwareModel


class TratamientoBase(TenantAwareModel):
    producto = models.OneToOneField(
        "inventarios.Producto",
        on_delete=models.PROTECT,
        related_name="tratamiento_base",
    )
    nombre_publico = models.CharField(max_length=160)
    dosis_cantidad = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("1.00"))
    unidad_dosis = models.CharField(max_length=40)
    frecuencia_horas = models.PositiveIntegerField()
    frecuencia_minutos = models.PositiveIntegerField(null=True, blank=True)
    duracion_dias = models.PositiveIntegerField()
    duracion_minutos = models.PositiveIntegerField(null=True, blank=True)
    instrucciones = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tratamiento base"
        verbose_name_plural = "Tratamientos base"
        ordering = ["nombre_publico"]
        constraints = [
            models.CheckConstraint(check=models.Q(frecuencia_horas__gte=1), name="chk_trat_base_frecuencia_min_1"),
            models.CheckConstraint(check=models.Q(duracion_dias__gte=1), name="chk_trat_base_duracion_min_1"),
        ]

    def __str__(self):
        return f"{self.nombre_publico} ({self.producto.sku})"


class TratamientoActivo(TenantAwareModel):
    ESTADO_CHOICES = [
        ("activo", "Activo"),
        ("completado", "Completado"),
        ("cancelado", "Cancelado"),
        ("abandonado", "Abandonado"),
        ("pausado", "Pausado"),
    ]

    cliente = models.ForeignKey("clientes.Cliente", on_delete=models.CASCADE, related_name="tratamientos_activos")
    tratamiento_base = models.ForeignKey(TratamientoBase, on_delete=models.PROTECT, related_name="tratamientos_cliente")
    fecha_inicio = models.DateField(default=timezone.localdate)
    activado_en = models.DateTimeField(null=True, blank=True)
    dosis_objetivo = models.PositiveIntegerField(default=0)
    dosis_tomadas = models.PositiveIntegerField(default=0)
    ultima_toma_real_at = models.DateTimeField(null=True, blank=True)
    fecha_fin_esperada = models.DateField()
    fecha_fin_programada = models.DateTimeField(null=True, blank=True)
    pausa_desde = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="activo")
    recordatorios_activos = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tratamiento activo"
        verbose_name_plural = "Tratamientos activos"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["cliente", "estado"]),
            models.Index(fields=["fecha_fin_esperada", "estado"]),
        ]

    def __str__(self):
        return f"Tratamiento activo #{self.id} - Cliente {self.cliente_id}"


class TomaMedicamento(TenantAwareModel):
    ESTADO_CHOICES = [
        ("pendiente", "Pendiente"),
        ("tomada", "Tomada"),
        ("omitida", "Omitida"),
        ("pospuesta", "Pospuesta"),
    ]

    tratamiento_activo = models.ForeignKey(TratamientoActivo, on_delete=models.CASCADE, related_name="tomas")
    fecha_hora_programada = models.DateTimeField(db_index=True)
    fecha_hora_real = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="pendiente")
    recordatorio_enviado_at = models.DateTimeField(null=True, blank=True)
    recordatorio_retraso_enviado_at = models.DateTimeField(null=True, blank=True)
    dosis_tomada = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Toma de medicamento"
        verbose_name_plural = "Tomas de medicamento"
        ordering = ["fecha_hora_programada"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "tratamiento_activo", "fecha_hora_programada"],
                name="uq_toma_tenant_tratamiento_programada",
            ),
        ]
        indexes = [
            models.Index(fields=["estado", "fecha_hora_programada"]),
            models.Index(fields=["tratamiento_activo", "fecha_hora_programada"]),
        ]

    def __str__(self):
        return f"{self.tratamiento_activo_id} @ {self.fecha_hora_programada} ({self.estado})"


class DispositivoNotificacion(TenantAwareModel):
    PLATAFORMA_CHOICES = [
        ("android", "Android"),
        ("ios", "iOS"),
        ("web", "Web"),
        ("unknown", "Unknown"),
    ]

    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="dispositivos_notificacion",
    )
    token = models.CharField(max_length=512)
    plataforma = models.CharField(max_length=20, choices=PLATAFORMA_CHOICES, default="unknown")
    activo = models.BooleanField(default=True)
    ultimo_registro_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Dispositivo de notificación"
        verbose_name_plural = "Dispositivos de notificación"
        ordering = ["-ultimo_registro_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "token"],
                name="uq_dispositivo_notif_tenant_token",
            )
        ]
        indexes = [
            models.Index(fields=["cliente", "activo"]),
            models.Index(fields=["plataforma", "activo"]),
        ]

    def __str__(self):
        return f"{self.cliente_id}::{self.plataforma}::{self.token[:16]}..."
