from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notificacion, Pedido
from .serializers import (
    NotificacionSerializer,
    PedidoDetalleSerializer,
    PedidoListSerializer,
    PedidoTrackingSerializer,
)
from .services import PedidoError, asignar_repartidor, cambiar_estado_pedido


def _tenant(request):
    return getattr(request, "tenant", None)


def _puede_gestionar(request):
    from core.rbac import tiene_permiso
    return tiene_permiso(request.user, "pedidos.gestionar", tenant=_tenant(request))


def _puede_ver(request):
    from core.rbac import tiene_permiso
    return tiene_permiso(request.user, "pedidos.ver", tenant=_tenant(request))


def _es_repartidor(request):
    from core.rbac import obtener_rol_usuario
    return obtener_rol_usuario(request.user, tenant=_tenant(request)) == "repartidor"


# ── Admin: listado y detalle ──────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_pedidos(request):
    if not _puede_ver(request):
        return Response({"detail": "Sin permiso para ver pedidos."}, status=status.HTTP_403_FORBIDDEN)

    qs = Pedido.objects.select_related("venta__cliente", "venta__factura", "repartidor").order_by("-created_at")

    estado = request.query_params.get("estado")
    if estado:
        qs = qs.filter(estado=estado)

    try:
        page = max(1, int(request.query_params.get("page", 1)))
        page_size = min(max(1, int(request.query_params.get("page_size", 10))), 50)
    except (ValueError, TypeError):
        page, page_size = 1, 10

    total = qs.count()
    start = (page - 1) * page_size
    pedidos = qs[start: start + page_size]

    return Response({
        "count": total,
        "page": page,
        "page_size": page_size,
        "next": page + 1 if (start + page_size) < total else None,
        "previous": page - 1 if page > 1 else None,
        "results": PedidoListSerializer(pedidos, many=True).data,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detalle_pedido(request, pedido_id):
    if not _puede_ver(request):
        return Response({"detail": "Sin permiso."}, status=status.HTTP_403_FORBIDDEN)

    pedido = get_object_or_404(
        Pedido.objects.select_related("venta__cliente", "venta__factura", "repartidor")
        .prefetch_related("venta__detalles__producto", "historial__cambiado_por"),
        id=pedido_id,
    )
    return Response(PedidoDetalleSerializer(pedido).data)


# ── Admin: cambiar estado ─────────────────────────────────────────────────────

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def cambiar_estado(request, pedido_id):
    if not _puede_gestionar(request) and not _es_repartidor(request):
        return Response({"detail": "Sin permiso."}, status=status.HTTP_403_FORBIDDEN)

    nuevo_estado = request.data.get("estado")
    notas = request.data.get("notas", "")

    if not nuevo_estado:
        return Response({"detail": "El campo 'estado' es requerido."}, status=status.HTTP_400_BAD_REQUEST)

    pedido = get_object_or_404(Pedido, id=pedido_id)

    # Repartidor solo puede cambiar sus propios pedidos asignados
    if _es_repartidor(request) and not _puede_gestionar(request):
        if pedido.repartidor_id != request.user.id:
            return Response({"detail": "No tienes acceso a este pedido."}, status=status.HTTP_403_FORBIDDEN)

    try:
        pedido = cambiar_estado_pedido(pedido, nuevo_estado, usuario=request.user, notas=notas)
    except PedidoError as exc:
        return Response({"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST)

    return Response(PedidoDetalleSerializer(
        Pedido.objects.select_related("venta__cliente", "repartidor")
        .prefetch_related("venta__detalles__producto", "historial__cambiado_por")
        .get(id=pedido.id)
    ).data)


# ── Admin: asignar repartidor ─────────────────────────────────────────────────

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def asignar_repartidor_view(request, pedido_id):
    if not _puede_gestionar(request):
        return Response({"detail": "Sin permiso."}, status=status.HTTP_403_FORBIDDEN)

    repartidor_id = request.data.get("repartidor_id")
    if not repartidor_id:
        return Response({"detail": "El campo 'repartidor_id' es requerido."}, status=status.HTTP_400_BAD_REQUEST)

    from django.contrib.auth import get_user_model
    User = get_user_model()

    repartidor = get_object_or_404(User, id=repartidor_id)
    pedido = get_object_or_404(Pedido, id=pedido_id)

    pedido = asignar_repartidor(pedido, repartidor, usuario=request.user)

    return Response(PedidoDetalleSerializer(
        Pedido.objects.select_related("venta__cliente", "repartidor")
        .prefetch_related("venta__detalles__producto", "historial__cambiado_por")
        .get(id=pedido.id)
    ).data)


# ── Admin: listar repartidores disponibles ────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_repartidores(request):
    if not _puede_ver(request):
        return Response({"detail": "Sin permiso."}, status=status.HTTP_403_FORBIDDEN)

    from tenants.models import TenantUser
    from django.contrib.auth import get_user_model

    User = get_user_model()
    tenant = _tenant(request)

    repartidor_ids = TenantUser.objects.filter(
        tenant=tenant,
        role="repartidor",
        is_active=True,
    ).values_list("user_id", flat=True)

    repartidores = User.objects.filter(id__in=repartidor_ids)

    data = [
        {
            "id": u.id,
            "nombre": u.get_full_name() or u.username,
            "email": u.email,
        }
        for u in repartidores
    ]
    return Response({"results": data})


# ── Cliente: mis pedidos y tracking ──────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mis_pedidos(request):
    from clientes.models import Cliente

    cliente = Cliente.objects.filter(usuario=request.user, estado=True).first()
    if not cliente:
        return Response({"results": []})

    pedidos = (
        Pedido.objects
        .filter(venta__cliente=cliente)
        .select_related("venta__factura", "repartidor")
        .order_by("-created_at")
    )

    return Response({"results": PedidoListSerializer(pedidos, many=True).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tracking_pedido(request, pedido_id):
    from clientes.models import Cliente

    pedido = get_object_or_404(
        Pedido.objects
        .select_related("venta__cliente", "venta__factura", "repartidor")
        .prefetch_related("venta__detalles__producto", "historial__cambiado_por"),
        id=pedido_id,
    )

    # El cliente solo puede ver su propio pedido; staff/admin ve cualquiera
    if not (request.user.is_staff or request.user.is_superuser):
        cliente = Cliente.objects.filter(usuario=request.user).first()
        if not cliente or pedido.venta.cliente_id != cliente.id:
            return Response({"detail": "No tienes acceso a este pedido."}, status=status.HTTP_403_FORBIDDEN)

    return Response(PedidoDetalleSerializer(pedido).data)


# ── Repartidor: mis entregas ──────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mis_entregas(request):
    pedidos = (
        Pedido.objects
        .filter(repartidor=request.user)
        .exclude(estado__in=["entregado", "cancelado"])
        .select_related("venta__cliente", "venta__factura")
        .order_by("-created_at")
    )
    return Response({"results": PedidoListSerializer(pedidos, many=True).data})


# ── Notificaciones in-app (campana) ──────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mis_notificaciones(request):
    solo_no_leidas = request.query_params.get("no_leidas") == "true"
    qs = Notificacion.objects.filter(destinatario=request.user)
    if solo_no_leidas:
        qs = qs.filter(leida=False)

    try:
        page = max(1, int(request.query_params.get("page", 1)))
        page_size = min(max(1, int(request.query_params.get("page_size", 20))), 50)
    except (ValueError, TypeError):
        page, page_size = 1, 20

    total = qs.count()
    no_leidas = Notificacion.objects.filter(destinatario=request.user, leida=False).count()
    start = (page - 1) * page_size
    notifs = qs[start: start + page_size]

    return Response({
        "count": total,
        "no_leidas": no_leidas,
        "page": page,
        "page_size": page_size,
        "results": NotificacionSerializer(notifs, many=True).data,
    })


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def marcar_leida(request, notif_id):
    notif = get_object_or_404(Notificacion, id=notif_id, destinatario=request.user)
    notif.leida = True
    notif.save(update_fields=["leida"])
    return Response({"ok": True})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def marcar_todas_leidas(request):
    Notificacion.objects.filter(destinatario=request.user, leida=False).update(leida=True)
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def contador_no_leidas(request):
    count = Notificacion.objects.filter(destinatario=request.user, leida=False).count()
    return Response({"no_leidas": count})
