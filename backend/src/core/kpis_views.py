"""
KPI endpoints — datos agregados para dashboards.

Tenant:  GET /api/admin/kpis/?periodo=hoy|semana|mes
Detalle: GET /api/admin/kpis/detalle/?tipo=xxx&periodo=yyy
Global:  GET /api/global/kpis/
"""
from datetime import date, datetime, time, timedelta

from django.db.models import (
    Avg, Count, DecimalField, ExpressionWrapper, F, Q, Sum,
)
from django.db.models.functions import TruncDate, TruncHour
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


# ── Helpers ───────────────────────────────────────────────────────────────────

def _tenant(request):
    return getattr(request, "tenant", None)


def _rango_fechas(periodo):
    now = timezone.now()
    today = now.date()

    if periodo == "hoy":
        inicio = datetime.combine(today, time.min)
        fin = now
        prev_inicio = datetime.combine(today - timedelta(days=1), time.min)
        prev_fin = datetime.combine(today - timedelta(days=1), time.max)
    elif periodo == "semana":
        lunes = today - timedelta(days=today.weekday())
        inicio = datetime.combine(lunes, time.min)
        fin = now
        prev_inicio = datetime.combine(lunes - timedelta(weeks=1), time.min)
        prev_fin = datetime.combine(lunes - timedelta(days=1), time.max)
    else:  # mes
        inicio = datetime.combine(today.replace(day=1), time.min)
        fin = now
        mes_pasado = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        prev_inicio = datetime.combine(mes_pasado, time.min)
        prev_fin = datetime.combine(today.replace(day=1) - timedelta(days=1), time.max)

    tz = timezone.get_current_timezone()
    return (
        timezone.make_aware(inicio, tz),
        fin,
        timezone.make_aware(prev_inicio, tz),
        timezone.make_aware(prev_fin, tz),
    )


def _delta(actual, anterior):
    if not anterior:
        return None
    try:
        return round(((float(actual) - float(anterior)) / float(anterior)) * 100, 1)
    except (ZeroDivisionError, TypeError):
        return None


