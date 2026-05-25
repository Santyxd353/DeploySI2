import base64
import json
from datetime import date, datetime, time, timedelta
from decimal import Decimal

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, F, Max, Sum
from django.db.models.functions import ExtractHour, ExtractWeekDay, TruncDate, TruncMonth
from django.utils import timezone

from clientes.models import Cliente, RecetaMedica
from core.models import BitacoraSistema
from inventarios.models import Categoria, EntradaStock, Inventario, Laboratorio, MovimientoInventario, Producto, Subcategoria
from ventas.models import DetalleVenta, Factura, Venta


MAX_AUDIO_BYTES = 25 * 1024 * 1024

PERIODOS = [
    {"value": "hoy", "label": "Hoy"},
    {"value": "ayer", "label": "Ayer"},
    {"value": "esta_semana", "label": "Esta semana"},
    {"value": "semana_pasada", "label": "Semana pasada"},
    {"value": "este_mes", "label": "Este mes"},
    {"value": "mes_pasado", "label": "Mes pasado"},
    {"value": "este_anio", "label": "Este anio"},
    {"value": "personalizado", "label": "Rango personalizado"},
    {"value": "todo", "label": "Todo el historial"},
]

ESTADOS_VENTA = [{"value": value, "label": label} for value, label in Venta.ESTADO_CHOICES]
ORIGENES_VENTA = [{"value": value, "label": label} for value, label in Venta.ORIGEN_CHOICES]
TIPOS_CLIENTE = [{"value": value, "label": label} for value, label in Cliente.TIPO_CHOICES]
ESTADOS_RECETA = [{"value": value, "label": label} for value, label in RecetaMedica.ESTADO_CHOICES]
ESTADOS_STOCK = [
    {"value": "disponible", "label": "Disponible"},
    {"value": "stock_bajo", "label": "Stock bajo"},
    {"value": "sin_stock", "label": "Sin stock"},
    {"value": "exceso_stock", "label": "Exceso de stock"},
]
TIPOS_MOVIMIENTO = [{"value": value, "label": label} for value, label in MovimientoInventario.TIPO_MOVIMIENTO_CHOICES]
RESULTADOS_BITACORA = [
    {"value": "SUCCESS", "label": "Exitoso"},
    {"value": "FAILURE", "label": "Fallido"},
]
ORDENES_REPORTE = [
    {"value": "valor_desc", "label": "Valor principal mayor a menor"},
    {"value": "valor_asc", "label": "Valor principal menor a mayor"},
    {"value": "nombre_asc", "label": "Nombre A-Z"},
    {"value": "nombre_desc", "label": "Nombre Z-A"},
    {"value": "fecha_desc", "label": "Fecha reciente primero"},
    {"value": "fecha_asc", "label": "Fecha antigua primero"},
    {"value": "cantidad_desc", "label": "Cantidad mayor a menor"},
    {"value": "cantidad_asc", "label": "Cantidad menor a mayor"},
    {"value": "total_desc", "label": "Total mayor a menor"},
    {"value": "total_asc", "label": "Total menor a mayor"},
    {"value": "stock_desc", "label": "Stock mayor a menor"},
    {"value": "stock_asc", "label": "Stock menor a mayor"},
    {"value": "ventas_desc", "label": "Unidades vendidas"},
    {"value": "ingresos_desc", "label": "Ingresos"},
    {"value": "precio_desc", "label": "Precio mayor a menor"},
    {"value": "precio_asc", "label": "Precio menor a mayor"},
]

FILTER_DEFINITIONS = {
    "periodo": {"id": "periodo", "label": "Periodo", "type": "select", "options": PERIODOS},
    "fecha_inicio": {"id": "fecha_inicio", "label": "Fecha inicio", "type": "date"},
    "fecha_fin": {"id": "fecha_fin", "label": "Fecha fin", "type": "date"},
    "origen": {"id": "origen", "label": "Origen", "type": "select", "options": ORIGENES_VENTA},
    "estado": {"id": "estado", "label": "Estado", "type": "select", "options": ESTADOS_VENTA},
    "vendedor": {"id": "vendedor", "label": "Vendedor", "type": "select", "options_key": "vendedores"},
    "cliente": {"id": "cliente", "label": "Cliente", "type": "select", "options_key": "clientes"},
    "monto_min": {"id": "monto_min", "label": "Monto minimo", "type": "number"},
    "monto_max": {"id": "monto_max", "label": "Monto maximo", "type": "number"},
    "categoria": {"id": "categoria", "label": "Categoria", "type": "select", "options_key": "categorias"},
    "subcategoria": {"id": "subcategoria", "label": "Subcategoria", "type": "select", "options_key": "subcategorias"},
    "laboratorio": {"id": "laboratorio", "label": "Laboratorio", "type": "select", "options_key": "laboratorios"},
    "producto": {"id": "producto", "label": "Producto", "type": "select", "options_key": "productos"},
    "sku": {"id": "sku", "label": "SKU", "type": "text"},
    "requiere_receta": {"id": "requiere_receta", "label": "Requiere receta", "type": "boolean"},
    "es_controlado": {"id": "es_controlado", "label": "Controlado", "type": "boolean"},
    "stock_estado": {"id": "stock_estado", "label": "Estado de stock", "type": "select", "options": ESTADOS_STOCK},
    "stock_min": {"id": "stock_min", "label": "Stock minimo", "type": "number"},
    "stock_max": {"id": "stock_max", "label": "Stock maximo", "type": "number"},
    "tipo_movimiento": {"id": "tipo_movimiento", "label": "Tipo movimiento", "type": "select", "options": TIPOS_MOVIMIENTO},
    "tipo_cliente": {"id": "tipo_cliente", "label": "Tipo cliente", "type": "select", "options": TIPOS_CLIENTE},
    "estado_receta": {"id": "estado_receta", "label": "Estado receta", "type": "select", "options": ESTADOS_RECETA},
    "modulo": {"id": "modulo", "label": "Modulo", "type": "select", "options_key": "modulos_bitacora"},
    "accion": {"id": "accion", "label": "Accion", "type": "select", "options_key": "acciones_bitacora"},
    "resultado": {"id": "resultado", "label": "Resultado", "type": "select", "options": RESULTADOS_BITACORA},
    "usuario": {"id": "usuario", "label": "Usuario", "type": "select", "options_key": "usuarios"},
    "top": {"id": "top", "label": "Top", "type": "number", "default": 10, "min": 1, "max": 100},
    "ordenar_por": {"id": "ordenar_por", "label": "Ordenar por", "type": "select", "options": ORDENES_REPORTE},
    "agrupacion": {
        "id": "agrupacion",
        "label": "Agrupar por",
        "type": "select",
        "options": [
            {"value": "dia", "label": "Dia"},
            {"value": "mes", "label": "Mes"},
        ],
    },
}

COMMON_DATE_FILTERS = ["periodo", "fecha_inicio", "fecha_fin"]
VENTA_FILTERS = COMMON_DATE_FILTERS + ["origen", "estado", "vendedor", "cliente", "monto_min", "monto_max"]
PRODUCTO_FILTERS = ["categoria", "subcategoria", "laboratorio", "producto", "sku", "requiere_receta", "es_controlado", "ordenar_por", "top"]
GLOBAL_REPORT_FILTERS = ["ordenar_por"]

