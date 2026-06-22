from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from clientes.models import RecetaMedica
from inventarios.models import Inventario, LimiteDispensacion, Producto
from inventarios.services.stock_service import StockServiceError, descontar_stock

from .models import DetalleVenta, Venta, Factura

import stripe  # ← NUEVO

# Configurar Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class VentaServiceError(Exception):
    def __init__(self, message, code="venta_error"):
        super().__init__(message)
        self.code = code


def _validar_limites_dispensacion(cliente, cantidades_por_producto, productos_map):
    """
    Verifica que ningún producto supere su límite legal de dispensación para el cliente.
    Solo aplica cuando existe un LimiteDispensacion configurado para el producto.
    """
    producto_ids = list(cantidades_por_producto.keys())
    limites = {
        lim.producto_id: lim
        for lim in LimiteDispensacion.objects.filter(producto_id__in=producto_ids).select_related("producto")
    }

    if not limites:
        return

    for producto_id, cantidad_solicitada in cantidades_por_producto.items():
        limite = limites.get(producto_id)
        if not limite:
            continue

        fecha_inicio = timezone.now() - timezone.timedelta(days=limite.periodo_dias)
        ya_dispensado = (
            DetalleVenta.objects.filter(
                producto_id=producto_id,
                venta__cliente=cliente,
                venta__estado__in=["pagada", "entregada"],
                venta__created_at__gte=fecha_inicio,
            ).aggregate(total=Sum("cantidad"))["total"]
            or 0
        )

        if ya_dispensado + cantidad_solicitada > limite.cantidad_maxima:
            restante = max(0, limite.cantidad_maxima - ya_dispensado)
            producto = productos_map[producto_id]
            raise VentaServiceError(
                f"Límite de dispensación excedido para '{producto.nombre_comercial}'. "
                f"Puede dispensar hasta {limite.cantidad_maxima} unidad(es) cada {limite.periodo_dias} días. "
                f"Ya dispensó {ya_dispensado} — disponible: {restante} unidad(es).",
                code="limite_dispensacion_excedido",
            )


# ========== STRIPE SERVICES ==========
def crear_payment_intent(total: Decimal, metadata: dict = None) -> dict:
    """Crea un PaymentIntent en Stripe para modo pruebas"""
    amount_cents = int(total * 100)
    
    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency=settings.STRIPE_CURRENCY.lower(),  # 'bob'
        metadata=metadata or {},
        payment_method_types=['card'],
    )
    
    return {
        'client_secret': intent.client_secret,
        'payment_intent_id': intent.id,
        'amount': str((Decimal(intent.amount) / Decimal('100')).quantize(Decimal('0.01'))),
        'currency': intent.currency,
    }


def verificar_payment_intent(payment_intent_id: str) -> dict:
    """Verifica el estado de un PaymentIntent"""
    intent = stripe.PaymentIntent.retrieve(payment_intent_id)
    
    return {
        'id': intent.id,
        'status': intent.status,
        'amount': (Decimal(intent.amount) / Decimal('100')).quantize(Decimal('0.01')),
        'currency': intent.currency,
        'metadata': intent.metadata,
    }