# ── Tenant KPIs ───────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tenant_kpis(request):
    from core.rbac import tiene_permiso
    if not tiene_permiso(request.user, "ventas.ver", tenant=_tenant(request)):
        return Response({"detail": "Sin permiso."}, status=403)

    periodo = request.query_params.get("periodo", "mes")
    inicio, fin, prev_inicio, prev_fin = _rango_fechas(periodo)

    from ventas.models import DetalleVenta, Venta
    from pedidos.models import Pedido
    from inventarios.models import Inventario, LoteProducto
    from opiniones.models import Opinion
    from clientes.models import Cliente

    estados_validos = ["pagada", "entregada"]

    # ── Ventas ────────────────────────────────────────────────────────────────
    ventas_qs = Venta.objects.filter(
        created_at__gte=inicio, created_at__lte=fin, estado__in=estados_validos,
    )
    ventas_prev_qs = Venta.objects.filter(
        created_at__gte=prev_inicio, created_at__lte=prev_fin, estado__in=estados_validos,
    )

    total_bs = ventas_qs.aggregate(t=Sum("total"))["t"] or 0
    total_bs_prev = ventas_prev_qs.aggregate(t=Sum("total"))["t"] or 0
    num_transacciones = ventas_qs.count()
    num_transacciones_prev = ventas_prev_qs.count()
    ticket_promedio = round(float(total_bs) / num_transacciones, 2) if num_transacciones else 0
    ventas_fisica = ventas_qs.filter(origen="fisica").count()
    ventas_online = ventas_qs.filter(origen="online").count()

    # ── Margen bruto ─────────────────────────────────────────────────────────
    try:
        margen_data = DetalleVenta.objects.filter(
            venta__created_at__gte=inicio, venta__created_at__lte=fin,
            venta__estado__in=estados_validos,
        ).annotate(
            margen_item=ExpressionWrapper(
                (F("precio_unitario") - F("producto__precio_compra")) * F("cantidad"),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        ).aggregate(total=Sum("margen_item"))
        margen_bs = float(margen_data["total"] or 0)
        margen_pct = round(margen_bs / float(total_bs) * 100, 1) if float(total_bs) > 0 else None
    except Exception:
        margen_bs, margen_pct = 0, None

    # ── Tendencia ─────────────────────────────────────────────────────────────
    if periodo == "hoy":
        ventas_trend = (
            Venta.objects.filter(created_at__gte=inicio, created_at__lte=fin, estado__in=estados_validos)
            .annotate(punto=TruncHour("created_at"))
            .values("punto").annotate(total=Sum("total"), cantidad=Count("id")).order_by("punto")
        )
        trend_data = [{"label": v["punto"].strftime("%H:%M"), "total": float(v["total"] or 0), "cantidad": v["cantidad"]} for v in ventas_trend]
    else:
        ventas_trend = (
            Venta.objects.filter(created_at__gte=inicio, created_at__lte=fin, estado__in=estados_validos)
            .annotate(punto=TruncDate("created_at"))
            .values("punto").annotate(total=Sum("total"), cantidad=Count("id")).order_by("punto")
        )
        trend_data = [{"label": v["punto"].strftime("%d/%m"), "total": float(v["total"] or 0), "cantidad": v["cantidad"]} for v in ventas_trend]

    # ── Top productos ─────────────────────────────────────────────────────────
    top_productos = (
        DetalleVenta.objects.filter(
            venta__created_at__gte=inicio, venta__created_at__lte=fin, venta__estado__in=estados_validos,
        )
        .values("producto__nombre_comercial")
        .annotate(cantidad=Sum("cantidad"), total=Sum("subtotal"))
        .order_by("-cantidad")[:8]
    )
    top_productos_data = [{"nombre": p["producto__nombre_comercial"], "cantidad": p["cantidad"], "total": float(p["total"] or 0)} for p in top_productos]

    # ── Pedidos ───────────────────────────────────────────────────────────────
    pedidos_activos = Pedido.objects.exclude(estado__in=["entregado", "no_entregado", "cancelado"]).count()
    pedidos_entregados = Pedido.objects.filter(entregado_en__gte=inicio, entregado_en__lte=fin, estado="entregado").count()
    pedidos_no_entregados = Pedido.objects.filter(created_at__gte=inicio, created_at__lte=fin, estado="no_entregado").count()
    total_finalizados = pedidos_entregados + pedidos_no_entregados
    tasa_entrega = round((pedidos_entregados / total_finalizados) * 100, 1) if total_finalizados else None
    pedidos_por_estado = list(Pedido.objects.filter(created_at__gte=inicio, created_at__lte=fin).values("estado").annotate(cantidad=Count("id")))

    # ── Inventario ────────────────────────────────────────────────────────────
    stock_bajo = Inventario.objects.filter(stock_actual__lte=F("stock_minimo")).count()
    hoy = date.today()
    en_30_dias = hoy + timedelta(days=30)
    por_vencer = LoteProducto.objects.filter(
        fecha_vencimiento__isnull=False, fecha_vencimiento__lte=en_30_dias,
        fecha_vencimiento__gte=hoy, cantidad_disponible__gt=0,
    ).count()

    # ── Opiniones ─────────────────────────────────────────────────────────────
    nps = Opinion.objects.aggregate(avg=Avg("puntuacion"))["avg"]
    nps_valor = round(float(nps), 1) if nps else None
    opiniones_urgentes = Opinion.objects.filter(estado="pendiente", puntuacion__lte=2).count()
    dist_opiniones = list(
        Opinion.objects.values("puntuacion")
        .annotate(cantidad=Count("id"))
        .order_by("puntuacion")
    )

    # ── Clientes activos ──────────────────────────────────────────────────────
    clientes_activos = (
        Venta.objects.filter(created_at__gte=inicio, created_at__lte=fin, estado__in=estados_validos, cliente__isnull=False)
        .values("cliente_id").distinct().count()
    )

    # ── Fidelización (puntos) ─────────────────────────────────────────────────
    puntos_entregados, puntos_canjeados, canjes_pendientes, niveles_data = 0, 0, 0, []
    try:
        from puntos.models import CanjePuntos, CuentaPuntos, TransaccionPuntos
        puntos_entregados = TransaccionPuntos.objects.filter(
            tipo="ganado", created_at__gte=inicio, created_at__lte=fin
        ).aggregate(t=Sum("puntos"))["t"] or 0
        puntos_canjeados = TransaccionPuntos.objects.filter(
            tipo="canjeado", created_at__gte=inicio, created_at__lte=fin
        ).aggregate(t=Sum("puntos"))["t"] or 0
        puntos_canjeados = abs(puntos_canjeados)
        canjes_pendientes = CanjePuntos.objects.filter(estado="pendiente").count()
        niveles_data = list(
            CuentaPuntos.objects.values("nivel").annotate(cantidad=Count("id")).order_by("nivel")
        )
    except Exception:
        pass

    # ── Tratamientos y adherencia ─────────────────────────────────────────────
    tratamientos_activos, adherencia_pct, tomas_omitidas = 0, None, 0
    try:
        from tratamientos.models import TomaMedicamento, TratamientoActivo
        tratamientos_activos = TratamientoActivo.objects.filter(estado="activo").count()
        tomas_qs = TomaMedicamento.objects.filter(
            fecha_hora_programada__gte=inicio, fecha_hora_programada__lte=fin
        )
        tomas_total = tomas_qs.count()
        tomas_tomadas_count = tomas_qs.filter(estado="tomada").count()
        tomas_omitidas = tomas_qs.filter(estado="omitida").count()
        adherencia_pct = round(tomas_tomadas_count / tomas_total * 100, 1) if tomas_total > 0 else None
    except Exception:
        pass

    # ── Recetas pendientes ────────────────────────────────────────────────────
    recetas_pendientes = 0
    try:
        from clientes.models import RecetaMedica
        recetas_pendientes = RecetaMedica.objects.filter(estado="pendiente").count()
    except Exception:
        pass

    # ── Campañas activas ──────────────────────────────────────────────────────
    campanias_activas = 0
    try:
        from publicidad.models import CampanaPublicitaria
        campanias_activas = CampanaPublicitaria.objects.filter(activa=True, fecha_fin__gte=hoy).count()
    except Exception:
        pass

    # ── Últimas ventas (tabla) ────────────────────────────────────────────────
    ultimas_ventas_qs = (
        Venta.objects.filter(created_at__gte=inicio, created_at__lte=fin, estado__in=estados_validos)
        .select_related("cliente", "factura").prefetch_related("detalles__producto")
        .order_by("-created_at")[:10]
    )
    ultimas_ventas_data = []
    for v in ultimas_ventas_qs:
        productos_nombres = ", ".join(d.producto.nombre_comercial for d in v.detalles.all()[:3])
        if v.detalles.count() > 3:
            productos_nombres += f" +{v.detalles.count() - 3}"
        ultimas_ventas_data.append({
            "id": v.id,
            "cliente": f"{v.cliente.nombres} {v.cliente.apellidos}".strip() if v.cliente else "Invitado",
            "productos": productos_nombres,
            "total": float(v.total),
            "origen": v.origen,
            "fecha": v.created_at.isoformat(),
        })

    return Response({
        "periodo": periodo,
        "ventas": {
            "total_bs": float(total_bs),
            "delta_pct": _delta(total_bs, total_bs_prev),
            "num_transacciones": num_transacciones,
            "delta_transacciones_pct": _delta(num_transacciones, num_transacciones_prev),
            "ticket_promedio": ticket_promedio,
            "fisica": ventas_fisica,
            "online": ventas_online,
            "margen_bs": margen_bs,
            "margen_pct": margen_pct,
        },
        "tendencia": trend_data,
        "top_productos": top_productos_data,
        "pedidos": {
            "activos": pedidos_activos,
            "entregados_periodo": pedidos_entregados,
            "tasa_entrega_pct": tasa_entrega,
            "por_estado": pedidos_por_estado,
        },
        "inventario": {
            "stock_bajo": stock_bajo,
            "por_vencer_30d": por_vencer,
        },
        "opiniones": {
            "nps_promedio": nps_valor,
            "urgentes": opiniones_urgentes,
            "distribucion": dist_opiniones,
        },
        "clientes": {
            "activos_periodo": clientes_activos,
        },
        "fidelizacion": {
            "puntos_entregados": int(puntos_entregados),
            "puntos_canjeados": int(puntos_canjeados),
            "canjes_pendientes": canjes_pendientes,
            "niveles": niveles_data,
        },
        "tratamientos": {
            "activos": tratamientos_activos,
            "adherencia_pct": adherencia_pct,
            "tomas_omitidas": tomas_omitidas,
        },
        "recetas_pendientes": recetas_pendientes,
        "campanias_activas": campanias_activas,
        "ultimas_ventas": ultimas_ventas_data,
    })


# ── Detalle de KPI (tabla al hacer clic en card) ──────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tenant_kpis_detalle(request):
    from core.rbac import tiene_permiso
    if not tiene_permiso(request.user, "ventas.ver", tenant=_tenant(request)):
        return Response({"detail": "Sin permiso."}, status=403)

    tipo = request.query_params.get("tipo", "")
    periodo = request.query_params.get("periodo", "mes")
    inicio, fin, _, _ = _rango_fechas(periodo)
    hoy = date.today()

    # ── Stock bajo ────────────────────────────────────────────────────────────
    if tipo == "stock_bajo":
        from inventarios.models import Inventario
        items = (
            Inventario.objects.filter(stock_actual__lte=F("stock_minimo"))
            .select_related("producto")
            .order_by("stock_actual")[:50]
        )
        return Response({
            "titulo": "Productos con stock bajo",
            "columnas": ["Producto", "SKU", "Stock actual", "Stock mínimo", "Diferencia"],
            "filas": [
                [
                    i.producto.nombre_comercial,
                    i.producto.sku,
                    i.stock_actual,
                    i.stock_minimo,
                    i.stock_actual - i.stock_minimo,
                ]
                for i in items
            ],
        })

    # ── Vencimientos ──────────────────────────────────────────────────────────
    if tipo == "vencimientos":
        from inventarios.models import LoteProducto
        en_30_dias = hoy + timedelta(days=30)
        lotes = (
            LoteProducto.objects.filter(
                fecha_vencimiento__isnull=False,
                fecha_vencimiento__lte=en_30_dias,
                fecha_vencimiento__gte=hoy,
                cantidad_disponible__gt=0,
            )
            .select_related("producto")
            .order_by("fecha_vencimiento")[:50]
        )
        return Response({
            "titulo": "Lotes próximos a vencer (≤ 30 días)",
            "columnas": ["Producto", "Lote", "Vence", "Días restantes", "Cantidad"],
            "filas": [
                [
                    l.producto.nombre_comercial,
                    l.numero_lote or "—",
                    l.fecha_vencimiento.strftime("%d/%m/%Y"),
                    (l.fecha_vencimiento - hoy).days,
                    l.cantidad_disponible,
                ]
                for l in lotes
            ],
        })

    # ── Pedidos activos ───────────────────────────────────────────────────────
    if tipo == "pedidos_activos":
        from pedidos.models import Pedido
        pedidos = (
            Pedido.objects.exclude(estado__in=["entregado", "no_entregado", "cancelado"])
            .select_related("venta__cliente", "repartidor")
            .order_by("-created_at")[:30]
        )
        estado_labels = {
            "pagado": "Pagado", "aceptado": "Aceptado", "preparando": "Preparando",
            "listo": "Listo", "en_camino": "En camino", "cerca": "Cerca",
        }
        return Response({
            "titulo": "Pedidos activos ahora",
            "columnas": ["#", "Cliente", "Estado", "Total (Bs.)", "Repartidor", "Fecha"],
            "filas": [
                [
                    p.id,
                    f"{p.venta.cliente.nombres} {p.venta.cliente.apellidos}".strip() if p.venta.cliente else "—",
                    estado_labels.get(p.estado, p.estado),
                    float(p.venta.total),
                    p.repartidor.get_full_name() if p.repartidor else "Sin asignar",
                    p.created_at.strftime("%d/%m %H:%M"),
                ]
                for p in pedidos
            ],
        })

    # ── Top clientes ──────────────────────────────────────────────────────────
    if tipo == "clientes_top":
        from ventas.models import Venta
        clientes = (
            Venta.objects.filter(
                created_at__gte=inicio, created_at__lte=fin,
                estado__in=["pagada", "entregada"], cliente__isnull=False,
            )
            .values("cliente__nombres", "cliente__apellidos", "cliente__email")
            .annotate(compras=Count("id"), total=Sum("total"))
            .order_by("-total")[:20]
        )
        return Response({
            "titulo": "Clientes más activos del período",
            "columnas": ["Cliente", "Email", "Compras", "Total gastado (Bs.)"],
            "filas": [
                [
                    f"{c['cliente__nombres']} {c['cliente__apellidos']}".strip(),
                    c["cliente__email"] or "—",
                    c["compras"],
                    float(c["total"] or 0),
                ]
                for c in clientes
            ],
        })

    # ── Tratamientos activos ──────────────────────────────────────────────────
    if tipo == "tratamientos":
        from tratamientos.models import TratamientoActivo
        tratamientos = (
            TratamientoActivo.objects.filter(estado="activo")
            .select_related("cliente__usuario", "base__producto")
            .order_by("-fecha_inicio")[:30]
        )
        return Response({
            "titulo": "Tratamientos activos",
            "columnas": ["Cliente", "Tratamiento", "Inicio", "Adherencia", "Última toma"],
            "filas": [
                [
                    f"{t.cliente.nombres} {t.cliente.apellidos}".strip() if hasattr(t, "cliente") and t.cliente else "—",
                    t.base.producto.nombre_comercial if t.base and t.base.producto else "—",
                    t.fecha_inicio.strftime("%d/%m/%Y") if t.fecha_inicio else "—",
                    f"{round(t.dosis_tomadas / t.dosis_objetivo * 100)}%" if t.dosis_objetivo else "—",
                    t.ultima_toma_real_at.strftime("%d/%m %H:%M") if t.ultima_toma_real_at else "Sin tomas",
                ]
                for t in tratamientos
            ],
        })

    # ── Recetas pendientes ────────────────────────────────────────────────────
    if tipo == "recetas_pendientes":
        from clientes.models import RecetaMedica
        recetas = (
            RecetaMedica.objects.filter(estado="pendiente")
            .select_related("cliente")
            .order_by("fecha_emision")[:30]
        )
        return Response({
            "titulo": "Recetas pendientes de validación",
            "columnas": ["Cliente", "Fecha emisión", "Días esperando", "Vencimiento"],
            "filas": [
                [
                    f"{r.cliente.nombres} {r.cliente.apellidos}".strip() if r.cliente else "—",
                    r.fecha_emision.strftime("%d/%m/%Y") if r.fecha_emision else "—",
                    (hoy - r.fecha_emision).days if r.fecha_emision else "—",
                    r.fecha_vencimiento.strftime("%d/%m/%Y") if r.fecha_vencimiento else "Sin venc.",
                ]
                for r in recetas
            ],
        })

    # ── Puntos entregados ─────────────────────────────────────────────────────
    if tipo == "puntos_top":
        from puntos.models import CuentaPuntos
        cuentas = (
            CuentaPuntos.objects.filter(puntos_acumulados__gt=0)
            .select_related("cliente")
            .order_by("-puntos_acumulados")[:20]
        )
        nivel_labels = {"bronce": "Bronce", "plata": "Plata", "oro": "Oro", "diamante": "Diamante"}
        return Response({
            "titulo": "Clientes con más puntos acumulados",
            "columnas": ["Cliente", "Nivel", "Disponibles", "Acumulados", "Canjeados"],
            "filas": [
                [
                    f"{c.cliente.nombres} {c.cliente.apellidos}".strip() if c.cliente else "—",
                    nivel_labels.get(c.nivel, c.nivel),
                    c.puntos_disponibles,
                    c.puntos_acumulados,
                    c.puntos_canjeados,
                ]
                for c in cuentas
            ],
        })

    # ── Canjes pendientes ─────────────────────────────────────────────────────
    if tipo == "canjes_pendientes":
        from puntos.models import CanjePuntos
        canjes = (
            CanjePuntos.objects.filter(estado="pendiente")
            .select_related("cuenta__cliente", "catalogo")
            .order_by("-created_at")[:30]
        )
        return Response({
            "titulo": "Canjes pendientes de aplicar",
            "columnas": ["Cliente", "Puntos usados", "Código voucher", "Fecha"],
            "filas": [
                [
                    f"{c.cuenta.cliente.nombres} {c.cuenta.cliente.apellidos}".strip() if c.cuenta and c.cuenta.cliente else "—",
                    c.puntos_usados,
                    c.codigo_voucher if hasattr(c, "codigo_voucher") else "—",
                    c.created_at.strftime("%d/%m/%Y") if hasattr(c, "created_at") else "—",
                ]
                for c in canjes
            ],
        })

    # ── Opiniones urgentes ────────────────────────────────────────────────────
    if tipo == "opiniones_urgentes":
        from opiniones.models import Opinion
        ops = (
            Opinion.objects.filter(estado="pendiente", puntuacion__lte=2)
            .select_related("cliente")
            .order_by("created_at")[:30]
        )
        return Response({
            "titulo": "Opiniones urgentes sin responder (≤ 2★)",
            "columnas": ["Cliente", "Puntuación", "Comentario", "Días sin respuesta"],
            "filas": [
                [
                    f"{o.cliente.nombres} {o.cliente.apellidos}".strip() if o.cliente else "—",
                    f"{'★' * o.puntuacion}",
                    (o.comentario or "")[:80],
                    (timezone.now() - o.created_at).days,
                ]
                for o in ops
            ],
        })

    # ── Margen por producto ───────────────────────────────────────────────────
    if tipo == "margen_productos":
        from ventas.models import DetalleVenta
        try:
            items = (
                DetalleVenta.objects.filter(
                    venta__created_at__gte=inicio, venta__created_at__lte=fin,
                    venta__estado__in=["pagada", "entregada"],
                )
                .annotate(
                    margen_item=ExpressionWrapper(
                        (F("precio_unitario") - F("producto__precio_compra")) * F("cantidad"),
                        output_field=DecimalField(max_digits=14, decimal_places=2),
                    )
                )
                .values("producto__nombre_comercial", "producto__sku")
                .annotate(
                    unidades=Sum("cantidad"),
                    ingresos=Sum("subtotal"),
                    margen=Sum("margen_item"),
                )
                .order_by("-margen")[:20]
            )
            return Response({
                "titulo": "Margen bruto por producto",
                "columnas": ["Producto", "SKU", "Unidades", "Ingresos (Bs.)", "Margen (Bs.)", "% Margen"],
                "filas": [
                    [
                        i["producto__nombre_comercial"],
                        i["producto__sku"],
                        i["unidades"],
                        float(i["ingresos"] or 0),
                        float(i["margen"] or 0),
                        round(float(i["margen"] or 0) / float(i["ingresos"] or 1) * 100, 1),
                    ]
                    for i in items
                ],
            })
        except Exception as e:
            return Response({"titulo": "Margen por producto", "columnas": [], "filas": [], "error": str(e)})

    return Response({"detail": f"Tipo '{tipo}' no reconocido."}, status=400)


# ── Global KPIs (superadmin) ──────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def global_kpis(request):
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({"detail": "Sin permiso."}, status=403)

    from tenants.models import Plan, Suscripcion, Tenant

    now = timezone.now()
    hoy = now.date()
    inicio_mes = hoy.replace(day=1)
    inicio_mes_dt = timezone.make_aware(datetime.combine(inicio_mes, time.min))

    total_tenants = Tenant.objects.count()
    activos = Tenant.objects.filter(status="activo").count()
    suspendidos = Tenant.objects.filter(status="suspendido").count()
    cancelados = Tenant.objects.filter(status="cancelado").count()
    nuevos_mes = Tenant.objects.filter(created_at__gte=inicio_mes_dt).count()

    suscripciones_activas = Suscripcion.objects.filter(estado__in=["active", "trialing"])
    en_trial = Suscripcion.objects.filter(estado="trialing").count()
    past_due = Suscripcion.objects.filter(estado="past_due").count()
    mrr = suscripciones_activas.aggregate(total=Sum("plan__precio_mensual"))["total"] or 0
    por_plan = list(
        suscripciones_activas.values("plan__nombre", "plan__slug")
        .annotate(cantidad=Count("id")).order_by("-cantidad")
    )
    por_plan_data = [{"plan": p["plan__nombre"], "slug": p["plan__slug"], "cantidad": p["cantidad"]} for p in por_plan]

    tendencia_meses = []
    for i in range(5, -1, -1):
        primer_dia = (hoy.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
        if primer_dia.month < 12:
            ultimo_dia = primer_dia.replace(month=primer_dia.month + 1, day=1) - timedelta(days=1)
        else:
            ultimo_dia = primer_dia.replace(month=12, day=31)
        inicio_dt = timezone.make_aware(datetime.combine(primer_dia, time.min))
        fin_dt = timezone.make_aware(datetime.combine(ultimo_dia, time.max))
        nuevas = Tenant.objects.filter(created_at__gte=inicio_dt, created_at__lte=fin_dt).count()
        tendencia_meses.append({"mes": primer_dia.strftime("%b %Y"), "nuevas": nuevas})

    proximas_vencer = []
    try:
        en_30_dias_dt = timezone.make_aware(datetime.combine(hoy + timedelta(days=30), time.max))
        subs_vencer = Suscripcion.objects.filter(
            estado__in=["active", "trialing"], fecha_fin__isnull=False, fecha_fin__lte=en_30_dias_dt,
        ).select_related("tenant", "plan").order_by("fecha_fin")[:10]
        proximas_vencer = [
            {"tenant": s.tenant.name, "subdomain": s.tenant.subdomain, "plan": s.plan.nombre, "fecha_fin": s.fecha_fin.isoformat(), "estado": s.estado}
            for s in subs_vencer
        ]
    except Exception:
        pass

    return Response({
        "tenants": {"total": total_tenants, "activos": activos, "suspendidos": suspendidos, "cancelados": cancelados, "nuevos_mes": nuevos_mes},
        "suscripciones": {"activas": suscripciones_activas.count(), "en_trial": en_trial, "past_due": past_due, "mrr": float(mrr), "por_plan": por_plan_data},
        "tendencia_meses": tendencia_meses,
        "proximas_vencer": proximas_vencer,
    })
