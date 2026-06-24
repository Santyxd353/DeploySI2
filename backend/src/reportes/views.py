from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from django.db.models import F, Sum

from django.utils import timezone
from datetime import timedelta
from ventas.models import Venta
from inventarios.models import Inventario
from clientes.models import Cliente

from core.audit import log_system_event
from core.rbac import tiene_permiso

from .services import ReporteError, catalogo_reportes, generar_reporte, interpretar_texto_y_generar, transcribir_audio_y_generar


def _require_reportes_perm(request):
    if request.user.is_superuser or tiene_permiso(request.user, "reportes.ver"):
        return None
    return Response({"detail": "No tienes permiso para ver reportes."}, status=status.HTTP_403_FORBIDDEN)


def _error_response(exc):
    body = {
        "detail": str(exc),
        "code": getattr(exc, "code", "reporte_error"),
    }
    payload = getattr(exc, "payload", None)
    if isinstance(payload, dict):
        body.update(payload)
    return Response(body, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalogo_reportes_view(request):
    denied = _require_reportes_perm(request)
    if denied:
        return denied
    return Response(catalogo_reportes(), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generar_reporte_view(request):
    denied = _require_reportes_perm(request)
    if denied:
        return denied

    tipo_reporte = request.data.get("tipo_reporte")
    filtros = request.data.get("filtros") if isinstance(request.data.get("filtros"), dict) else {}
    try:
        reporte = generar_reporte(tipo_reporte, filtros)
    except ReporteError as exc:
        log_system_event(
            request=request,
            accion="GENERAR_REPORTE",
            modulo="reportes",
            resultado="FAILURE",
            mensaje=str(exc),
        )
        return _error_response(exc)

    log_system_event(
        request=request,
        accion="GENERAR_REPORTE",
        modulo="reportes",
        resultado="SUCCESS",
        mensaje=f"Reporte generado: {tipo_reporte}",
    )
    return Response(reporte, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def interpretar_texto_view(request):
    denied = _require_reportes_perm(request)
    if denied:
        return denied

    texto = request.data.get("texto", "")
    try:
        result = interpretar_texto_y_generar(texto)
    except ReporteError as exc:
        log_system_event(
            request=request,
            accion="IA_REPORTE_TEXTO",
            modulo="reportes",
            resultado="FAILURE",
            mensaje=str(exc),
        )
        return _error_response(exc)

    log_system_event(
        request=request,
        accion="IA_REPORTE_TEXTO",
        modulo="reportes",
        resultado="SUCCESS",
        mensaje=f"Reporte IA generado: {result['reporte']['tipo_reporte']}",
    )
    return Response(result, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def interpretar_audio_view(request):
    denied = _require_reportes_perm(request)
    if denied:
        return denied

    audio = request.FILES.get("audio")
    try:
        result = transcribir_audio_y_generar(audio)
    except ReporteError as exc:
        log_system_event(
            request=request,
            accion="IA_REPORTE_AUDIO",
            modulo="reportes",
            resultado="FAILURE",
            mensaje=str(exc),
        )
        return _error_response(exc)

    if settings.REPORTS_AUDIO_DEBUG:
        print(
            "[REPORTES_AUDIO_DEBUG] transcripcion=",
            result.get("transcripcion", ""),
            " tipo_reporte=",
            result.get("reporte", {}).get("tipo_reporte", ""),
            " filtros=",
            result.get("reporte", {}).get("filtros_aplicados", {}),
        )

    log_system_event(
        request=request,
        accion="IA_REPORTE_AUDIO",
        modulo="reportes",
        resultado="SUCCESS",
        mensaje=f"Reporte por audio generado: {result['reporte']['tipo_reporte']}",
    )
    return Response(result, status=status.HTTP_200_OK)



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_view(request):
    denied = _require_reportes_perm(request)
    if denied:
        return denied

    # Ventas totales (últimos 30 días)
    hace_30_dias = timezone.now() - timedelta(days=30)
    ventas_30d = Venta.objects.filter(
        estado__in=['pagada', 'entregada'],
        created_at__gte=hace_30_dias
    )
    total_30d = ventas_30d.aggregate(total=Sum('total'))['total'] or 0
    cantidad_30d = ventas_30d.count()

    # Ventas hoy (puede ser 0, es normal)
    hoy = timezone.localdate()
    inicio_hoy = timezone.make_aware(timezone.datetime.combine(hoy, timezone.datetime.min.time()))
    fin_hoy = inicio_hoy + timedelta(days=1)
    ventas_hoy = Venta.objects.filter(
        estado__in=['pagada', 'entregada'],
        created_at__gte=inicio_hoy,
        created_at__lt=fin_hoy
    )
    total_hoy = ventas_hoy.aggregate(total=Sum('total'))['total'] or 0

    # Pedidos pendientes
    pedidos_pendientes = Venta.objects.filter(estado='pendiente').count()

    # Stock crítico
    stock_critico = Inventario.objects.filter(stock_actual__lte=F('stock_minimo')).count()

    # Clientes activos (últimos 30 días)
    clientes_activos = Cliente.objects.filter(
        ventas__created_at__gte=hace_30_dias,
        ventas__estado__in=['pagada', 'entregada']
    ).distinct().count()

    # Total productos
    from inventarios.models import Producto
    total_productos = Producto.objects.filter(estado=True).count()

    # Pedidos recientes (últimas 10)
    ultimas_ventas = Venta.objects.select_related('cliente').order_by('-created_at')[:10]
    pedidos = []
    for venta in ultimas_ventas:
        pedidos.append({
            "id": f"ORD-{venta.id}",
            "cliente": str(venta.cliente) if venta.cliente else "Sin cliente",
            "total": f"Bs {venta.total:,.2f}",
            "estado": venta.get_estado_display(),
            "fecha": venta.created_at.strftime("%d/%m/%Y %H:%M"),
            "origen": venta.get_origen_display(),
        })

    return Response({
        "kpis": [
            {
                "label": "Ventas (30 días)",
                "value": f"Bs {total_30d:,.2f}",
                "sub": f"{cantidad_30d} ventas",
                "icon": "ventas",
                "color": "emerald"
            },
            {
                "label": "Pedidos pendientes",
                "value": str(pedidos_pendientes),
                "sub": "Por procesar",
                "icon": "pendientes",
                "color": "amber"
            },
            {
                "label": "Stock crítico",
                "value": str(stock_critico),
                "sub": f"de {total_productos} productos",
                "icon": "stock",
                "color": "rose" if stock_critico > 0 else "emerald"
            },
            {
                "label": "Clientes activos",
                "value": str(clientes_activos),
                "sub": "Últimos 30 días",
                "icon": "clientes",
                "color": "sky"
            },
        ],
        "recentOrders": pedidos,
    })