REPORT_TYPES = [
    {"id": "ventas_resumen", "label": "Resumen de ventas", "categoria": "Ventas", "filtros": VENTA_FILTERS},
    {"id": "ventas_detalle", "label": "Detalle de ventas", "categoria": "Ventas", "filtros": VENTA_FILTERS + ["top"]},
    {"id": "ventas_tendencia", "label": "Ventas por periodo", "categoria": "Ventas", "filtros": VENTA_FILTERS + ["agrupacion"]},
    {"id": "ventas_por_origen", "label": "Ventas por origen", "categoria": "Ventas", "filtros": VENTA_FILTERS},
    {"id": "ventas_por_estado", "label": "Ventas por estado", "categoria": "Ventas", "filtros": VENTA_FILTERS},
    {"id": "ventas_por_vendedor", "label": "Ventas por vendedor", "categoria": "Ventas", "filtros": VENTA_FILTERS + ["top"]},
    {"id": "ventas_por_cliente", "label": "Ventas por cliente", "categoria": "Ventas", "filtros": VENTA_FILTERS + ["tipo_cliente", "top"]},
    {"id": "ventas_por_hora", "label": "Ventas por hora", "categoria": "Ventas", "filtros": VENTA_FILTERS},
    {"id": "ventas_por_dia_semana", "label": "Ventas por dia de semana", "categoria": "Ventas", "filtros": VENTA_FILTERS},
    {"id": "ventas_canceladas", "label": "Ventas canceladas", "categoria": "Ventas", "filtros": VENTA_FILTERS + ["top"]},
    {"id": "descuentos_aplicados", "label": "Descuentos aplicados", "categoria": "Ventas", "filtros": VENTA_FILTERS + ["agrupacion"]},
    {"id": "impuestos_cobrados", "label": "Impuestos cobrados", "categoria": "Ventas", "filtros": VENTA_FILTERS + ["agrupacion"]},
    {"id": "ticket_promedio", "label": "Ticket promedio", "categoria": "Ventas", "filtros": VENTA_FILTERS},
    {"id": "facturas_emitidas", "label": "Facturas emitidas", "categoria": "Ventas", "filtros": COMMON_DATE_FILTERS + ["cliente", "top"]},
    {"id": "productos_mas_vendidos", "label": "Productos mas vendidos", "categoria": "Productos", "filtros": VENTA_FILTERS + PRODUCTO_FILTERS},
    {"id": "medicamentos_mas_vendidos", "label": "Medicamentos mas vendidos", "categoria": "Productos", "filtros": VENTA_FILTERS + PRODUCTO_FILTERS},
    {"id": "productos_menos_vendidos", "label": "Productos menos vendidos", "categoria": "Productos", "filtros": VENTA_FILTERS + PRODUCTO_FILTERS},
    {"id": "medicamentos_menos_vendidos", "label": "Medicamentos menos vendidos", "categoria": "Productos", "filtros": VENTA_FILTERS + PRODUCTO_FILTERS},
    {"id": "productos_sin_ventas", "label": "Productos sin ventas", "categoria": "Productos", "filtros": VENTA_FILTERS + PRODUCTO_FILTERS + ["stock_estado"]},
    {"id": "productos_mayores_ingresos", "label": "Productos con mayores ingresos", "categoria": "Productos", "filtros": VENTA_FILTERS + PRODUCTO_FILTERS},
    {"id": "rentabilidad_productos", "label": "Rentabilidad por producto", "categoria": "Productos", "filtros": VENTA_FILTERS + PRODUCTO_FILTERS},
    {"id": "rotacion_productos", "label": "Rotacion de productos", "categoria": "Productos", "filtros": VENTA_FILTERS + PRODUCTO_FILTERS + ["stock_estado"]},
    {"id": "ventas_por_categoria", "label": "Ventas por categoria", "categoria": "Productos", "filtros": VENTA_FILTERS + ["categoria", "top"]},
    {"id": "ventas_por_laboratorio", "label": "Ventas por laboratorio", "categoria": "Productos", "filtros": VENTA_FILTERS + ["laboratorio", "top"]},
    {"id": "stock_actual", "label": "Stock actual", "categoria": "Inventario", "filtros": PRODUCTO_FILTERS + ["stock_estado", "stock_min", "stock_max"]},
    {"id": "stock_bajo", "label": "Stock bajo", "categoria": "Inventario", "filtros": PRODUCTO_FILTERS},
    {"id": "sin_stock", "label": "Sin stock", "categoria": "Inventario", "filtros": PRODUCTO_FILTERS},
    {"id": "exceso_stock", "label": "Exceso de stock", "categoria": "Inventario", "filtros": PRODUCTO_FILTERS + ["stock_min"]},
    {"id": "valor_inventario", "label": "Valor de inventario", "categoria": "Inventario", "filtros": PRODUCTO_FILTERS + ["stock_estado", "stock_min", "stock_max"]},
    {"id": "valor_inventario_categoria", "label": "Valor de inventario por categoria", "categoria": "Inventario", "filtros": PRODUCTO_FILTERS + ["stock_estado", "stock_min", "stock_max"]},
    {"id": "valor_inventario_laboratorio", "label": "Valor de inventario por laboratorio", "categoria": "Inventario", "filtros": PRODUCTO_FILTERS + ["stock_estado", "stock_min", "stock_max"]},
    {"id": "stock_reservado", "label": "Stock reservado", "categoria": "Inventario", "filtros": PRODUCTO_FILTERS + ["stock_min", "stock_max"]},
    {"id": "movimientos_inventario", "label": "Movimientos de inventario", "categoria": "Inventario", "filtros": COMMON_DATE_FILTERS + PRODUCTO_FILTERS + ["tipo_movimiento"]},
    {"id": "entradas_stock", "label": "Entradas de stock", "categoria": "Inventario", "filtros": COMMON_DATE_FILTERS + PRODUCTO_FILTERS},
    {"id": "salidas_por_venta", "label": "Salidas por venta", "categoria": "Inventario", "filtros": COMMON_DATE_FILTERS + PRODUCTO_FILTERS},
    {"id": "entradas_por_producto", "label": "Entradas por producto", "categoria": "Inventario", "filtros": COMMON_DATE_FILTERS + PRODUCTO_FILTERS + ["tipo_movimiento"]},
    {"id": "salidas_por_producto", "label": "Salidas por producto", "categoria": "Inventario", "filtros": COMMON_DATE_FILTERS + PRODUCTO_FILTERS + ["tipo_movimiento"]},
    {"id": "movimientos_por_tipo", "label": "Movimientos por tipo", "categoria": "Inventario", "filtros": COMMON_DATE_FILTERS + PRODUCTO_FILTERS + ["tipo_movimiento"]},
    {"id": "mejores_clientes", "label": "Clientes con mas compras", "categoria": "Clientes", "filtros": VENTA_FILTERS + ["tipo_cliente", "top"]},
    {"id": "clientes_nuevos", "label": "Clientes nuevos", "categoria": "Clientes", "filtros": COMMON_DATE_FILTERS + ["tipo_cliente", "top"]},
    {"id": "clientes_sin_compras", "label": "Clientes sin compras", "categoria": "Clientes", "filtros": VENTA_FILTERS + ["tipo_cliente", "top"]},
    {"id": "clientes_por_tipo", "label": "Clientes por tipo", "categoria": "Clientes", "filtros": COMMON_DATE_FILTERS + ["tipo_cliente"]},
    {"id": "frecuencia_clientes", "label": "Frecuencia de compra por cliente", "categoria": "Clientes", "filtros": VENTA_FILTERS + ["tipo_cliente", "top"]},
    {"id": "ventas_por_tipo_cliente", "label": "Ventas por tipo de cliente", "categoria": "Clientes", "filtros": VENTA_FILTERS + ["tipo_cliente"]},
    {"id": "recetas_por_estado", "label": "Recetas por estado", "categoria": "Recetas", "filtros": COMMON_DATE_FILTERS + ["estado_receta"]},
    {"id": "recetas_vencidas", "label": "Recetas vencidas", "categoria": "Recetas", "filtros": COMMON_DATE_FILTERS + ["cliente"]},
    {"id": "recetas_detalle", "label": "Detalle de recetas", "categoria": "Recetas", "filtros": COMMON_DATE_FILTERS + ["estado_receta", "cliente", "top"]},
    {"id": "recetas_por_cliente", "label": "Recetas por cliente", "categoria": "Recetas", "filtros": COMMON_DATE_FILTERS + ["estado_receta", "cliente", "top"]},
    {"id": "actividad_por_modulo", "label": "Actividad por modulo", "categoria": "Bitacora", "filtros": COMMON_DATE_FILTERS + ["modulo", "resultado", "usuario", "top"]},
    {"id": "actividad_por_usuario", "label": "Actividad por usuario", "categoria": "Bitacora", "filtros": COMMON_DATE_FILTERS + ["modulo", "resultado", "usuario", "top"]},
    {"id": "eventos_fallidos", "label": "Eventos fallidos", "categoria": "Bitacora", "filtros": COMMON_DATE_FILTERS + ["modulo", "accion", "usuario", "top"]},
    {"id": "eventos_por_resultado", "label": "Eventos por resultado", "categoria": "Bitacora", "filtros": COMMON_DATE_FILTERS + ["modulo", "accion", "usuario", "resultado", "top"]},
    {"id": "acciones_por_usuario", "label": "Acciones por usuario", "categoria": "Bitacora", "filtros": COMMON_DATE_FILTERS + ["modulo", "accion", "usuario", "resultado", "top"]},
    {"id": "bitacora_detalle", "label": "Detalle de bitacora", "categoria": "Bitacora", "filtros": COMMON_DATE_FILTERS + ["modulo", "accion", "usuario", "resultado", "top"]},
]

REPORT_BY_ID = {item["id"]: item for item in REPORT_TYPES}


class ReporteError(Exception):
    def __init__(self, message, code="reporte_error"):
        super().__init__(message)
        self.code = code


def _to_decimal(value):
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except Exception as exc:
        raise ReporteError("Filtro numerico invalido.", code="filtro_invalido") from exc


def _to_int(value, default=10, max_value=100):
    if value in (None, ""):
        return default
    try:
        parsed = int(value)
    except Exception as exc:
        raise ReporteError("Filtro entero invalido.", code="filtro_invalido") from exc
    return max(1, min(parsed, max_value))


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError as exc:
        raise ReporteError("Fecha invalida. Usa formato YYYY-MM-DD.", code="fecha_invalida") from exc


def _date_bounds(start_date, end_date):
    tz = timezone.get_current_timezone()
    start_dt = timezone.make_aware(datetime.combine(start_date, time.min), tz)
    end_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min), tz)
    return start_dt, end_dt


def resolver_rango_fechas(filtros):
    periodo = filtros.get("periodo") or "este_mes"
    today = timezone.localdate()

    if periodo == "todo":
        return None, None, "Todo el historial"

    if periodo == "personalizado":
        start = _parse_date(filtros.get("fecha_inicio")) or today.replace(day=1)
        end = _parse_date(filtros.get("fecha_fin")) or today
    elif periodo == "hoy":
        start = end = today
    elif periodo == "ayer":
        start = end = today - timedelta(days=1)
    elif periodo == "esta_semana":
        start = today - timedelta(days=today.weekday())
        end = today
    elif periodo == "semana_pasada":
        this_week = today - timedelta(days=today.weekday())
        start = this_week - timedelta(days=7)
        end = this_week - timedelta(days=1)
    elif periodo == "mes_pasado":
        first_this_month = today.replace(day=1)
        end = first_this_month - timedelta(days=1)
        start = end.replace(day=1)
    elif periodo == "este_anio":
        start = today.replace(month=1, day=1)
        end = today
    else:
        start = today.replace(day=1)
        end = today

    if start > end:
        raise ReporteError("La fecha inicio no puede ser mayor a la fecha fin.", code="fecha_invalida")

    start_dt, end_dt = _date_bounds(start, end)
    return start_dt, end_dt, f"{start.isoformat()} a {end.isoformat()}"


def _money(value):
    return float(value or Decimal("0"))


def _value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if value is None:
        return ""
    return value


def _rows(queryset):
    return [{key: _value(value) for key, value in row.items()} for row in queryset]


def _metric(label, value, tone="neutral"):
    return {"label": label, "value": _value(value), "tone": tone}


def _column(key, label, type_="text"):
    return {"key": key, "label": label, "type": type_}


def _merge_filters(filters, extra_filters):
    merged = list(filters or [])
    for filter_id in extra_filters:
        if filter_id not in merged:
            merged.append(filter_id)
    return merged


def _base_response(titulo, tipo_reporte, filtros, metricas, columnas, filas, grafico=None, periodo_label=""):
    return {
        "titulo": titulo,
        "tipo_reporte": tipo_reporte,
        "periodo": periodo_label,
        "filtros_aplicados": filtros,
        "metricas": metricas,
        "columnas": columnas,
        "filas": filas,
        "grafico": grafico or {},
        "generado_en": timezone.now().isoformat(),
    }


def _apply_date(qs, field, filtros):
    start, end, label = resolver_rango_fechas(filtros)
    if start and end:
        qs = qs.filter(**{f"{field}__gte": start, f"{field}__lt": end})
    return qs, label


def _filter_by_id(qs, field, value):
    if value not in (None, ""):
        return qs.filter(**{field: value})
    return qs


def _apply_venta_filters(qs, filtros):
    qs, periodo_label = _apply_date(qs, "created_at", filtros)
    qs = _filter_by_id(qs, "origen", filtros.get("origen"))
    qs = _filter_by_id(qs, "estado", filtros.get("estado"))
    qs = _filter_by_id(qs, "vendedor_id", filtros.get("vendedor"))
    qs = _filter_by_id(qs, "cliente_id", filtros.get("cliente"))
    min_total = _to_decimal(filtros.get("monto_min"))
    max_total = _to_decimal(filtros.get("monto_max"))
    if min_total is not None:
        qs = qs.filter(total__gte=min_total)
    if max_total is not None:
        qs = qs.filter(total__lte=max_total)
    return qs, periodo_label


def _apply_producto_filters(qs, filtros, prefix=""):
    field = lambda name: f"{prefix}{name}" if prefix else name
    qs = _filter_by_id(qs, field("categoria_id"), filtros.get("categoria"))
    qs = _filter_by_id(qs, field("subcategoria_id"), filtros.get("subcategoria"))
    qs = _filter_by_id(qs, field("laboratorio_id"), filtros.get("laboratorio"))
    qs = _filter_by_id(qs, field("id"), filtros.get("producto"))
    if filtros.get("sku"):
        qs = qs.filter(**{f"{field('sku')}__icontains": filtros.get("sku")})
    for key in ["requiere_receta", "es_controlado"]:
        if filtros.get(key) not in (None, ""):
            value = str(filtros.get(key)).lower() == "true"
            qs = qs.filter(**{field(key): value})
    return qs


def _apply_detalle_producto_filters(qs, filtros):
    qs = _filter_by_id(qs, "producto__categoria_id", filtros.get("categoria"))
    qs = _filter_by_id(qs, "producto__subcategoria_id", filtros.get("subcategoria"))
    qs = _filter_by_id(qs, "producto__laboratorio_id", filtros.get("laboratorio"))
    qs = _filter_by_id(qs, "producto_id", filtros.get("producto"))
    if filtros.get("sku"):
        qs = qs.filter(producto__sku__icontains=filtros.get("sku"))
    if filtros.get("requiere_receta") not in (None, ""):
        qs = qs.filter(producto__requiere_receta=str(filtros.get("requiere_receta")).lower() == "true")
    if filtros.get("es_controlado") not in (None, ""):
        qs = qs.filter(producto__es_controlado=str(filtros.get("es_controlado")).lower() == "true")
    return qs


def _venta_qs(filtros):
    return _apply_venta_filters(Venta.objects.select_related("cliente", "vendedor"), filtros)


def _detalle_qs(filtros):
    ventas, periodo_label = _venta_qs(filtros)
    qs = DetalleVenta.objects.filter(venta__in=ventas).select_related("producto", "venta")
    return _apply_detalle_producto_filters(qs, filtros), periodo_label


def _stock_estado(stock_actual, stock_minimo):
    if stock_actual <= 0:
        return "Sin stock"
    if stock_actual <= stock_minimo:
        return "Stock bajo"
    return "Disponible"


