from django.db import migrations


def backfill_movimiento_balances(apps, schema_editor):
    Producto = apps.get_model("inventarios", "Producto")
    MovimientoInventario = apps.get_model("inventarios", "MovimientoInventario")

    for producto in Producto.objects.all().only("id"):
        saldo = 0
        movimientos = (
            MovimientoInventario.objects
            .filter(producto_id=producto.id)
            .order_by("fecha_movimiento", "id")
        )
        for movimiento in movimientos:
            if movimiento.stock_anterior is not None and movimiento.stock_posterior is not None:
                saldo = movimiento.stock_posterior
                continue

            anterior = saldo
            cantidad = int(movimiento.cantidad or 0)
            if movimiento.tipo_movimiento == "salida":
                saldo = max(0, saldo - cantidad)
            elif movimiento.tipo_movimiento == "ajuste":
                saldo = cantidad
            else:
                saldo += cantidad

            MovimientoInventario.objects.filter(pk=movimiento.pk).update(
                stock_anterior=anterior,
                stock_posterior=saldo,
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("inventarios", "0010_cleanup_entradastock_legacy_fields"),
    ]

    operations = [
        migrations.RunPython(backfill_movimiento_balances, noop_reverse),
    ]
