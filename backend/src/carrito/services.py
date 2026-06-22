from decimal import Decimal

from django.db import connection, IntegrityError, transaction
from django.db.models import F

from inventarios.models import Inventario, Producto

from .models import Carrito, CarritoItem


class CarritoServiceError(Exception):
    pass


def _validar_stock_para_carrito(*, disponible, solicitado):
    if solicitado > disponible:
        raise CarritoServiceError(
            f"Stock insuficiente. Solo hay {disponible} unidad(es) disponible(s) para este producto."
        )


def _sync_carrito_pk_sequence():
    """Sincroniza la secuencia PK de carrito_carrito con el max(id) actual."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT setval(
                pg_get_serial_sequence('carrito_carrito', 'id'),
                COALESCE((SELECT MAX(id) FROM carrito_carrito), 1),
                (SELECT COUNT(*) > 0 FROM carrito_carrito)
            )
            """
        )


def obtener_o_crear_carrito_activo(*, usuario):
    carrito = Carrito.objects.filter(usuario=usuario, estado="activo").order_by("-updated_at").first()
    if carrito:
        if not usuario and not carrito.invitado_token:
            carrito.ensure_guest_token()
            carrito.save(update_fields=["invitado_token", "updated_at"])
        return carrito

    carrito = Carrito(usuario=usuario, estado="activo", origen="online")
    if not usuario:
        carrito.ensure_guest_token()
    try:
        carrito.save()
    except IntegrityError as exc:
        # Si la secuencia de PK quedo desfasada por carga/restore de datos,
        # la sincronizamos y reintentamos una sola vez.
        if "carrito_carrito_pkey" not in str(exc):
            raise
        _sync_carrito_pk_sequence()
        carrito.pk = None
        carrito.save()
    return carrito


@transaction.atomic
def agregar_item_carrito(*, carrito, producto_id, cantidad):
    if carrito.estado != "activo":
        raise CarritoServiceError("Solo se puede modificar un carrito activo.")
    if cantidad <= 0:
        raise CarritoServiceError("La cantidad debe ser mayor a 0.")

    producto = Producto.objects.filter(id=producto_id, estado=True).first()
    if not producto:
        raise CarritoServiceError("Producto no encontrado o inactivo.")
    inventario = Inventario.objects.select_for_update().filter(producto=producto).first()
    if not inventario:
        raise CarritoServiceError("Inventario no configurado para el producto.")
    stock_disponible = int(inventario.stock_disponible)

    item, created = CarritoItem.objects.select_for_update().get_or_create(
        carrito=carrito,
        producto=producto,
        defaults={"cantidad": cantidad, "precio_unitario": producto.precio_venta, "subtotal": Decimal(producto.precio_venta) * cantidad},
    )

    cantidad_objetivo = cantidad if created else int(item.cantidad) + cantidad
    _validar_stock_para_carrito(disponible=stock_disponible, solicitado=cantidad_objetivo)

    if not created:
        item.cantidad = F("cantidad") + cantidad
        item.save(update_fields=["cantidad", "updated_at"])
        item.refresh_from_db(fields=["cantidad"])
        item.precio_unitario = producto.precio_venta
        item.subtotal = Decimal(item.precio_unitario) * item.cantidad
        item.save(update_fields=["precio_unitario", "subtotal", "updated_at"])
    return item


@transaction.atomic
def actualizar_item_carrito(*, carrito, item_id, cantidad):
    if carrito.estado != "activo":
        raise CarritoServiceError("Solo se puede modificar un carrito activo.")
    if cantidad <= 0:
        raise CarritoServiceError("La cantidad debe ser mayor a 0.")

    item = CarritoItem.objects.select_for_update().filter(id=item_id, carrito=carrito).first()
    if not item:
        raise CarritoServiceError("Item no encontrado en el carrito.")

    inventario = Inventario.objects.select_for_update().filter(producto=item.producto).first()
    if not inventario:
        raise CarritoServiceError("Inventario no configurado para el producto.")
    # Regla profesional de carrito:
    # permitir siempre reducir cantidad aunque el stock actual haya bajado por ventas externas;
    # validar stock solo cuando se intenta aumentar.
    if cantidad > int(item.cantidad):
        stock_disponible = int(inventario.stock_disponible)
        _validar_stock_para_carrito(disponible=stock_disponible, solicitado=cantidad)

    item.cantidad = cantidad
    item.subtotal = Decimal(item.precio_unitario) * cantidad
    item.save(update_fields=["cantidad", "subtotal", "updated_at"])
    return item


@transaction.atomic
def eliminar_item_carrito(*, carrito, item_id):
    if carrito.estado != "activo":
        raise CarritoServiceError("Solo se puede modificar un carrito activo.")
    item = CarritoItem.objects.filter(id=item_id, carrito=carrito).first()
    if not item:
        raise CarritoServiceError("Item no encontrado en el carrito.")
    item.delete()


def calcular_totales_carrito(carrito):
    subtotal = Decimal("0")
    items = carrito.items.select_related("producto").all()
    for item in items:
        subtotal += item.subtotal
    return {"subtotal": subtotal, "total": subtotal, "cantidad_items": items.count()}