def _stock_qs(filtros):
    qs = Producto.objects.select_related("categoria", "subcategoria", "laboratorio", "inventario").filter(estado=True)
    qs = _apply_producto_filters(qs, filtros)
    estado = filtros.get("stock_estado")
    if estado == "sin_stock":
        qs = qs.filter(inventario__stock_actual__lte=0)
    elif estado == "stock_bajo":
        qs = qs.filter(inventario__stock_actual__gt=0, inventario__stock_actual__lte=F("stock_minimo"))
    elif estado == "disponible":
        qs = qs.filter(inventario__stock_actual__gt=F("stock_minimo"))
    elif estado == "exceso_stock":
        qs = qs.filter(inventario__stock_actual__gte=F("stock_minimo") * 3)
    if filtros.get("stock_min") not in (None, ""):
        qs = qs.filter(inventario__stock_actual__gte=_to_int(filtros.get("stock_min"), 0, 1_000_000))
    if filtros.get("stock_max") not in (None, ""):
        qs = qs.filter(inventario__stock_actual__lte=_to_int(filtros.get("stock_max"), 0, 1_000_000))
    return qs


def _sales_metrics(qs):
    agg = qs.aggregate(total=Sum("total"), cantidad=Count("id"))
    cantidad = agg["cantidad"] or 0
    total = _money(agg["total"])
    promedio = total / cantidad if cantidad else 0
    return [
        _metric("Ventas", cantidad),
        _metric("Total Bs", round(total, 2), "success"),
        _metric("Ticket promedio Bs", round(promedio, 2)),
    ]


