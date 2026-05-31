from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Opinion


@receiver(post_save, sender=Opinion)
def alerta_opinion_baja(sender, instance, created, **kwargs):
    """R8: Crea entrada en BitacoraSistema cuando se recibe una opinión ≤2★."""
    if not created:
        return
    if instance.puntuacion > 2:
        return

    # Importación diferida para evitar ciclos
    from core.models import BitacoraSistema

    BitacoraSistema.objects.create(
        usuario=None,
        accion="ALERTA_OPINION_BAJA",
        modulo="opiniones",
        entidad="Opinion",
        entidad_id=str(instance.id),
        resultado="WARNING",
        mensaje=(
            f"Opinión #{instance.id} con {instance.puntuacion}★ recibida. "
            f"Cliente: {instance.cliente_id}. Requiere atención del staff."
        ),
    )
