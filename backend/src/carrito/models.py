import secrets

from django.conf import settings
from django.db import models
from tenants.mixins import TenantAwareModel


class Carrito(TenantAwareModel):
    ESTADO_CHOICES = [
        ("activo", "Activo"),
        ("confirmado", "Confirmado"),
        ("cancelado", "Cancelado"),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="carritos",
    )
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="activo")
    origen = models.CharField(max_length=20, default="online")
    invitado_token = models.CharField(max_length=64, blank=True, default="", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Carrito"
        verbose_name_plural = "Carritos"
        ordering = ["-updated_at"]

    def ensure_guest_token(self):
        if not self.invitado_token:
            self.invitado_token = secrets.token_hex(24)


class CarritoItem(TenantAwareModel):
    carrito = models.ForeignKey(Carrito, on_delete=models.CASCADE, related_name="items")
    producto = models.ForeignKey("inventarios.Producto", on_delete=models.PROTECT, related_name="items_carrito")
    cantidad = models.PositiveIntegerField(default=1)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Item de carrito"
        verbose_name_plural = "Items de carrito"
        unique_together = ["carrito", "producto"]
