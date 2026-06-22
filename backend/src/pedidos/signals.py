import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="ventas.Venta")
def crear_pedido_al_pagar(sender, instance, created, **kwargs):
    """
    Crea automáticamente un Pedido cuando una Venta es online y queda pagada.
    Esto actúa como respaldo para ventas creadas via webhook de Stripe.
    La view confirmar_pago_venta crea el Pedido con lat/lon directamente;
    esta señal garantiza que siempre haya un Pedido aunque falte la geolocalización.
    """
    if instance.origen != "online" or instance.estado != "pagada":
        return

    try:
        from .models import Pedido
        from .services import crear_notificacion_admin
        from tenants.context import get_current_tenant
        from django.db import connection

        if hasattr(instance, "pedido"):
            return

        tenant = get_current_tenant() or getattr(connection, "tenant", None)

        pedido = Pedido.objects.create(venta=instance)

        if tenant:
            try:
                crear_notificacion_admin(pedido, tenant)
            except Exception as exc:
                logger.warning("No se pudo notificar admin pedido #%s: %s", pedido.id, exc)

    except Exception as exc:
        logger.error("Error creando Pedido para Venta #%s: %s", instance.id, exc)
