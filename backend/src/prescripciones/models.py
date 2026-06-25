from django.conf import settings
from django.db import models

from tenants.mixins import TenantAwareModel


class CapturaReceta(TenantAwareModel):
    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        PROCESANDO = "procesando", "Procesando"
        PROCESADA = "procesada", "Procesada"
        CONFIRMADA = "confirmada", "Confirmada"
        FALLIDA = "fallida", "Fallida"

    cliente = models.ForeignKey(
        "clientes.Cliente",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="capturas_receta",
    )
    receta_medica = models.ForeignKey(
        "clientes.RecetaMedica",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="capturas_origen",
    )
    archivo_imagen = models.ImageField(upload_to="prescripciones/capturas/")
    nombre_archivo_original = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=120, blank=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    motor_ia = models.CharField(max_length=60, default="gemini")
    modelo_ia = models.CharField(max_length=120, blank=True)
    texto_extraido = models.TextField(blank=True)
    respuesta_ia = models.JSONField(default=dict, blank=True)
    datos_extraidos = models.JSONField(default=dict, blank=True)
    datos_resueltos = models.JSONField(default=dict, blank=True)
    carrito_enviado = models.BooleanField(default=False)
    carrito_enviado_at = models.DateTimeField(null=True, blank=True)
    requiere_revision_manual = models.BooleanField(default=True)
    error_detalle = models.TextField(blank=True)
    creada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="capturas_receta_creadas",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Captura de receta"
        verbose_name_plural = "Capturas de recetas"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "estado"]),
            models.Index(fields=["cliente", "created_at"]),
        ]

    def __str__(self):
        return f"Captura receta #{self.id} ({self.estado})"


class ItemCapturaReceta(TenantAwareModel):
    class DecisionCliente(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        ACEPTADO = "aceptado", "Aceptado"
        RECHAZADO = "rechazado", "Rechazado"
        EDITADO = "editado", "Editado"

    captura = models.ForeignKey(
        CapturaReceta,
        on_delete=models.CASCADE,
        related_name="items",
    )
    orden = models.PositiveIntegerField(default=1)
    nombre_detectado = models.CharField(max_length=255, blank=True)
    presentacion_detectada = models.CharField(max_length=255, blank=True)
    cantidad_detectada = models.CharField(max_length=120, blank=True)
    indicaciones_detectadas = models.TextField(blank=True)
    duracion_detectada = models.CharField(max_length=120, blank=True)
    confianza = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    producto = models.ForeignKey(
        "inventarios.Producto",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="items_captura_receta",
    )
    tratamiento_base = models.ForeignKey(
        "tratamientos.TratamientoBase",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="items_captura_receta",
    )
    decision_cliente = models.CharField(
        max_length=20,
        choices=DecisionCliente.choices,
        default=DecisionCliente.PENDIENTE,
    )
    nombre_resuelto = models.CharField(max_length=255, blank=True)
    indicaciones_resueltas = models.TextField(blank=True)
    duracion_resuelta = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Item de captura de receta"
        verbose_name_plural = "Items de captura de receta"
        ordering = ["orden", "id"]
        indexes = [
            models.Index(fields=["captura", "decision_cliente"]),
        ]

    def __str__(self):
        return self.nombre_resuelto or self.nombre_detectado or f"Item #{self.id}"
