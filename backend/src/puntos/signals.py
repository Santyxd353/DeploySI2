from django.db.models.signals import post_save
from django.dispatch import receiver

from ventas.models import Venta

from .services import registrar_puntos_por_venta, revertir_puntos_por_venta


@receiver(post_save, sender=Venta)
def manejar_puntos_por_venta(sender, instance, **kwargs):
    if instance.estado == "pagada":
        registrar_puntos_por_venta(instance)
    elif instance.estado == "cancelada":
        revertir_puntos_por_venta(instance)