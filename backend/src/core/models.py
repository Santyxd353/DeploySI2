from django.conf import settings
from django.db import models
from tenants.mixins import TenantAwareModel


class BitacoraSistema(TenantAwareModel):
    fecha_hora = models.DateTimeField(auto_now_add=True, db_index=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="eventos_bitacora",
    )
    accion = models.CharField(max_length=50, db_index=True)
    modulo = models.CharField(max_length=80, db_index=True)
    entidad = models.CharField(max_length=80, blank=True, default="")
    entidad_id = models.CharField(max_length=64, blank=True, default="")
    resultado = models.CharField(max_length=20, db_index=True)
    mensaje = models.CharField(max_length=255, blank=True, default="")
    ip_origen = models.GenericIPAddressField(null=True, blank=True)
    navegador = models.CharField(max_length=255, blank=True, default="")
    ruta = models.CharField(max_length=255, blank=True, default="")
    metodo_http = models.CharField(max_length=10, blank=True, default="")

    class Meta:
        db_table = "core_bitacora_sistema"
        ordering = ["-fecha_hora"]

    def __str__(self):
        return f"{self.fecha_hora} {self.modulo}.{self.accion} {self.resultado}"
