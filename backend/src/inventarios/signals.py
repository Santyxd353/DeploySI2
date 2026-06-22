from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Producto, Inventario

@receiver(post_save, sender=Producto)
def crear_inventario_al_crear_producto(sender, instance, created, **kwargs):
    """
    Crea automáticamente un registro de inventario cuando se crea un nuevo producto
    """
    if created:
        Inventario.objects.create(
            producto=instance,
            stock_actual=0,
            stock_reservado=0,
            stock_minimo=instance.stock_minimo
        )
        # Keep signal side effects free from console encoding issues (notably on Windows cp1252).
        print(f"Inventario creado para producto: {instance.nombre_comercial}")