def reporte_ventas_resumen(tipo, filtros):
    qs, periodo_label = _venta_qs(filtros)
    filas = _rows(
        qs.values("origen", "estado")
        .annotate(cantidad=Count("id"), total=Sum("total"))
        .order_by("-total")
    )
    return _base_response(
        "Resumen de ventas",
        tipo,
        filtros,
        _sales_metrics(qs),
        [_column("origen", "Origen"), _column("estado", "Estado"), _column("cantidad", "Ventas", "number"), _column("total", "Total Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "estado", "value_key": "total"},
        periodo_label,
    )


def reporte_ventas_detalle(tipo, filtros):
    top = _to_int(filtros.get("top"), 50, 200)
    qs, periodo_label = _venta_qs(filtros)
    filas = []
    for venta in qs.order_by("-created_at")[:top]:
        filas.append({
            "id": venta.id,
            "fecha": _value(venta.created_at),
            "cliente": str(venta.cliente),
            "origen": venta.get_origen_display(),
            "estado": venta.get_estado_display(),
            "total": _money(venta.total),
        })
    return _base_response(
        "Detalle de ventas",
        tipo,
        filtros,
        _sales_metrics(qs),
        [_column("id", "Venta", "number"), _column("fecha", "Fecha", "datetime"), _column("cliente", "Cliente"), _column("origen", "Origen"), _column("estado", "Estado"), _column("total", "Total Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "cliente", "value_key": "total"},
        periodo_label,
    )


def reporte_ventas_tendencia(tipo, filtros):
    qs, periodo_label = _venta_qs(filtros)
    trunc = TruncMonth("created_at") if filtros.get("agrupacion") == "mes" else TruncDate("created_at")
    filas = _rows(qs.annotate(periodo_grupo=trunc).values("periodo_grupo").annotate(cantidad=Count("id"), total=Sum("total")).order_by("periodo_grupo"))
    return _base_response(
        "Ventas por periodo",
        tipo,
        filtros,
        _sales_metrics(qs),
        [_column("periodo_grupo", "Periodo"), _column("cantidad", "Ventas", "number"), _column("total", "Total Bs", "currency")],
        filas,
        {"tipo": "line", "label_key": "periodo_grupo", "value_key": "total"},
        periodo_label,
    )


def reporte_ventas_por_hora(tipo, filtros):
    qs, periodo_label = _venta_qs(filtros)
    filas = _rows(
        qs.annotate(hora=ExtractHour("created_at"))
        .values("hora")
        .annotate(cantidad=Count("id"), total=Sum("total"))
        .order_by("hora")
    )
    for row in filas:
        hora = row.get("hora")
        row["hora_label"] = f"{int(hora or 0):02d}:00"
    return _base_response(
        "Ventas por hora",
        tipo,
        filtros,
        _sales_metrics(qs),
        [_column("hora_label", "Hora"), _column("cantidad", "Ventas", "number"), _column("total", "Total Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "hora_label", "value_key": "total"},
        periodo_label,
    )


def reporte_ventas_por_dia_semana(tipo, filtros):
    nombres = {
        1: "Domingo",
        2: "Lunes",
        3: "Martes",
        4: "Miercoles",
        5: "Jueves",
        6: "Viernes",
        7: "Sabado",
    }
    qs, periodo_label = _venta_qs(filtros)
    filas = _rows(
        qs.annotate(dia=ExtractWeekDay("created_at"))
        .values("dia")
        .annotate(cantidad=Count("id"), total=Sum("total"))
        .order_by("dia")
    )
    for row in filas:
        row["dia_label"] = nombres.get(row.get("dia"), "Sin dato")
    return _base_response(
        "Ventas por dia de semana",
        tipo,
        filtros,
        _sales_metrics(qs),
        [_column("dia_label", "Dia"), _column("cantidad", "Ventas", "number"), _column("total", "Total Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "dia_label", "value_key": "total"},
        periodo_label,
    )


def reporte_ventas_canceladas(tipo, filtros):
    filtros = {**filtros, "estado": "cancelada"}
    top = _to_int(filtros.get("top"), 50, 200)
    qs, periodo_label = _venta_qs(filtros)
    filas = []
    for venta in qs.order_by("-created_at")[:top]:
        filas.append({
            "id": venta.id,
            "fecha": _value(venta.created_at),
            "cliente": str(venta.cliente),
            "origen": venta.get_origen_display(),
            "total": _money(venta.total),
            "observacion": venta.observacion,
        })
    return _base_response(
        "Ventas canceladas",
        tipo,
        filtros,
        [_metric("Canceladas", qs.count(), "danger"), _metric("Total Bs", round(_money(qs.aggregate(total=Sum("total"))["total"]), 2))],
        [_column("id", "Venta", "number"), _column("fecha", "Fecha", "datetime"), _column("cliente", "Cliente"), _column("origen", "Origen"), _column("total", "Total Bs", "currency"), _column("observacion", "Observacion")],
        filas,
        {"tipo": "bar", "label_key": "cliente", "value_key": "total"},
        periodo_label,
    )


def reporte_valores_venta_por_periodo(tipo, filtros, titulo, field, label):
    qs, periodo_label = _venta_qs(filtros)
    trunc = TruncMonth("created_at") if filtros.get("agrupacion") == "mes" else TruncDate("created_at")
    filas = _rows(
        qs.annotate(periodo_grupo=trunc)
        .values("periodo_grupo")
        .annotate(cantidad=Count("id"), valor=Sum(field))
        .order_by("periodo_grupo")
    )
    total = sum(row.get("valor") or 0 for row in filas)
    return _base_response(
        titulo,
        tipo,
        filtros,
        [_metric("Ventas", qs.count()), _metric(f"{label} Bs", round(total, 2), "success")],
        [_column("periodo_grupo", "Periodo"), _column("cantidad", "Ventas", "number"), _column("valor", f"{label} Bs", "currency")],
        filas,
        {"tipo": "line", "label_key": "periodo_grupo", "value_key": "valor"},
        periodo_label,
    )


def reporte_group_ventas(tipo, filtros, group_field, label_field, titulo):
    qs, periodo_label = _venta_qs(filtros)
    filas = _rows(qs.values(group_field).annotate(cantidad=Count("id"), total=Sum("total")).order_by("-total"))
    for row in filas:
        row["grupo"] = row.pop(group_field) or "Sin dato"
    return _base_response(
        titulo,
        tipo,
        filtros,
        _sales_metrics(qs),
        [_column("grupo", label_field), _column("cantidad", "Ventas", "number"), _column("total", "Total Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "grupo", "value_key": "total"},
        periodo_label,
    )


def reporte_ventas_por_vendedor(tipo, filtros):
    top = _to_int(filtros.get("top"), 10)
    qs, periodo_label = _venta_qs(filtros)
    filas = _rows(
        qs.values("vendedor__first_name", "vendedor__last_name", "vendedor__email")
        .annotate(cantidad=Count("id"), total=Sum("total"))
        .order_by("-total")[:top]
    )
    for row in filas:
        nombre = f"{row.pop('vendedor__first_name') or ''} {row.pop('vendedor__last_name') or ''}".strip()
        row["vendedor"] = nombre or row.pop("vendedor__email") or "Sin vendedor"
    return _base_response(
        "Ventas por vendedor",
        tipo,
        filtros,
        _sales_metrics(qs),
        [_column("vendedor", "Vendedor"), _column("cantidad", "Ventas", "number"), _column("total", "Total Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "vendedor", "value_key": "total"},
        periodo_label,
    )


def reporte_ticket_promedio(tipo, filtros):
    qs, periodo_label = _venta_qs(filtros)
    return _base_response("Ticket promedio", tipo, filtros, _sales_metrics(qs), [], [], {}, periodo_label)


def reporte_facturas_emitidas(tipo, filtros):
    top = _to_int(filtros.get("top"), 50, 200)
    qs, periodo_label = _apply_date(Factura.objects.select_related("venta", "venta__cliente"), "fecha_emision", filtros)
    qs = _filter_by_id(qs, "venta__cliente_id", filtros.get("cliente"))
    filas = _rows(
        qs.values("numero_factura", "nombre_cliente", "email_cliente", "tipo", "fecha_emision", "venta__total")
        .order_by("-fecha_emision")[:top]
    )
    for row in filas:
        row["total"] = row.pop("venta__total")
    total = sum(Decimal(str(row.get("total") or 0)) for row in filas)
    return _base_response(
        "Facturas emitidas",
        tipo,
        filtros,
        [_metric("Facturas", qs.count()), _metric("Total Bs", round(_money(total), 2), "success")],
        [_column("numero_factura", "Factura"), _column("nombre_cliente", "Cliente"), _column("email_cliente", "Email"), _column("tipo", "Tipo"), _column("fecha_emision", "Fecha"), _column("total", "Total Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "nombre_cliente", "value_key": "total"},
        periodo_label,
    )


def reporte_productos(tipo, filtros, titulo, sort_key="cantidad", solo_medicamentos=False, default_order=None):
    top = _to_int(filtros.get("top"), 10)
    qs, periodo_label = _detalle_qs(filtros)
    if solo_medicamentos:
        qs = qs.filter(producto__categoria__nombre__icontains="medic")
    order_map = {
        "nombre_asc": "producto__nombre_comercial",
        "nombre_desc": "-producto__nombre_comercial",
        "ventas_desc": "-cantidad",
        "ingresos_desc": "-total",
        "cantidad_desc": "-cantidad",
        "cantidad_asc": "cantidad",
        "total_desc": "-total",
        "total_asc": "total",
        "valor_desc": f"-{sort_key}",
        "valor_asc": sort_key,
        "precio_desc": "-producto__precio_venta",
        "precio_asc": "producto__precio_venta",
    }
    order_by = order_map.get(filtros.get("ordenar_por"), default_order or f"-{sort_key}")
    rows_qs = (
        qs.values(
            "producto__sku",
            "producto__nombre_comercial",
            "producto__categoria__nombre",
            "producto__laboratorio__nombre",
            "producto__precio_venta",
        )
        .annotate(cantidad=Sum("cantidad"), total=Sum("subtotal"))
        .order_by(order_by)[:top]
    )
    filas = _rows(rows_qs)
    for row in filas:
        row["sku"] = row.pop("producto__sku")
        row["producto"] = row.pop("producto__nombre_comercial")
        row["categoria"] = row.pop("producto__categoria__nombre")
        row["laboratorio"] = row.pop("producto__laboratorio__nombre")
        row["precio_venta"] = row.pop("producto__precio_venta", None)
    return _base_response(
        titulo,
        tipo,
        filtros,
        [_metric("Productos", len(filas)), _metric("Unidades", sum(row["cantidad"] or 0 for row in filas)), _metric("Total Bs", round(sum(row["total"] or 0 for row in filas), 2), "success")],
        [_column("sku", "SKU"), _column("producto", "Producto"), _column("categoria", "Categoria"), _column("laboratorio", "Laboratorio"), _column("cantidad", "Unidades", "number"), _column("total", "Total Bs", "currency"), _column("precio_venta", "Precio Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "producto", "value_key": sort_key},
        periodo_label,
    )


def reporte_productos_sin_ventas(tipo, filtros):
    top = _to_int(filtros.get("top"), 50, 200)
    detalles, periodo_label = _detalle_qs(filtros)
    vendidos = detalles.values_list("producto_id", flat=True).distinct()
    qs = _stock_qs(filtros).exclude(id__in=vendidos)
    order_map = {
        "nombre_asc": "nombre_comercial",
        "nombre_desc": "-nombre_comercial",
        "stock_desc": "-inventario__stock_actual",
        "stock_asc": "inventario__stock_actual",
        "precio_desc": "-precio_venta",
        "precio_asc": "precio_venta",
        "valor_desc": "-inventario__stock_actual",
        "valor_asc": "inventario__stock_actual",
    }
    order_by = order_map.get(filtros.get("ordenar_por"), "nombre_comercial")
    filas = []
    for producto in qs.order_by(order_by, "nombre_comercial")[:top]:
        inventario = getattr(producto, "inventario", None)
        stock_actual = inventario.stock_actual if inventario else 0
        filas.append({
            "sku": producto.sku,
            "producto": producto.nombre_comercial,
            "categoria": producto.categoria.nombre if producto.categoria else "",
            "laboratorio": producto.laboratorio.nombre if producto.laboratorio else "",
            "precio_venta": _money(producto.precio_venta),
            "stock_actual": stock_actual,
            "stock_minimo": producto.stock_minimo,
            "estado": _stock_estado(stock_actual, producto.stock_minimo),
        })
    return _base_response(
        "Productos sin ventas",
        tipo,
        filtros,
        [_metric("Productos sin ventas", len(filas), "warning"), _metric("Stock inmovilizado", sum(row["stock_actual"] for row in filas))],
        [_column("sku", "SKU"), _column("producto", "Producto"), _column("categoria", "Categoria"), _column("laboratorio", "Laboratorio"), _column("precio_venta", "Precio Bs", "currency"), _column("stock_actual", "Stock actual", "number"), _column("stock_minimo", "Stock minimo", "number"), _column("estado", "Estado")],
        filas,
        {"tipo": "bar", "label_key": "producto", "value_key": "stock_actual"},
        periodo_label,
    )


def reporte_rentabilidad_productos(tipo, filtros):
    top = _to_int(filtros.get("top"), 20)
    qs, periodo_label = _detalle_qs(filtros)
    rows_qs = (
        qs.values(
            "producto__sku",
            "producto__nombre_comercial",
            "producto__categoria__nombre",
            "producto__laboratorio__nombre",
            "producto__precio_compra",
            "producto__precio_venta",
        )
        .annotate(cantidad=Sum("cantidad"), total=Sum("subtotal"))
        .order_by("-total")[:top]
    )
    filas = []
    for row in _rows(rows_qs):
        cantidad = row.get("cantidad") or 0
        total = row.get("total") or 0
        costo_unitario = row.pop("producto__precio_compra", 0) or 0
        costo_estimado = float(Decimal(str(costo_unitario)) * Decimal(str(cantidad)))
        margen = float(Decimal(str(total)) - Decimal(str(costo_estimado)))
        margen_pct = (margen / float(total) * 100) if total else 0
        filas.append({
            "sku": row.pop("producto__sku"),
            "producto": row.pop("producto__nombre_comercial"),
            "categoria": row.pop("producto__categoria__nombre"),
            "laboratorio": row.pop("producto__laboratorio__nombre"),
            "cantidad": cantidad,
            "ingresos": total,
            "costo_estimado": round(costo_estimado, 2),
            "margen": round(margen, 2),
            "margen_pct": round(margen_pct, 2),
            "precio_venta": row.pop("producto__precio_venta", None),
        })
    filas = sorted(filas, key=lambda item: item["margen"], reverse=True)
    return _base_response(
        "Rentabilidad por producto",
        tipo,
        filtros,
        [_metric("Productos", len(filas)), _metric("Ingresos Bs", round(sum(row["ingresos"] or 0 for row in filas), 2), "success"), _metric("Margen Bs", round(sum(row["margen"] for row in filas), 2), "success")],
        [_column("sku", "SKU"), _column("producto", "Producto"), _column("categoria", "Categoria"), _column("laboratorio", "Laboratorio"), _column("cantidad", "Unidades", "number"), _column("ingresos", "Ingresos Bs", "currency"), _column("costo_estimado", "Costo estimado Bs", "currency"), _column("margen", "Margen Bs", "currency"), _column("margen_pct", "Margen %", "number"), _column("precio_venta", "Precio Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "producto", "value_key": "margen"},
        periodo_label,
    )


def reporte_rotacion_productos(tipo, filtros):
    top = _to_int(filtros.get("top"), 20)
    detalles, periodo_label = _detalle_qs(filtros)
    ventas = {
        row["producto_id"]: row["cantidad"] or 0
        for row in detalles.values("producto_id").annotate(cantidad=Sum("cantidad"))
    }
    productos = _stock_qs(filtros).filter(id__in=ventas.keys())
    filas = []
    for producto in productos:
        inventario = getattr(producto, "inventario", None)
        stock_actual = inventario.stock_actual if inventario else 0
        unidades_vendidas = ventas.get(producto.id, 0)
        rotacion = unidades_vendidas / max(stock_actual, 1)
        filas.append({
            "sku": producto.sku,
            "producto": producto.nombre_comercial,
            "categoria": producto.categoria.nombre if producto.categoria else "",
            "laboratorio": producto.laboratorio.nombre if producto.laboratorio else "",
            "unidades_vendidas": unidades_vendidas,
            "stock_actual": stock_actual,
            "rotacion": round(rotacion, 2),
            "estado": _stock_estado(stock_actual, producto.stock_minimo),
        })
    filas = sorted(filas, key=lambda item: item["rotacion"], reverse=True)[:top]
    return _base_response(
        "Rotacion de productos",
        tipo,
        filtros,
        [_metric("Productos", len(filas)), _metric("Unidades vendidas", sum(row["unidades_vendidas"] for row in filas)), _metric("Rotacion promedio", round(sum(row["rotacion"] for row in filas) / len(filas), 2) if filas else 0)],
        [_column("sku", "SKU"), _column("producto", "Producto"), _column("categoria", "Categoria"), _column("laboratorio", "Laboratorio"), _column("unidades_vendidas", "Vendidas", "number"), _column("stock_actual", "Stock", "number"), _column("rotacion", "Rotacion", "number"), _column("estado", "Estado")],
        filas,
        {"tipo": "bar", "label_key": "producto", "value_key": "rotacion"},
        periodo_label,
    )


def reporte_group_detalle(tipo, filtros, group_field, label, titulo):
    top = _to_int(filtros.get("top"), 20)
    qs, periodo_label = _detalle_qs(filtros)
    filas = _rows(qs.values(group_field).annotate(cantidad=Sum("cantidad"), total=Sum("subtotal")).order_by("-total")[:top])
    for row in filas:
        row["grupo"] = row.pop(group_field) or "Sin dato"
    return _base_response(
        titulo,
        tipo,
        filtros,
        [_metric("Grupos", len(filas)), _metric("Total Bs", round(sum(row["total"] or 0 for row in filas), 2), "success")],
        [_column("grupo", label), _column("cantidad", "Unidades", "number"), _column("total", "Total Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "grupo", "value_key": "total"},
        periodo_label,
    )


def reporte_stock(tipo, filtros, titulo, forced_estado=None):
    if forced_estado:
        filtros = {**filtros, "stock_estado": forced_estado}
    top = _to_int(filtros.get("top"), 200, 500)
    qs = _stock_qs(filtros)
    if tipo == "exceso_stock" and not filtros.get("stock_estado"):
        qs = qs.filter(inventario__stock_actual__gte=F("stock_minimo") * 3)
    order_map = {
        "nombre_asc": "nombre_comercial",
        "nombre_desc": "-nombre_comercial",
        "stock_desc": "-inventario__stock_actual",
        "stock_asc": "inventario__stock_actual",
        "cantidad_desc": "-inventario__stock_actual",
        "cantidad_asc": "inventario__stock_actual",
        "valor_desc": "-inventario__stock_actual",
        "valor_asc": "inventario__stock_actual",
        "precio_desc": "-precio_venta",
        "precio_asc": "precio_venta",
    }
    order_by = order_map.get(filtros.get("ordenar_por"), "nombre_comercial")
    filas = []
    for producto in qs.order_by(order_by, "nombre_comercial")[:top]:
        inventario = getattr(producto, "inventario", None)
        stock_actual = inventario.stock_actual if inventario else 0
        stock_minimo = producto.stock_minimo
        filas.append({
            "sku": producto.sku,
            "producto": producto.nombre_comercial,
            "categoria": producto.categoria.nombre if producto.categoria else "",
            "laboratorio": producto.laboratorio.nombre if producto.laboratorio else "",
            "precio_venta": _money(producto.precio_venta),
            "stock_actual": stock_actual,
            "stock_minimo": stock_minimo,
            "estado": _stock_estado(stock_actual, stock_minimo),
        })
    return _base_response(
        titulo,
        tipo,
        filtros,
        [_metric("Productos", len(filas)), _metric("Unidades", sum(row["stock_actual"] for row in filas)), _metric("Stock bajo/sin stock", sum(1 for row in filas if row["estado"] != "Disponible"), "warning")],
        [_column("sku", "SKU"), _column("producto", "Producto"), _column("categoria", "Categoria"), _column("laboratorio", "Laboratorio"), _column("precio_venta", "Precio Bs", "currency"), _column("stock_actual", "Stock actual", "number"), _column("stock_minimo", "Stock minimo", "number"), _column("estado", "Estado")],
        filas,
        {"tipo": "bar", "label_key": "producto", "value_key": "stock_actual"},
        "Inventario actual",
    )


def _valor_inventario_row(producto):
    inventario = getattr(producto, "inventario", None)
    stock_actual = inventario.stock_actual if inventario else 0
    stock_reservado = inventario.stock_reservado if inventario else 0
    costo = Decimal(str(producto.precio_compra or 0)) * Decimal(str(stock_actual))
    venta = Decimal(str(producto.precio_venta or 0)) * Decimal(str(stock_actual))
    return {
        "sku": producto.sku,
        "producto": producto.nombre_comercial,
        "categoria": producto.categoria.nombre if producto.categoria else "",
        "laboratorio": producto.laboratorio.nombre if producto.laboratorio else "",
        "stock_actual": stock_actual,
        "stock_reservado": stock_reservado,
        "valor_costo": round(_money(costo), 2),
        "valor_venta": round(_money(venta), 2),
        "margen_estimado": round(_money(venta - costo), 2),
        "estado": _stock_estado(stock_actual, producto.stock_minimo),
    }


def reporte_valor_inventario(tipo, filtros):
    top = _to_int(filtros.get("top"), 100, 500)
    qs = _stock_qs(filtros)
    filas = [_valor_inventario_row(producto) for producto in qs.order_by("nombre_comercial")[:top]]
    filas = sorted(filas, key=lambda item: item["valor_venta"], reverse=True)
    return _base_response(
        "Valor de inventario",
        tipo,
        filtros,
        [_metric("Productos", len(filas)), _metric("Valor venta Bs", round(sum(row["valor_venta"] for row in filas), 2), "success"), _metric("Valor costo Bs", round(sum(row["valor_costo"] for row in filas), 2)), _metric("Margen estimado Bs", round(sum(row["margen_estimado"] for row in filas), 2), "success")],
        [_column("sku", "SKU"), _column("producto", "Producto"), _column("categoria", "Categoria"), _column("laboratorio", "Laboratorio"), _column("stock_actual", "Stock", "number"), _column("stock_reservado", "Reservado", "number"), _column("valor_costo", "Valor costo Bs", "currency"), _column("valor_venta", "Valor venta Bs", "currency"), _column("margen_estimado", "Margen estimado Bs", "currency"), _column("estado", "Estado")],
        filas,
        {"tipo": "bar", "label_key": "producto", "value_key": "valor_venta"},
        "Inventario actual",
    )


def reporte_valor_inventario_grupo(tipo, filtros, group_attr, titulo, label):
    top = _to_int(filtros.get("top"), 20)
    grupos = {}
    for producto in _stock_qs(filtros):
        nombre = getattr(getattr(producto, group_attr, None), "nombre", None) or "Sin dato"
        row = _valor_inventario_row(producto)
        grupo = grupos.setdefault(nombre, {"grupo": nombre, "productos": 0, "stock_actual": 0, "valor_costo": 0, "valor_venta": 0, "margen_estimado": 0})
        grupo["productos"] += 1
        grupo["stock_actual"] += row["stock_actual"]
        grupo["valor_costo"] += row["valor_costo"]
        grupo["valor_venta"] += row["valor_venta"]
        grupo["margen_estimado"] += row["margen_estimado"]
    filas = sorted(grupos.values(), key=lambda item: item["valor_venta"], reverse=True)[:top]
    return _base_response(
        titulo,
        tipo,
        filtros,
        [_metric(label, len(filas)), _metric("Valor venta Bs", round(sum(row["valor_venta"] for row in filas), 2), "success"), _metric("Stock", sum(row["stock_actual"] for row in filas))],
        [_column("grupo", label), _column("productos", "Productos", "number"), _column("stock_actual", "Stock", "number"), _column("valor_costo", "Valor costo Bs", "currency"), _column("valor_venta", "Valor venta Bs", "currency"), _column("margen_estimado", "Margen estimado Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "grupo", "value_key": "valor_venta"},
        "Inventario actual",
    )


def reporte_stock_reservado(tipo, filtros):
    top = _to_int(filtros.get("top"), 100, 500)
    productos = _stock_qs(filtros).filter(inventario__stock_reservado__gt=0).order_by("-inventario__stock_reservado", "nombre_comercial")[:top]
    filas = []
    for producto in productos:
        inventario = getattr(producto, "inventario", None)
        filas.append({
            "sku": producto.sku,
            "producto": producto.nombre_comercial,
            "categoria": producto.categoria.nombre if producto.categoria else "",
            "laboratorio": producto.laboratorio.nombre if producto.laboratorio else "",
            "stock_actual": inventario.stock_actual if inventario else 0,
            "stock_reservado": inventario.stock_reservado if inventario else 0,
            "stock_disponible": inventario.stock_disponible if inventario else 0,
        })
    return _base_response(
        "Stock reservado",
        tipo,
        filtros,
        [_metric("Productos", len(filas)), _metric("Reservado", sum(row["stock_reservado"] for row in filas), "warning"), _metric("Disponible", sum(row["stock_disponible"] for row in filas))],
        [_column("sku", "SKU"), _column("producto", "Producto"), _column("categoria", "Categoria"), _column("laboratorio", "Laboratorio"), _column("stock_actual", "Stock", "number"), _column("stock_reservado", "Reservado", "number"), _column("stock_disponible", "Disponible", "number")],
        filas,
        {"tipo": "bar", "label_key": "producto", "value_key": "stock_reservado"},
        "Inventario actual",
    )


def reporte_movimientos(tipo, filtros, titulo, source="movimientos"):
    top = _to_int(filtros.get("top"), 100, 200)
    if source == "entradas":
        qs, periodo_label = _apply_date(EntradaStock.objects.select_related("producto", "usuario"), "created_at", filtros)
        qs = _filter_by_id(qs, "producto__categoria_id", filtros.get("categoria"))
        qs = _filter_by_id(qs, "producto__laboratorio_id", filtros.get("laboratorio"))
        filas = _rows(qs.values("created_at", "producto__sku", "producto__nombre_comercial", "cantidad", "motivo", "usuario__email").order_by("-created_at")[:top])
        columnas = [_column("created_at", "Fecha"), _column("producto__sku", "SKU"), _column("producto__nombre_comercial", "Producto"), _column("cantidad", "Cantidad", "number"), _column("motivo", "Motivo"), _column("usuario__email", "Usuario")]
    else:
        qs, periodo_label = _apply_date(MovimientoInventario.objects.select_related("producto", "usuario"), "fecha_movimiento", filtros)
        qs = _filter_by_id(qs, "tipo_movimiento", filtros.get("tipo_movimiento"))
        qs = _filter_by_id(qs, "producto__categoria_id", filtros.get("categoria"))
        qs = _filter_by_id(qs, "producto__laboratorio_id", filtros.get("laboratorio"))
        if source == "salidas":
            qs = qs.filter(tipo_movimiento="salida", motivo="venta")
        filas = _rows(qs.values("fecha_movimiento", "producto__sku", "producto__nombre_comercial", "tipo_movimiento", "cantidad", "motivo", "usuario__email").order_by("-fecha_movimiento")[:top])
        columnas = [_column("fecha_movimiento", "Fecha"), _column("producto__sku", "SKU"), _column("producto__nombre_comercial", "Producto"), _column("tipo_movimiento", "Tipo"), _column("cantidad", "Cantidad", "number"), _column("motivo", "Motivo"), _column("usuario__email", "Usuario")]
    return _base_response(
        titulo,
        tipo,
        filtros,
        [_metric("Registros", len(filas)), _metric("Unidades", sum(row.get("cantidad") or 0 for row in filas))],
        columnas,
        filas,
        {"tipo": "bar", "label_key": "producto__nombre_comercial", "value_key": "cantidad"},
        periodo_label,
    )


def reporte_movimientos_por_producto(tipo, filtros, titulo, forced_tipo=None):
    top = _to_int(filtros.get("top"), 20)
    qs, periodo_label = _apply_date(MovimientoInventario.objects.select_related("producto", "usuario"), "fecha_movimiento", filtros)
    qs = _filter_by_id(qs, "producto__categoria_id", filtros.get("categoria"))
    qs = _filter_by_id(qs, "producto__laboratorio_id", filtros.get("laboratorio"))
    if forced_tipo:
        qs = qs.filter(tipo_movimiento=forced_tipo)
    else:
        qs = _filter_by_id(qs, "tipo_movimiento", filtros.get("tipo_movimiento"))
    filas = _rows(
        qs.values("producto__sku", "producto__nombre_comercial", "producto__categoria__nombre", "producto__laboratorio__nombre")
        .annotate(cantidad=Sum("cantidad"), movimientos=Count("id"))
        .order_by("-cantidad")[:top]
    )
    for row in filas:
        row["sku"] = row.pop("producto__sku")
        row["producto"] = row.pop("producto__nombre_comercial")
        row["categoria"] = row.pop("producto__categoria__nombre")
        row["laboratorio"] = row.pop("producto__laboratorio__nombre")
    return _base_response(
        titulo,
        tipo,
        filtros,
        [_metric("Productos", len(filas)), _metric("Unidades", sum(row.get("cantidad") or 0 for row in filas)), _metric("Movimientos", sum(row.get("movimientos") or 0 for row in filas))],
        [_column("sku", "SKU"), _column("producto", "Producto"), _column("categoria", "Categoria"), _column("laboratorio", "Laboratorio"), _column("cantidad", "Unidades", "number"), _column("movimientos", "Movimientos", "number")],
        filas,
        {"tipo": "bar", "label_key": "producto", "value_key": "cantidad"},
        periodo_label,
    )


def reporte_movimientos_por_tipo(tipo, filtros):
    qs, periodo_label = _apply_date(MovimientoInventario.objects.select_related("producto", "usuario"), "fecha_movimiento", filtros)
    qs = _filter_by_id(qs, "producto__categoria_id", filtros.get("categoria"))
    qs = _filter_by_id(qs, "producto__laboratorio_id", filtros.get("laboratorio"))
    qs = _filter_by_id(qs, "tipo_movimiento", filtros.get("tipo_movimiento"))
    filas = _rows(qs.values("tipo_movimiento", "motivo").annotate(cantidad=Sum("cantidad"), movimientos=Count("id")).order_by("-cantidad"))
    for row in filas:
        row["grupo"] = f"{row.pop('tipo_movimiento') or 'Sin tipo'} / {row.pop('motivo') or 'Sin motivo'}"
    return _base_response(
        "Movimientos por tipo",
        tipo,
        filtros,
        [_metric("Movimientos", qs.count()), _metric("Unidades", sum(row.get("cantidad") or 0 for row in filas))],
        [_column("grupo", "Tipo / motivo"), _column("cantidad", "Unidades", "number"), _column("movimientos", "Movimientos", "number")],
        filas,
        {"tipo": "bar", "label_key": "grupo", "value_key": "cantidad"},
        periodo_label,
    )


def reporte_mejores_clientes(tipo, filtros, titulo="Clientes con mas compras"):
    top = _to_int(filtros.get("top"), 10)
    qs, periodo_label = _venta_qs(filtros)
    qs = _filter_by_id(qs, "cliente__tipo", filtros.get("tipo_cliente"))
    filas = _rows(qs.values("cliente__nombres", "cliente__apellidos", "cliente__email", "cliente__tipo").annotate(cantidad=Count("id"), total=Sum("total")).order_by("-total")[:top])
    for row in filas:
        row["cliente"] = f"{row.pop('cliente__nombres') or ''} {row.pop('cliente__apellidos') or ''}".strip()
        row["email"] = row.pop("cliente__email")
        row["tipo"] = row.pop("cliente__tipo")
    return _base_response(
        titulo,
        tipo,
        filtros,
        [_metric("Clientes", len(filas)), _metric("Total Bs", round(sum(row["total"] or 0 for row in filas), 2), "success")],
        [_column("cliente", "Cliente"), _column("email", "Email"), _column("tipo", "Tipo"), _column("cantidad", "Compras", "number"), _column("total", "Total Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "cliente", "value_key": "total"},
        periodo_label,
    )


def reporte_clientes_nuevos(tipo, filtros):
    top = _to_int(filtros.get("top"), 100, 200)
    qs, periodo_label = _apply_date(Cliente.objects.all(), "created_at", filtros)
    qs = _filter_by_id(qs, "tipo", filtros.get("tipo_cliente"))
    filas = _rows(qs.values("nombres", "apellidos", "email", "telefono", "tipo", "created_at").order_by("-created_at")[:top])
    for row in filas:
        row["cliente"] = f"{row.pop('nombres') or ''} {row.pop('apellidos') or ''}".strip()
    return _base_response(
        "Clientes nuevos",
        tipo,
        filtros,
        [_metric("Clientes nuevos", qs.count())],
        [_column("cliente", "Cliente"), _column("email", "Email"), _column("telefono", "Telefono"), _column("tipo", "Tipo"), _column("created_at", "Fecha")],
        filas,
        {},
        periodo_label,
    )


def reporte_clientes_sin_compras(tipo, filtros):
    top = _to_int(filtros.get("top"), 100, 200)
    ventas, periodo_label = _venta_qs(filtros)
    clientes_con_compras = ventas.values_list("cliente_id", flat=True).distinct()
    qs = Cliente.objects.filter(estado=True).exclude(id__in=clientes_con_compras)
    qs = _filter_by_id(qs, "tipo", filtros.get("tipo_cliente"))
    filas = _rows(qs.values("nombres", "apellidos", "email", "telefono", "tipo", "created_at").order_by("nombres", "apellidos")[:top])
    for row in filas:
        row["cliente"] = f"{row.pop('nombres') or ''} {row.pop('apellidos') or ''}".strip()
    return _base_response(
        "Clientes sin compras",
        tipo,
        filtros,
        [_metric("Clientes", qs.count(), "warning")],
        [_column("cliente", "Cliente"), _column("email", "Email"), _column("telefono", "Telefono"), _column("tipo", "Tipo"), _column("created_at", "Registrado")],
        filas,
        {},
        periodo_label,
    )


def reporte_clientes_por_tipo(tipo, filtros):
    qs, periodo_label = _apply_date(Cliente.objects.filter(estado=True), "created_at", filtros)
    qs = _filter_by_id(qs, "tipo", filtros.get("tipo_cliente"))
    filas = _rows(qs.values("tipo").annotate(cantidad=Count("id")).order_by("-cantidad"))
    return _base_response(
        "Clientes por tipo",
        tipo,
        filtros,
        [_metric("Clientes", qs.count())],
        [_column("tipo", "Tipo"), _column("cantidad", "Clientes", "number")],
        filas,
        {"tipo": "bar", "label_key": "tipo", "value_key": "cantidad"},
        periodo_label,
    )


def reporte_frecuencia_clientes(tipo, filtros):
    top = _to_int(filtros.get("top"), 20)
    qs, periodo_label = _venta_qs(filtros)
    qs = _filter_by_id(qs, "cliente__tipo", filtros.get("tipo_cliente"))
    filas = _rows(
        qs.values("cliente__nombres", "cliente__apellidos", "cliente__email", "cliente__tipo")
        .annotate(compras=Count("id"), total=Sum("total"), ultima_compra=Max("created_at"))
        .order_by("-compras", "-total")[:top]
    )
    for row in filas:
        compras = row.get("compras") or 0
        total = row.get("total") or 0
        row["cliente"] = f"{row.pop('cliente__nombres') or ''} {row.pop('cliente__apellidos') or ''}".strip()
        row["email"] = row.pop("cliente__email")
        row["tipo"] = row.pop("cliente__tipo")
        row["ticket_promedio"] = round(total / compras, 2) if compras else 0
    return _base_response(
        "Frecuencia de compra por cliente",
        tipo,
        filtros,
        [_metric("Clientes", len(filas)), _metric("Compras", sum(row.get("compras") or 0 for row in filas)), _metric("Total Bs", round(sum(row.get("total") or 0 for row in filas), 2), "success")],
        [_column("cliente", "Cliente"), _column("email", "Email"), _column("tipo", "Tipo"), _column("compras", "Compras", "number"), _column("total", "Total Bs", "currency"), _column("ticket_promedio", "Ticket promedio Bs", "currency"), _column("ultima_compra", "Ultima compra", "datetime")],
        filas,
        {"tipo": "bar", "label_key": "cliente", "value_key": "compras"},
        periodo_label,
    )


def reporte_ventas_por_tipo_cliente(tipo, filtros):
    qs, periodo_label = _venta_qs(filtros)
    qs = _filter_by_id(qs, "cliente__tipo", filtros.get("tipo_cliente"))
    filas = _rows(qs.values("cliente__tipo").annotate(cantidad=Count("id"), total=Sum("total")).order_by("-total"))
    for row in filas:
        row["grupo"] = row.pop("cliente__tipo") or "Sin dato"
    return _base_response(
        "Ventas por tipo de cliente",
        tipo,
        filtros,
        _sales_metrics(qs),
        [_column("grupo", "Tipo cliente"), _column("cantidad", "Ventas", "number"), _column("total", "Total Bs", "currency")],
        filas,
        {"tipo": "bar", "label_key": "grupo", "value_key": "total"},
        periodo_label,
    )


def reporte_recetas(tipo, filtros, titulo, vencidas=False):
    qs, periodo_label = _apply_date(RecetaMedica.objects.select_related("cliente"), "created_at", filtros)
    if vencidas:
        qs = qs.filter(fecha_vencimiento__lt=timezone.localdate())
    qs = _filter_by_id(qs, "estado", filtros.get("estado_receta"))
    qs = _filter_by_id(qs, "cliente_id", filtros.get("cliente"))
    if vencidas:
        filas = _rows(qs.values("codigo", "cliente__nombres", "cliente__email", "estado", "fecha_emision", "fecha_vencimiento").order_by("fecha_vencimiento")[:200])
        columnas = [_column("codigo", "Codigo"), _column("cliente__nombres", "Cliente"), _column("cliente__email", "Email"), _column("estado", "Estado"), _column("fecha_emision", "Emision"), _column("fecha_vencimiento", "Vencimiento")]
        grafico = {}
    else:
        filas = _rows(qs.values("estado").annotate(cantidad=Count("id")).order_by("-cantidad"))
        columnas = [_column("estado", "Estado"), _column("cantidad", "Cantidad", "number")]
        grafico = {"tipo": "bar", "label_key": "estado", "value_key": "cantidad"}
    return _base_response(titulo, tipo, filtros, [_metric("Recetas", qs.count())], columnas, filas, grafico, periodo_label)


def reporte_recetas_detalle(tipo, filtros):
    top = _to_int(filtros.get("top"), 100, 200)
    qs, periodo_label = _apply_date(RecetaMedica.objects.select_related("cliente", "validada_por"), "created_at", filtros)
    qs = _filter_by_id(qs, "estado", filtros.get("estado_receta"))
    qs = _filter_by_id(qs, "cliente_id", filtros.get("cliente"))
    filas = _rows(
        qs.values("codigo", "cliente__nombres", "cliente__apellidos", "cliente__email", "estado", "fecha_emision", "fecha_vencimiento", "validada_por__email", "validada_en")
        .order_by("-created_at")[:top]
    )
    for row in filas:
        row["cliente"] = f"{row.pop('cliente__nombres') or ''} {row.pop('cliente__apellidos') or ''}".strip()
        row["email"] = row.pop("cliente__email")
        row["validada_por"] = row.pop("validada_por__email") or ""
    return _base_response(
        "Detalle de recetas",
        tipo,
        filtros,
        [_metric("Recetas", qs.count()), _metric("Vencidas", qs.filter(fecha_vencimiento__lt=timezone.localdate()).count(), "warning")],
        [_column("codigo", "Codigo"), _column("cliente", "Cliente"), _column("email", "Email"), _column("estado", "Estado"), _column("fecha_emision", "Emision"), _column("fecha_vencimiento", "Vencimiento"), _column("validada_por", "Validada por"), _column("validada_en", "Validada en", "datetime")],
        filas,
        {},
        periodo_label,
    )


def reporte_recetas_por_cliente(tipo, filtros):
    top = _to_int(filtros.get("top"), 20)
    qs, periodo_label = _apply_date(RecetaMedica.objects.select_related("cliente"), "created_at", filtros)
    qs = _filter_by_id(qs, "estado", filtros.get("estado_receta"))
    qs = _filter_by_id(qs, "cliente_id", filtros.get("cliente"))
    filas = _rows(
        qs.values("cliente__nombres", "cliente__apellidos", "cliente__email")
        .annotate(cantidad=Count("id"))
        .order_by("-cantidad")[:top]
    )
    for row in filas:
        row["cliente"] = f"{row.pop('cliente__nombres') or ''} {row.pop('cliente__apellidos') or ''}".strip()
        row["email"] = row.pop("cliente__email")
    return _base_response(
        "Recetas por cliente",
        tipo,
        filtros,
        [_metric("Clientes", len(filas)), _metric("Recetas", sum(row.get("cantidad") or 0 for row in filas))],
        [_column("cliente", "Cliente"), _column("email", "Email"), _column("cantidad", "Recetas", "number")],
        filas,
        {"tipo": "bar", "label_key": "cliente", "value_key": "cantidad"},
        periodo_label,
    )


def reporte_bitacora(tipo, filtros, group_field, label, titulo, forced_failure=False):
    top = _to_int(filtros.get("top"), 20)
    qs, periodo_label = _apply_date(BitacoraSistema.objects.select_related("usuario"), "fecha_hora", filtros)
    qs = _filter_by_id(qs, "modulo", filtros.get("modulo"))
    qs = _filter_by_id(qs, "accion", filtros.get("accion"))
    qs = _filter_by_id(qs, "usuario_id", filtros.get("usuario"))
    if forced_failure:
        qs = qs.filter(resultado="FAILURE")
    else:
        qs = _filter_by_id(qs, "resultado", filtros.get("resultado"))
    filas = _rows(qs.values(group_field).annotate(cantidad=Count("id")).order_by("-cantidad")[:top])
    for row in filas:
        row["grupo"] = row.pop(group_field) or "Sin dato"
    return _base_response(
        titulo,
        tipo,
        filtros,
        [_metric("Eventos", qs.count()), _metric("Fallidos", qs.filter(resultado="FAILURE").count(), "danger")],
        [_column("grupo", label), _column("cantidad", "Eventos", "number")],
        filas,
        {"tipo": "bar", "label_key": "grupo", "value_key": "cantidad"},
        periodo_label,
    )


def _bitacora_qs(filtros):
    qs, periodo_label = _apply_date(BitacoraSistema.objects.select_related("usuario"), "fecha_hora", filtros)
    qs = _filter_by_id(qs, "modulo", filtros.get("modulo"))
    qs = _filter_by_id(qs, "accion", filtros.get("accion"))
    qs = _filter_by_id(qs, "usuario_id", filtros.get("usuario"))
    qs = _filter_by_id(qs, "resultado", filtros.get("resultado"))
    return qs, periodo_label


def reporte_eventos_por_resultado(tipo, filtros):
    qs, periodo_label = _bitacora_qs(filtros)
    filas = _rows(qs.values("resultado").annotate(cantidad=Count("id")).order_by("-cantidad"))
    return _base_response(
        "Eventos por resultado",
        tipo,
        filtros,
        [_metric("Eventos", qs.count()), _metric("Fallidos", qs.filter(resultado="FAILURE").count(), "danger")],
        [_column("resultado", "Resultado"), _column("cantidad", "Eventos", "number")],
        filas,
        {"tipo": "bar", "label_key": "resultado", "value_key": "cantidad"},
        periodo_label,
    )


def reporte_acciones_por_usuario(tipo, filtros):
    top = _to_int(filtros.get("top"), 30)
    qs, periodo_label = _bitacora_qs(filtros)
    filas = _rows(qs.values("usuario__email", "accion").annotate(cantidad=Count("id")).order_by("-cantidad")[:top])
    for row in filas:
        row["usuario"] = row.pop("usuario__email") or "Sistema"
        row["grupo"] = f"{row['usuario']} / {row.get('accion') or 'Sin accion'}"
    return _base_response(
        "Acciones por usuario",
        tipo,
        filtros,
        [_metric("Registros", qs.count()), _metric("Usuarios", qs.values("usuario_id").distinct().count())],
        [_column("usuario", "Usuario"), _column("accion", "Accion"), _column("cantidad", "Eventos", "number"), _column("grupo", "Grupo")],
        filas,
        {"tipo": "bar", "label_key": "grupo", "value_key": "cantidad"},
        periodo_label,
    )


def reporte_bitacora_detalle(tipo, filtros):
    top = _to_int(filtros.get("top"), 100, 200)
    qs, periodo_label = _bitacora_qs(filtros)
    filas = _rows(
        qs.values("fecha_hora", "usuario__email", "modulo", "accion", "resultado", "mensaje", "ip_origen")
        .order_by("-fecha_hora")[:top]
    )
    for row in filas:
        row["usuario"] = row.pop("usuario__email") or "Sistema"
    return _base_response(
        "Detalle de bitacora",
        tipo,
        filtros,
        [_metric("Registros", qs.count()), _metric("Fallidos", qs.filter(resultado="FAILURE").count(), "danger")],
        [_column("fecha_hora", "Fecha", "datetime"), _column("usuario", "Usuario"), _column("modulo", "Modulo"), _column("accion", "Accion"), _column("resultado", "Resultado"), _column("mensaje", "Mensaje"), _column("ip_origen", "IP")],
        filas,
        {},
        periodo_label,
    )


REPORT_GENERATORS = {
    "ventas_resumen": reporte_ventas_resumen,
    "ventas_detalle": reporte_ventas_detalle,
    "ventas_tendencia": reporte_ventas_tendencia,
    "ventas_por_origen": lambda tipo, filtros: reporte_group_ventas(tipo, filtros, "origen", "Origen", "Ventas por origen"),
    "ventas_por_estado": lambda tipo, filtros: reporte_group_ventas(tipo, filtros, "estado", "Estado", "Ventas por estado"),
    "ventas_por_vendedor": reporte_ventas_por_vendedor,
    "ventas_por_cliente": lambda tipo, filtros: reporte_mejores_clientes(tipo, filtros, "Ventas por cliente"),
    "ventas_por_hora": reporte_ventas_por_hora,
    "ventas_por_dia_semana": reporte_ventas_por_dia_semana,
    "ventas_canceladas": reporte_ventas_canceladas,
    "descuentos_aplicados": lambda tipo, filtros: reporte_valores_venta_por_periodo(tipo, filtros, "Descuentos aplicados", "descuento", "Descuento"),
    "impuestos_cobrados": lambda tipo, filtros: reporte_valores_venta_por_periodo(tipo, filtros, "Impuestos cobrados", "impuesto", "Impuesto"),
    "ticket_promedio": reporte_ticket_promedio,
    "facturas_emitidas": reporte_facturas_emitidas,
    "productos_mas_vendidos": lambda tipo, filtros: reporte_productos(tipo, filtros, "Productos mas vendidos", "cantidad"),
    "medicamentos_mas_vendidos": lambda tipo, filtros: reporte_productos(tipo, filtros, "Medicamentos mas vendidos", "cantidad", True),
    "productos_menos_vendidos": lambda tipo, filtros: reporte_productos(tipo, filtros, "Productos menos vendidos", "cantidad", False, "cantidad"),
    "medicamentos_menos_vendidos": lambda tipo, filtros: reporte_productos(tipo, filtros, "Medicamentos menos vendidos", "cantidad", True, "cantidad"),
    "productos_sin_ventas": reporte_productos_sin_ventas,
    "productos_mayores_ingresos": lambda tipo, filtros: reporte_productos(tipo, filtros, "Productos con mayores ingresos", "total"),
    "rentabilidad_productos": reporte_rentabilidad_productos,
    "rotacion_productos": reporte_rotacion_productos,
    "ventas_por_categoria": lambda tipo, filtros: reporte_group_detalle(tipo, filtros, "producto__categoria__nombre", "Categoria", "Ventas por categoria"),
    "ventas_por_laboratorio": lambda tipo, filtros: reporte_group_detalle(tipo, filtros, "producto__laboratorio__nombre", "Laboratorio", "Ventas por laboratorio"),
    "stock_actual": lambda tipo, filtros: reporte_stock(tipo, filtros, "Stock actual"),
    "stock_bajo": lambda tipo, filtros: reporte_stock(tipo, filtros, "Stock bajo", "stock_bajo"),
    "sin_stock": lambda tipo, filtros: reporte_stock(tipo, filtros, "Sin stock", "sin_stock"),
    "exceso_stock": lambda tipo, filtros: reporte_stock(tipo, filtros, "Exceso de stock", "exceso_stock"),
    "valor_inventario": reporte_valor_inventario,
    "valor_inventario_categoria": lambda tipo, filtros: reporte_valor_inventario_grupo(tipo, filtros, "categoria", "Valor de inventario por categoria", "Categorias"),
    "valor_inventario_laboratorio": lambda tipo, filtros: reporte_valor_inventario_grupo(tipo, filtros, "laboratorio", "Valor de inventario por laboratorio", "Laboratorios"),
    "stock_reservado": reporte_stock_reservado,
    "movimientos_inventario": lambda tipo, filtros: reporte_movimientos(tipo, filtros, "Movimientos de inventario"),
    "entradas_stock": lambda tipo, filtros: reporte_movimientos(tipo, filtros, "Entradas de stock", "entradas"),
    "salidas_por_venta": lambda tipo, filtros: reporte_movimientos(tipo, filtros, "Salidas por venta", "salidas"),
    "entradas_por_producto": lambda tipo, filtros: reporte_movimientos_por_producto(tipo, filtros, "Entradas por producto", "entrada"),
    "salidas_por_producto": lambda tipo, filtros: reporte_movimientos_por_producto(tipo, filtros, "Salidas por producto", "salida"),
    "movimientos_por_tipo": reporte_movimientos_por_tipo,
    "mejores_clientes": reporte_mejores_clientes,
    "clientes_nuevos": reporte_clientes_nuevos,
    "clientes_sin_compras": reporte_clientes_sin_compras,
    "clientes_por_tipo": reporte_clientes_por_tipo,
    "frecuencia_clientes": reporte_frecuencia_clientes,
    "ventas_por_tipo_cliente": reporte_ventas_por_tipo_cliente,
    "recetas_por_estado": lambda tipo, filtros: reporte_recetas(tipo, filtros, "Recetas por estado"),
    "recetas_vencidas": lambda tipo, filtros: reporte_recetas(tipo, filtros, "Recetas vencidas", True),
    "recetas_detalle": reporte_recetas_detalle,
    "recetas_por_cliente": reporte_recetas_por_cliente,
    "actividad_por_modulo": lambda tipo, filtros: reporte_bitacora(tipo, filtros, "modulo", "Modulo", "Actividad por modulo"),
    "actividad_por_usuario": lambda tipo, filtros: reporte_bitacora(tipo, filtros, "usuario__email", "Usuario", "Actividad por usuario"),
    "eventos_fallidos": lambda tipo, filtros: reporte_bitacora(tipo, filtros, "modulo", "Modulo", "Eventos fallidos", True),
    "eventos_por_resultado": reporte_eventos_por_resultado,
    "acciones_por_usuario": reporte_acciones_por_usuario,
    "bitacora_detalle": reporte_bitacora_detalle,
}


def _first_key(row, candidates):
    for key in candidates:
        if row.get(key) not in (None, ""):
            return key
    return None


def _primary_numeric_key(reporte):
    rows = reporte.get("filas") or []
    if not rows:
        return None

    chart_key = (reporte.get("grafico") or {}).get("value_key")
    if chart_key and any(isinstance(row.get(chart_key), (int, float, Decimal)) for row in rows):
        return chart_key

    column_types = {column["key"]: column.get("type") for column in reporte.get("columnas") or []}
    for key, type_ in column_types.items():
        if type_ in {"number", "currency"} and any(row.get(key) not in (None, "") for row in rows):
            return key
    for row in rows:
        for key, value in row.items():
            if isinstance(value, (int, float, Decimal)):
                return key
    return None


def _parse_sort_date(value):
    if not value:
        return datetime.min
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, date):
        return datetime.combine(value, time.min)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        try:
            return datetime.strptime(str(value), "%Y-%m-%d")
        except ValueError:
            return datetime.min


def _sort_rows(reporte, filtros):
    ordenar_por = filtros.get("ordenar_por")
    filas = list(reporte.get("filas") or [])
    if not ordenar_por or not filas:
        return reporte

    key_candidates = {
        "nombre": ["producto", "cliente", "grupo", "nombre_cliente", "email", "usuario__email", "producto__nombre_comercial", "modulo", "estado", "origen"],
        "fecha": ["fecha", "created_at", "fecha_emision", "fecha_movimiento", "fecha_hora", "periodo_grupo", "fecha_vencimiento", "ultima_compra"],
        "cantidad": ["cantidad", "stock_actual", "stock_reservado", "compras", "ventas", "eventos", "movimientos", "unidades_vendidas", "productos"],
        "total": ["total", "venta__total", "ingresos", "valor_venta", "margen", "margen_estimado"],
        "stock": ["stock_actual", "stock_reservado", "stock_disponible"],
        "precio": ["precio_venta"],
    }

    if ordenar_por in {"nombre_asc", "nombre_desc"}:
        key = _first_key(filas[0], key_candidates["nombre"]) or _first_key(filas[0], list(filas[0].keys()))
        reverse = ordenar_por.endswith("_desc")
        filas.sort(key=lambda row: str(row.get(key) or "").casefold(), reverse=reverse)
    elif ordenar_por in {"fecha_desc", "fecha_asc"}:
        key = _first_key(filas[0], key_candidates["fecha"])
        if key:
            filas.sort(key=lambda row: _parse_sort_date(row.get(key)), reverse=ordenar_por == "fecha_desc")
    elif ordenar_por in {"cantidad_desc", "cantidad_asc", "ventas_desc"}:
        key = _first_key(filas[0], key_candidates["cantidad"]) or _primary_numeric_key(reporte)
        if key:
            filas.sort(key=lambda row: float(row.get(key) or 0), reverse=ordenar_por != "cantidad_asc")
    elif ordenar_por in {"total_desc", "total_asc", "ingresos_desc"}:
        key = _first_key(filas[0], key_candidates["total"]) or _primary_numeric_key(reporte)
        if key:
            filas.sort(key=lambda row: float(row.get(key) or 0), reverse=ordenar_por != "total_asc")
    elif ordenar_por in {"stock_desc", "stock_asc"}:
        key = _first_key(filas[0], key_candidates["stock"]) or _primary_numeric_key(reporte)
        if key:
            filas.sort(key=lambda row: float(row.get(key) or 0), reverse=ordenar_por == "stock_desc")
    elif ordenar_por in {"precio_desc", "precio_asc"}:
        key = _first_key(filas[0], key_candidates["precio"]) or _primary_numeric_key(reporte)
        if key:
            filas.sort(key=lambda row: float(row.get(key) or 0), reverse=ordenar_por == "precio_desc")
    elif ordenar_por in {"valor_desc", "valor_asc"}:
        key = _primary_numeric_key(reporte)
        if key:
            filas.sort(key=lambda row: float(row.get(key) or 0), reverse=ordenar_por == "valor_desc")

    return {**reporte, "filas": filas}


def _option(value, label):
    return {"value": value, "label": str(label)}


def catalogo_reportes():
    user_model = get_user_model()
    reportes = [
        {**item, "filtros": _merge_filters(item.get("filtros", []), GLOBAL_REPORT_FILTERS)}
        for item in REPORT_TYPES
    ]
    options = {
        "categorias": [_option(item.id, item.nombre) for item in Categoria.objects.filter(estado=True).order_by("nombre")],
        "subcategorias": [_option(item.id, f"{item.categoria.nombre} / {item.nombre}") for item in Subcategoria.objects.select_related("categoria").filter(estado=True).order_by("categoria__nombre", "nombre")],
        "laboratorios": [_option(item.id, item.nombre) for item in Laboratorio.objects.filter(estado=True).order_by("nombre")],
        "productos": [_option(item.id, f"{item.sku} - {item.nombre_comercial}") for item in Producto.objects.filter(estado=True).order_by("nombre_comercial")[:300]],
        "clientes": [_option(item.id, str(item)) for item in Cliente.objects.filter(estado=True).order_by("nombres", "apellidos")[:300]],
        "usuarios": [_option(item.id, item.email or item.username) for item in user_model.objects.filter(is_active=True).order_by("email", "username")],
        "vendedores": [_option(item.id, item.email or item.username) for item in user_model.objects.filter(is_active=True, is_staff=True).order_by("email", "username")],
        "modulos_bitacora": [_option(value, value) for value in BitacoraSistema.objects.exclude(modulo="").values_list("modulo", flat=True).distinct().order_by("modulo")],
        "acciones_bitacora": [_option(value, value) for value in BitacoraSistema.objects.exclude(accion="").values_list("accion", flat=True).distinct().order_by("accion")],
    }
    return {
        "reportes": reportes,
        "filtros": list(FILTER_DEFINITIONS.values()),
        "opciones": options,
        "defaults": {"tipo_reporte": "ventas_resumen", "filtros": {"periodo": "este_mes", "top": 10}},
    }


def generar_reporte(tipo_reporte, filtros=None):
    if tipo_reporte not in REPORT_GENERATORS:
        raise ReporteError("Tipo de reporte no soportado.", code="tipo_no_soportado")
    filtros = filtros or {}
    reporte = REPORT_GENERATORS[tipo_reporte](tipo_reporte, filtros)
    return _sort_rows(reporte, filtros)


def _gemini_generate_content(parts, schema=None, model=None):
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ReporteError("Gemini no esta configurado. Falta GEMINI_API_KEY.", code="ia_no_configurada")

    model_name = _normalize_gemini_model_name(model or settings.GEMINI_REPORTS_MODEL)
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"temperature": 0.1},
    }
    if schema:
        payload["generationConfig"]["responseMimeType"] = "application/json"
        payload["generationConfig"]["responseJsonSchema"] = schema

    last_response = None
    attempted_models = []
    for candidate_model in _gemini_candidate_models(model_name):
        attempted_models.append(candidate_model)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{candidate_model}:generateContent"
        try:
            response = requests.post(url, headers={"x-goog-api-key": api_key}, json=payload, timeout=45)
        except requests.Timeout as exc:
            raise ReporteError("Gemini tardo demasiado en responder. Intenta nuevamente.", code="ia_timeout") from exc
        except requests.RequestException as exc:
            raise ReporteError("No se pudo conectar con Gemini. Revisa tu conexion o la configuracion de red.", code="ia_error") from exc

        if response.status_code < 400:
            data = response.json()
            try:
                response_parts = data["candidates"][0]["content"]["parts"]
            except (KeyError, IndexError) as exc:
                raise ReporteError("Gemini no devolvio una respuesta valida.", code="ia_error") from exc
            return "".join(part.get("text", "") for part in response_parts)

        last_response = response
        if response.status_code not in (400, 404):
            break

    if last_response is not None:
        raise ReporteError(_gemini_error_message(last_response, attempted_models[-1], attempted_models), code="ia_error")
    raise ReporteError("Gemini no devolvio una respuesta valida.", code="ia_error")


def _normalize_gemini_model_name(model_name):
    value = str(model_name or "").strip()
    if value.startswith("models/"):
        value = value.split("/", 1)[1]
    return value


def _gemini_candidate_models(primary_model):
    configured_fallbacks = getattr(settings, "GEMINI_FALLBACK_MODELS", "")
    raw_candidates = [primary_model]
    raw_candidates.extend(item.strip() for item in str(configured_fallbacks).split(",") if item.strip())
    raw_candidates.extend(["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"])

    seen = set()
    candidates = []
    for item in raw_candidates:
        model_name = _normalize_gemini_model_name(item)
        if model_name and model_name not in seen:
            seen.add(model_name)
            candidates.append(model_name)
    return candidates


def _gemini_error_message(response, model_name, attempted_models=None):
    detail = ""
    try:
        detail = response.json().get("error", {}).get("message", "")
    except ValueError:
        detail = response.text[:180] if response.text else ""

    if response.status_code in (400, 404):
        attempted = ", ".join(attempted_models or [model_name])
        return f"Modelo Gemini no disponible o solicitud invalida. Modelos probados: {attempted}. Revisa GEMINI_REPORTS_MODEL y GEMINI_AUDIO_MODEL."
    if response.status_code in (401, 403):
        return "Gemini rechazo la clave API. Revisa que GEMINI_API_KEY sea valida y tenga acceso a Generative Language API."
    if response.status_code == 429:
        return "Gemini alcanzo el limite de cuota o velocidad. Intenta mas tarde o revisa la cuota de la API."
    if detail:
        return f"Gemini rechazo la solicitud ({response.status_code}): {detail}"
    return f"Gemini rechazo la solicitud ({response.status_code})."


def _interpretation_schema():
    return {
        "type": "object",
        "properties": {
            "tipo_reporte": {"type": "string", "enum": list(REPORT_BY_ID.keys())},
            "periodo": {"type": "string", "enum": [item["value"] for item in PERIODOS]},
            "fecha_inicio": {"type": ["string", "null"], "description": "YYYY-MM-DD si aplica"},
            "fecha_fin": {"type": ["string", "null"], "description": "YYYY-MM-DD si aplica"},
            "top": {"type": ["integer", "null"], "minimum": 1, "maximum": 100},
            "origen": {"type": ["string", "null"], "enum": ["fisica", "online", None]},
            "estado": {"type": ["string", "null"], "enum": [value for value, _ in Venta.ESTADO_CHOICES] + [None]},
            "stock_estado": {"type": ["string", "null"], "enum": ["disponible", "stock_bajo", "sin_stock", "exceso_stock", None]},
            "tipo_cliente": {"type": ["string", "null"], "enum": [value for value, _ in Cliente.TIPO_CHOICES] + [None]},
            "estado_receta": {"type": ["string", "null"], "enum": [value for value, _ in RecetaMedica.ESTADO_CHOICES] + [None]},
            "categoria_texto": {"type": ["string", "null"]},
            "laboratorio_texto": {"type": ["string", "null"]},
            "producto_texto": {"type": ["string", "null"]},
            "sku": {"type": ["string", "null"]},
            "ordenar_por": {"type": ["string", "null"], "enum": [item["value"] for item in ORDENES_REPORTE] + [None]},
            "resultado": {"type": "string", "enum": ["ok", "ambiguo", "no_soportado"]},
            "mensaje": {"type": "string"},
        },
        "required": ["tipo_reporte", "periodo", "resultado", "mensaje"],
    }


def _audio_interpretation_schema():
    schema = _interpretation_schema()
    return {
        **schema,
        "properties": {
            **schema["properties"],
            "transcripcion": {"type": "string"},
        },
        "required": ["transcripcion", *schema["required"]],
    }


def _resolve_text_filter(model, field, text):
    if not text:
        return None
    return model.objects.filter(**{f"{field}__icontains": text}).values_list("id", flat=True).first()


def _interpretacion_a_filtros(data):
    if data.get("resultado") != "ok":
        raise ReporteError(data.get("mensaje") or "La solicitud no es lo suficientemente clara.", code="ia_ambigua")
    tipo_reporte = data.get("tipo_reporte")
    if tipo_reporte not in REPORT_BY_ID:
        raise ReporteError("La IA eligio un reporte no soportado.", code="tipo_no_soportado")

    filtros = {}
    for key in ["periodo", "fecha_inicio", "fecha_fin", "top", "origen", "estado", "stock_estado", "tipo_cliente", "estado_receta", "sku", "ordenar_por"]:
        if data.get(key) not in (None, ""):
            filtros[key] = data[key]

    categoria_id = _resolve_text_filter(Categoria, "nombre", data.get("categoria_texto"))
    laboratorio_id = _resolve_text_filter(Laboratorio, "nombre", data.get("laboratorio_texto"))
    producto_id = _resolve_text_filter(Producto, "nombre_comercial", data.get("producto_texto"))
    if categoria_id:
        filtros["categoria"] = categoria_id
    if laboratorio_id:
        filtros["laboratorio"] = laboratorio_id
    if producto_id:
        filtros["producto"] = producto_id

    return tipo_reporte, filtros


def interpretar_texto_y_generar(texto):
    if not texto or not texto.strip():
        raise ReporteError("Ingresa una solicitud para generar el reporte.", code="texto_requerido")

    catalog_lines = "\n".join(f"- {item['id']}: {item['label']} ({item['categoria']})" for item in REPORT_TYPES)
    prompt = f"""
Interpreta la solicitud del usuario y elige exactamente un reporte del catalogo.
Devuelve solo JSON valido segun el esquema.
No inventes reportes, SQL ni filtros que no existan.
Si el usuario pide "medicamentos mas vendidos", usa medicamentos_mas_vendidos.
Si pide "menos vendidos", usa productos_menos_vendidos o medicamentos_menos_vendidos segun corresponda.
Si pide "productos sin ventas" o "no vendidos", usa productos_sin_ventas.
Si pide "rentabilidad" o "margen", usa rentabilidad_productos.
Si pide "valor de inventario", usa valor_inventario.
Si pide "rotacion", usa rotacion_productos.
Si pide "ventas por hora", usa ventas_por_hora.
Si pide "stock bajo", usa stock_bajo.
Si pide "mes pasado", periodo=mes_pasado. Si no menciona fecha, usa periodo=este_mes.

Catalogo:
{catalog_lines}

Solicitud: {texto.strip()}
"""
    raw = _gemini_generate_content([{"text": prompt}], schema=_interpretation_schema())
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ReporteError("Gemini devolvio una respuesta no procesable.", code="ia_error") from exc

    tipo_reporte, filtros = _interpretacion_a_filtros(parsed)
    reporte = generar_reporte(tipo_reporte, filtros)
    return {"texto": texto.strip(), "interpretacion": parsed, "reporte": reporte}


def transcribir_audio_y_generar(uploaded_file):
    if not uploaded_file:
        raise ReporteError("Debes enviar un archivo de audio.", code="audio_requerido")
    if uploaded_file.size > MAX_AUDIO_BYTES:
        raise ReporteError("El audio no puede superar 25 MB.", code="audio_muy_grande")

    content = uploaded_file.read()
    encoded = base64.b64encode(content).decode("ascii")
    mime_type = getattr(uploaded_file, "content_type", "") or "audio/webm"
    catalog_lines = "\n".join(f"- {item['id']}: {item['label']} ({item['categoria']})" for item in REPORT_TYPES)
    prompt = f"""
Transcribe el audio en espanol e interpreta la solicitud para elegir exactamente un reporte del catalogo.
Devuelve solo JSON valido segun el esquema.
No inventes reportes, SQL ni filtros que no existan.
Si el usuario pide "medicamentos mas vendidos", usa medicamentos_mas_vendidos.
Si pide "menos vendidos", usa productos_menos_vendidos o medicamentos_menos_vendidos segun corresponda.
Si pide "productos sin ventas" o "no vendidos", usa productos_sin_ventas.
Si pide "rentabilidad" o "margen", usa rentabilidad_productos.
Si pide "valor de inventario", usa valor_inventario.
Si pide "rotacion", usa rotacion_productos.
Si pide "ventas por hora", usa ventas_por_hora.
Si pide "stock bajo", usa stock_bajo.
Si pide "mes pasado", periodo=mes_pasado. Si no menciona fecha, usa periodo=este_mes.

Catalogo:
{catalog_lines}
"""
    raw = _gemini_generate_content(
        [
            {"text": prompt},
            {"inlineData": {"mimeType": mime_type, "data": encoded}},
        ],
        schema=_audio_interpretation_schema(),
        model=settings.GEMINI_AUDIO_MODEL,
    )
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ReporteError("No se pudo transcribir el audio.", code="ia_error") from exc
    transcripcion = (parsed.get("transcripcion") or "").strip()
    if not transcripcion:
        raise ReporteError("No se detecto voz en el audio.", code="audio_sin_texto")

    tipo_reporte, filtros = _interpretacion_a_filtros(parsed)
    reporte = generar_reporte(tipo_reporte, filtros)
    return {"texto": transcripcion, "transcripcion": transcripcion, "interpretacion": parsed, "reporte": reporte}
