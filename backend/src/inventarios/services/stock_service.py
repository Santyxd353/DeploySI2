from django.db import transaction
from django.db.models import F
from django.utils import timezone

from inventarios.models import Inventario, MovimientoInventario


class StockServiceError(Exception):
    pass


def _get_inventario_for_update(producto):
    inventario = (
        Inventario.objects.select_for_update()
        .filter(producto=producto)
        .first()
    )
    if inventario is None:
        inventario = Inventario.objects.create(
            producto=producto,
            stock_minimo=producto.stock_minimo,
        )
    return inventario


def validar_stock(producto, cantidad):
    inventario = Inventario.objects.filter(producto=producto).first()
    if inventario is None:
        return False
    return inventario.stock_disponible >= int(cantidad)


@transaction.atomic
def aumentar_stock(*, producto, cantidad, motivo, referencia="", usuario=None, observacion="", fecha_movimiento=None, lote=None):
    cantidad = int(cantidad)
    if cantidad <= 0:
        raise StockServiceError("La cantidad debe ser mayor a 0.")
    if lote is not None and getattr(lote, "estado", "") != "disponible":
        raise StockServiceError("No se puede operar con un lote que no está disponible.")

    inventario = _get_inventario_for_update(producto)
    stock_anterior = inventario.stock_actual
    inventario.stock_actual = F("stock_actual") + cantidad
    inventario.ultima_entrada_fecha = fecha_movimiento or timezone.now()
    inventario.save(update_fields=["stock_actual", "ultima_entrada_fecha", "updated_at"])
    inventario.refresh_from_db(fields=["stock_actual", "stock_reservado", "ultima_entrada_fecha"])

    movimiento = MovimientoInventario.objects.create(
        producto=producto,
        lote=lote,
        tipo_movimiento="entrada",
        cantidad=cantidad,
        stock_anterior=stock_anterior,
        stock_posterior=inventario.stock_actual,
        motivo=motivo,
        referencia=referencia or "",
        usuario=usuario,
        observacion=observacion or "",
    )
    return inventario, movimiento, stock_anterior, inventario.stock_actual


@transaction.atomic
def descontar_stock(*, producto, cantidad, motivo, referencia="", usuario=None, observacion="", fecha_movimiento=None, lote=None):
    cantidad = int(cantidad)
    if cantidad <= 0:
        raise StockServiceError("La cantidad debe ser mayor a 0.")
    if lote is not None and getattr(lote, "estado", "") != "disponible":
        raise StockServiceError("No se puede operar con un lote que no está disponible.")

    inventario = _get_inventario_for_update(producto)
    stock_anterior = inventario.stock_actual
    if inventario.stock_disponible < cantidad:
        raise StockServiceError(
            f"Stock insuficiente. Disponible: {inventario.stock_disponible}, solicitado: {cantidad}."
        )

    inventario.stock_actual = F("stock_actual") - cantidad
    inventario.ultima_salida_fecha = fecha_movimiento or timezone.now()
    inventario.save(update_fields=["stock_actual", "ultima_salida_fecha", "updated_at"])
    inventario.refresh_from_db(fields=["stock_actual", "stock_reservado", "ultima_salida_fecha"])

    movimiento = MovimientoInventario.objects.create(
        producto=producto,
        lote=lote,
        tipo_movimiento="salida",
        cantidad=cantidad,
        stock_anterior=stock_anterior,
        stock_posterior=inventario.stock_actual,
        motivo=motivo,
        referencia=referencia or "",
        usuario=usuario,
        observacion=observacion or "",
    )
    return inventario, movimiento, stock_anterior, inventario.stock_actual


@transaction.atomic
def ajustar_stock(*, producto, nuevo_stock, motivo, referencia="", usuario=None, observacion="", fecha_movimiento=None, lote=None):
    nuevo_stock = int(nuevo_stock)
    if nuevo_stock < 0:
        raise StockServiceError("El stock no puede ser negativo.")

    inventario = _get_inventario_for_update(producto)
    stock_anterior = inventario.stock_actual
    inventario.stock_actual = nuevo_stock
    inventario.save(update_fields=["stock_actual", "updated_at"])
    inventario.refresh_from_db(fields=["stock_actual", "stock_reservado"])

    movimiento = MovimientoInventario.objects.create(
        producto=producto,
        lote=lote,
        tipo_movimiento="ajuste",
        cantidad=abs(nuevo_stock - stock_anterior),
        stock_anterior=stock_anterior,
        stock_posterior=inventario.stock_actual,
        motivo=motivo,
        referencia=referencia or "",
        usuario=usuario,
        observacion=observacion or "",
        fecha_movimiento=fecha_movimiento or timezone.now(),
    )
    return inventario, movimiento, stock_anterior, inventario.stock_actual


@transaction.atomic
def reservar_stock(*, producto, cantidad):
    cantidad = int(cantidad)
    if cantidad <= 0:
        raise StockServiceError("La cantidad a reservar debe ser mayor a 0.")

    inventario = _get_inventario_for_update(producto)
    if inventario.stock_disponible < cantidad:
        raise StockServiceError("Stock insuficiente para reserva.")

    inventario.stock_reservado = F("stock_reservado") + cantidad
    inventario.save(update_fields=["stock_reservado", "updated_at"])
    inventario.refresh_from_db(fields=["stock_actual", "stock_reservado"])
    return inventario