# ========== VENTA SERVICE ==========
@transaction.atomic
def crear_venta_service(
    *,
    cliente,
    items,
    origen,
    vendedor=None,
    estado="pendiente",
    descuento=Decimal("0"),
    impuesto=Decimal("0"),
    observacion="",
    datos_factura=None,
    stripe_payment_intent_id=None,
):
    """
    Crea una venta con todos sus detalles, movimientos de inventario y factura.
    
    Parámetros:
    - datos_factura: dict con 'nombre_cliente', 'email_cliente', 'nit_ci' (opcional)
    """
    if origen not in {"fisica", "online"}:
        raise VentaServiceError("Origen de venta invalido.", code="origen_invalido")
    if not items:
        raise VentaServiceError("La venta debe incluir al menos un item.", code="items_requeridos")
    if origen == "fisica" and vendedor is None:
        raise VentaServiceError("La venta fisica requiere vendedor.", code="vendedor_requerido")
    if origen == "online":
        vendedor = None

    try:
        descuento = Decimal(descuento)
        impuesto = Decimal(impuesto)
    except Exception as exc:
        raise VentaServiceError("Descuento o impuesto invalido.", code="totales_invalidos") from exc
    if descuento < 0 or impuesto < 0:
        raise VentaServiceError("Descuento e impuesto no pueden ser negativos.", code="totales_invalidos")

    producto_ids = []
    cantidades_por_producto = {}
    receta_ids = set()

    for item in items:
        producto_id = item.get("producto_id")
        cantidad = item.get("cantidad")
        receta_id = item.get("receta_id")
        if not producto_id:
            raise VentaServiceError("Cada item debe incluir producto_id.", code="producto_requerido")
        if cantidad is None or int(cantidad) <= 0:
            raise VentaServiceError("La cantidad debe ser mayor a 0.", code="cantidad_invalida")
        cantidad = int(cantidad)
        producto_ids.append(producto_id)
        cantidades_por_producto[producto_id] = cantidades_por_producto.get(producto_id, 0) + cantidad
        if receta_id:
            receta_ids.add(receta_id)

    productos_qs = Producto.objects.filter(id__in=producto_ids, estado=True).select_related("inventario")
    productos_map = {producto.id: producto for producto in productos_qs}
    if len(productos_map) != len(set(producto_ids)):
        missing_ids = sorted(set(producto_ids) - set(productos_map.keys()))
        raise VentaServiceError(f"Productos no encontrados o inactivos: {missing_ids}", code="producto_no_disponible")

    recetas_map = {r.id: r for r in RecetaMedica.objects.filter(id__in=receta_ids)} if receta_ids else {}

    inventarios_qs = Inventario.objects.select_for_update().filter(producto_id__in=producto_ids)
    inventario_map = {inv.producto_id: inv for inv in inventarios_qs}
    if len(inventario_map) != len(set(producto_ids)):
        missing_inventory = sorted(set(producto_ids) - set(inventario_map.keys()))
        raise VentaServiceError(f"Inventario no configurado para productos: {missing_inventory}", code="inventario_faltante")

    for producto_id, cantidad_total in cantidades_por_producto.items():
        inventario = inventario_map[producto_id]
        if inventario.stock_disponible < cantidad_total:
            producto = productos_map[producto_id]
            raise VentaServiceError(
                f"Stock insuficiente para {producto.nombre_comercial} (disponible: {inventario.stock_disponible}, solicitado: {cantidad_total}).",
                code="stock_insuficiente",
            )

    _validar_limites_dispensacion(cliente, cantidades_por_producto, productos_map)

    subtotal_venta = Decimal("0")
    detalles = []
    hoy = timezone.localdate()

    for item in items:
        producto = productos_map[item["producto_id"]]
        cantidad = int(item["cantidad"])
        receta_id = item.get("receta_id")
        receta = recetas_map.get(receta_id) if receta_id else None

        if producto.requiere_receta:
            if not receta:
                raise VentaServiceError(
                    f"El producto {producto.nombre_comercial} requiere receta medica.",
                    code="receta_requerida",
                )
            if receta.cliente_id != cliente.id:
                raise VentaServiceError("La receta no corresponde al cliente.", code="receta_invalida")
            if receta.estado != "aprobada":
                raise VentaServiceError("La receta debe estar aprobada.", code="receta_invalida")
            if receta.fecha_vencimiento and receta.fecha_vencimiento < hoy:
                raise VentaServiceError("La receta esta vencida.", code="receta_vencida")

        precio_unitario = item.get("precio_unitario", producto.precio_venta)
        try:
            precio_unitario = Decimal(precio_unitario)
        except Exception as exc:
            raise VentaServiceError("Precio unitario invalido.", code="precio_invalido") from exc
        if precio_unitario < 0:
            raise VentaServiceError("Precio unitario no puede ser negativo.", code="precio_invalido")

        subtotal_item = precio_unitario * cantidad
        subtotal_venta += subtotal_item
        detalles.append(DetalleVenta(producto=producto, cantidad=cantidad, precio_unitario=precio_unitario, subtotal=subtotal_item))

    total_venta = subtotal_venta - descuento + impuesto
    if total_venta < 0:
        raise VentaServiceError("El total de la venta no puede ser negativo.", code="total_invalido")

    venta = Venta.objects.create(
        cliente=cliente,
        vendedor=vendedor,
        origen=origen,
        estado=estado,
        subtotal=subtotal_venta,
        descuento=descuento,
        impuesto=impuesto,
        total=total_venta,
        stripe_payment_intent_id=stripe_payment_intent_id,
        observacion=observacion,
    )

    tenant = venta.tenant
    for detalle in detalles:
        detalle.venta = venta
        if tenant is not None and detalle.tenant_id is None:
            detalle.tenant = tenant
    DetalleVenta.objects.bulk_create(detalles)

    referencia = f"VENTA-{venta.id}"
    for detalle in detalles:
        try:
            descontar_stock(
                producto=detalle.producto,
                cantidad=detalle.cantidad,
                motivo="venta",
                referencia=referencia,
                usuario=vendedor,
                observacion=f"Salida por venta #{venta.id}",
                lote=None,
            )
        except StockServiceError as exc:
            raise VentaServiceError(str(exc), code="stock_insuficiente") from exc

    # ========== CREAR FACTURA ==========
    if datos_factura:
        nombre_cliente = datos_factura.get('nombre_cliente', cliente.nombres or 'Cliente')
        email_cliente = datos_factura.get('email_cliente', cliente.email or 'cliente@email.com')
        nit_ci = datos_factura.get('nit_ci', '')
        tipo_factura = datos_factura.get('tipo', 'simple')
    else:
        nombre_cliente = cliente.nombres if cliente.nombres else 'Cliente'
        email_cliente = cliente.email if cliente.email else 'cliente@email.com'
        nit_ci = ''
        tipo_factura = 'simple'
    
    Factura.objects.create(
        venta=venta,
        tipo=tipo_factura,
        nombre_cliente=nombre_cliente,
        email_cliente=email_cliente,
        nit_ci=nit_ci,
    )
    # ==================================

    return venta
