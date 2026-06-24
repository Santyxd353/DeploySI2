from django.conf import settings
from django.db import models

from tenants.mixins import TenantAwareModel


class Pedido(TenantAwareModel):
    ESTADO_CHOICES = [
        ("pagado", "Pagado"),
        ("aceptado", "Aceptado"),
        ("preparando", "Preparando"),
        ("listo", "Listo para envío"),
        ("en_camino", "En camino"),
        ("cerca", "Cerca del destino"),
        ("entregado", "Entregado"),
        ("no_entregado", "No entregado"),
        ("cancelado", "Cancelado"),
    ]

    venta = models.OneToOneField(
        "ventas.Venta",
        on_delete=models.PROTECT,
        related_name="pedido",
    )
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="pagado", db_index=True)
    repartidor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="pedidos_asignados",
    )

    # Coordenadas de entrega (capturadas al confirmar el pago)
    lat_entrega = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lon_entrega = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    direccion_texto = models.CharField(max_length=500, blank=True)

    # Posición del repartidor (actualizada en tiempo real via WebSocket)
    lat_repartidor = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lon_repartidor = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # Timestamps por transición de estado
    aceptado_en = models.DateTimeField(null=True, blank=True)
    preparando_en = models.DateTimeField(null=True, blank=True)
    listo_en = models.DateTimeField(null=True, blank=True)
    en_camino_en = models.DateTimeField(null=True, blank=True)
    entregado_en = models.DateTimeField(null=True, blank=True)

    notas_internas = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Pedido"
        verbose_name_plural = "Pedidos"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Pedido #{self.pk} [{self.estado}] - Venta #{self.venta_id}"


class HistorialEstadoPedido(TenantAwareModel):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name="historial")
    estado_anterior = models.CharField(max_length=20, blank=True)
    estado_nuevo = models.CharField(max_length=20)
    cambiado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cambios_estado_pedido",
    )
    notas = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Historial de estado"
        verbose_name_plural = "Historial de estados"
        ordering = ["created_at"]

    def __str__(self):
        return f"Pedido #{self.pedido_id}: {self.estado_anterior} → {self.estado_nuevo}"


class Notificacion(TenantAwareModel):
    TIPO_CHOICES = [
        ("pedido_nuevo", "Pedido nuevo"),
        ("pedido_aceptado", "Pedido aceptado"),
        ("pedido_preparando", "Preparando pedido"),
        ("pedido_listo", "Pedido listo"),
        ("pedido_en_camino", "Pedido en camino"),
        ("pedido_cerca", "Pedido cerca"),
        ("pedido_entregado", "Pedido entregado"),
        ("pedido_no_entregado", "Entrega fallida"),
        ("pedido_cancelado", "Pedido cancelado"),
        ("repartidor_asignado", "Repartidor asignado"),
    ]

    destinatario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notificaciones_pedidos",
    )
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    titulo = models.CharField(max_length=200)
    mensaje = models.TextField()
    pedido = models.ForeignKey(
        Pedido,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notificaciones",
    )
    leida = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.tipo}] → {self.destinatario_id}: {self.titulo}"
