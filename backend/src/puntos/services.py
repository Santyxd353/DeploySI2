from decimal import Decimal, ROUND_FLOOR
from secrets import token_hex

from django.db import transaction
from django.utils import timezone

from clientes.models import Cliente

from .models import CanjePuntos, CatalogoCanje, ConfiguracionPuntos, CuentaPuntos, TransaccionPuntos


def obtener_configuracion(tenant=None):
    qs = ConfiguracionPuntos.objects.all()
    if tenant is not None:
        qs = qs.filter(tenant=tenant)
    configuracion = qs.first()
    if configuracion:
        return configuracion
    return ConfiguracionPuntos.objects.create(tenant=tenant)


def obtener_cuenta(cliente: Cliente):
    cuenta, _ = CuentaPuntos.objects.get_or_create(cliente=cliente, defaults={"tenant": cliente.tenant})
    return cuenta


def calcular_puntos_ganados(total: Decimal, configuracion: ConfiguracionPuntos) -> int:
    if total is None or total <= 0:
        return 0
    if not configuracion.activo or configuracion.bolivianos_por_punto <= 0:
        return 0
    puntos = (Decimal(total) / Decimal(configuracion.bolivianos_por_punto)).quantize(Decimal("1"), rounding=ROUND_FLOOR)
    return max(0, int(puntos))


def _recalcular_nivel(cuenta: CuentaPuntos):
    total = cuenta.puntos_acumulados
    if total >= 10000:
        nivel = "diamante"
    elif total >= 2000:
        nivel = "oro"
    elif total >= 500:
        nivel = "plata"
    else:
        nivel = "bronce"
    if cuenta.nivel != nivel:
        cuenta.nivel = nivel


def generar_codigo_voucher() -> str:
    return token_hex(8).upper()


@transaction.atomic
def registrar_puntos_por_venta(venta):
    if venta is None or venta.estado != "pagada":
        return None

    if TransaccionPuntos.objects.filter(venta=venta, tipo="ganado").exists():
        return None

    configuracion = obtener_configuracion(getattr(venta, "tenant", None))
    puntos = calcular_puntos_ganados(venta.total, configuracion)
    if puntos <= 0:
        return None

    cuenta = obtener_cuenta(venta.cliente)
    cuenta.puntos_disponibles += puntos
    cuenta.puntos_acumulados += puntos
    _recalcular_nivel(cuenta)
    cuenta.save(update_fields=["puntos_disponibles", "puntos_acumulados", "nivel", "actualizado_en"])

    return TransaccionPuntos.objects.create(
        cuenta=cuenta,
        tipo="ganado",
        puntos=puntos,
        saldo_resultante=cuenta.puntos_disponibles,
        venta=venta,
        descripcion=f"Puntos ganados por venta #{venta.pk}",
    )


@transaction.atomic
def revertir_puntos_por_venta(venta):
    transaccion = TransaccionPuntos.objects.filter(venta=venta, tipo="ganado").first()
    if transaccion is None:
        return None

    if TransaccionPuntos.objects.filter(venta=venta, tipo="reverso").exists():
        return None

    cuenta = transaccion.cuenta
    puntos = min(cuenta.puntos_disponibles, abs(transaccion.puntos))
    if puntos <= 0:
        return None

    cuenta.puntos_disponibles -= puntos
    cuenta.puntos_acumulados = max(0, cuenta.puntos_acumulados - puntos)
    _recalcular_nivel(cuenta)
    cuenta.save(update_fields=["puntos_disponibles", "puntos_acumulados", "nivel", "actualizado_en"])

    return TransaccionPuntos.objects.create(
        cuenta=cuenta,
        tipo="reverso",
        puntos=-puntos,
        saldo_resultante=cuenta.puntos_disponibles,
        venta=venta,
        descripcion=f"Reverso de puntos por cancelacion de venta #{venta.pk}",
    )


@transaction.atomic
def canjear_catalogo(cliente: Cliente, catalogo: CatalogoCanje, venta=None):
    cuenta = obtener_cuenta(cliente)
    configuracion = obtener_configuracion(getattr(cliente, "tenant", None))

    if not configuracion.activo:
        raise ValueError("El sistema de puntos esta desactivado.")

    if not catalogo.activo:
        raise ValueError("La recompensa seleccionada no esta disponible.")

    if catalogo.valido_hasta and catalogo.valido_hasta < timezone.localdate():
        raise ValueError("La recompensa seleccionada ya vencio.")

    if cuenta.puntos_disponibles < catalogo.puntos_requeridos:
        raise ValueError("El cliente no tiene suficientes puntos.")

    if catalogo.stock_disponible == 0:
        raise ValueError("La recompensa ya no tiene stock.")

    cuenta.puntos_disponibles -= catalogo.puntos_requeridos
    cuenta.puntos_canjeados += catalogo.puntos_requeridos
    cuenta.save(update_fields=["puntos_disponibles", "puntos_canjeados", "actualizado_en"])

    if catalogo.stock_disponible > 0:
        catalogo.stock_disponible -= 1
        catalogo.save(update_fields=["stock_disponible", "actualizado_en"])

    estado = "pendiente" if catalogo.tipo == "producto_farmacia" else "aplicado"
    canje = CanjePuntos.objects.create(
        cuenta=cuenta,
        catalogo=catalogo,
        venta=venta,
        codigo_voucher=generar_codigo_voucher(),
        puntos_usados=catalogo.puntos_requeridos,
        estado=estado,
        aplicado_en=timezone.now() if estado == "aplicado" else None,
    )

    TransaccionPuntos.objects.create(
        cuenta=cuenta,
        tipo="canjeado",
        puntos=-catalogo.puntos_requeridos,
        saldo_resultante=cuenta.puntos_disponibles,
        canje=canje,
        venta=venta,
        descripcion=f"Canje realizado: {catalogo.nombre}",
    )

    return canje


@transaction.atomic
def ajustar_puntos(cuenta: CuentaPuntos, puntos: int, descripcion: str = "Ajuste manual"):
    if puntos == 0:
        return None

    cuenta.puntos_disponibles = max(0, cuenta.puntos_disponibles + puntos)
    if puntos > 0:
        cuenta.puntos_acumulados += puntos
    else:
        cuenta.puntos_expirados += abs(puntos)
    _recalcular_nivel(cuenta)
    cuenta.save(update_fields=["puntos_disponibles", "puntos_acumulados", "puntos_expirados", "nivel", "actualizado_en"])

    return TransaccionPuntos.objects.create(
        cuenta=cuenta,
        tipo="ajuste",
        puntos=puntos,
        saldo_resultante=cuenta.puntos_disponibles,
        descripcion=descripcion,
    )