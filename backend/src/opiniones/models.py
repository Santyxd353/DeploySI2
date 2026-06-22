from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from tenants.mixins import TenantAwareModel


class Opinion(TenantAwareModel):
    TIPOS = [
        ("general", "General"),
        ("venta", "Venta"),
        ("producto", "Producto"),
        ("servicio", "Servicio"),
    ]
    ESTADOS = [
        ("pendiente", "Pendiente"),
        ("respondida", "Respondida"),
        ("escalada", "Escalada"),
        ("archivada", "Archivada"),
    ]

    cliente = models.ForeignKey(
        "clientes.Cliente",
        on_delete=models.CASCADE,
        related_name="opiniones",
    )
    venta = models.ForeignKey(
        "ventas.Venta",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="opiniones",
    )
    producto = models.ForeignKey(
        "inventarios.Producto",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="opiniones",
    )

    tipo = models.CharField(max_length=20, choices=TIPOS, default="general")
    puntuacion = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comentario = models.TextField(blank=True, max_length=500)

    estado = models.CharField(max_length=20, choices=ESTADOS, default="pendiente")
    respuesta_staff = models.TextField(blank=True)
    respondida_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="opiniones_respondidas",
    )
    fecha_respuesta = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # R4: máximo 1 opinión por venta (solo cuando venta no es null)
            models.UniqueConstraint(
                fields=["cliente", "venta"],
                condition=models.Q(venta__isnull=False),
                name="unique_cliente_venta_opinion",
            )
        ]

    def __str__(self):
        return f"Opinion #{self.pk} — {self.get_tipo_display()} — {self.puntuacion}★"


class OpinionMetrica(TenantAwareModel):
    fecha = models.DateField(auto_now_add=True)
    total_opiniones = models.PositiveIntegerField(default=0)
    promedio_estrellas = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    distribucion_1 = models.PositiveIntegerField(default=0)
    distribucion_2 = models.PositiveIntegerField(default=0)
    distribucion_3 = models.PositiveIntegerField(default=0)
    distribucion_4 = models.PositiveIntegerField(default=0)
    distribucion_5 = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-fecha"]
