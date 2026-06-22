import logging

from django.utils import timezone

from .models import HistorialEstadoPedido, Notificacion, Pedido

logger = logging.getLogger(__name__)

# Transiciones de estado permitidas
TRANSICIONES_VALIDAS = {
    "pagado": ["aceptado", "cancelado"],
    "aceptado": ["preparando", "cancelado"],
    "preparando": ["listo", "cancelado"],
    "listo": ["en_camino", "cancelado"],
    "en_camino": ["cerca", "entregado", "no_entregado"],
    "cerca": ["entregado", "no_entregado"],
    "entregado": [],
    "no_entregado": ["en_camino", "cancelado"],
    "cancelado": [],
}

# Títulos y mensajes para push/campana según estado
MENSAJES_ESTADO = {
    "aceptado": ("Pedido aceptado ✓", "Tu pedido fue aceptado y está siendo procesado."),
    "preparando": ("Preparando tu pedido 📦", "La farmacia está preparando tu pedido."),
    "listo": ("Pedido listo 🚀", "Tu pedido está listo para ser enviado."),
    "en_camino": ("¡Tu pedido viene en camino! 🛵", "Tu repartidor está en camino con tu pedido."),
    "cerca": ("¡Casi llega! 📍", "Tu pedido está cerca de tu ubicación."),
    "entregado": ("Pedido entregado ✅", "Tu pedido fue entregado exitosamente. ¡Gracias!"),
    "no_entregado": ("No pudimos entregar 😕", "No se pudo entregar tu pedido. Nos comunicaremos contigo."),
    "cancelado": ("Pedido cancelado", "Tu pedido ha sido cancelado."),
}

# Campos de timestamp por estado
_TIMESTAMP_FIELDS = {
    "aceptado": "aceptado_en",
    "preparando": "preparando_en",
    "listo": "listo_en",
    "en_camino": "en_camino_en",
    "entregado": "entregado_en",
}


class PedidoError(Exception):
    def __init__(self, mensaje, code="error"):
        super().__init__(mensaje)
        self.code = code


def cambiar_estado_pedido(pedido, nuevo_estado, *, usuario=None, notas=""):
    """Cambia el estado del pedido validando la máquina de estados."""
    estado_anterior = pedido.estado

    validos = TRANSICIONES_VALIDAS.get(estado_anterior, [])
    if nuevo_estado not in validos:
        raise PedidoError(
            f"Transición inválida: '{estado_anterior}' → '{nuevo_estado}'. "
            f"Permitidas: {validos or 'ninguna'}.",
            code="transicion_invalida",
        )

    update_fields = ["estado", "updated_at"]
    pedido.estado = nuevo_estado

    if nuevo_estado in _TIMESTAMP_FIELDS:
        campo = _TIMESTAMP_FIELDS[nuevo_estado]
        setattr(pedido, campo, timezone.now())
        update_fields.append(campo)

    pedido.save(update_fields=update_fields)

    HistorialEstadoPedido.objects.create(
        pedido=pedido,
        estado_anterior=estado_anterior,
        estado_nuevo=nuevo_estado,
        cambiado_por=usuario,
        notas=notas,
    )

    _notificar_cambio_estado(pedido, nuevo_estado)
    _broadcast_estado(pedido, nuevo_estado)

    return pedido


def asignar_repartidor(pedido, repartidor, *, usuario=None):
    """Asigna un repartidor al pedido y le envía notificación."""
    pedido.repartidor = repartidor
    pedido.save(update_fields=["repartidor", "updated_at"])

    # Notificación in-app al repartidor
    Notificacion.objects.create(
        destinatario=repartidor,
        tipo="repartidor_asignado",
        titulo="Nuevo pedido asignado 🛵",
        mensaje=f"Se te asignó el pedido #{pedido.id}. Está listo para entrega.",
        pedido=pedido,
    )

    # Push al repartidor
    _enviar_push_usuario(
        usuario=repartidor,
        titulo="Nuevo pedido asignado 🛵",
        mensaje=f"Se te asignó el pedido #{pedido.id}. Está listo para entrega.",
        data={"tipo": "pedido", "pedido_id": str(pedido.id)},
    )

    # Broadcast WebSocket
    _broadcast_estado(pedido, pedido.estado, extra={"repartidor_asignado": True})

    return pedido


def crear_notificacion_admin(pedido, tenant):
    """Crea notificaciones in-app para todos los admin/farmacéutico del tenant."""
    from django.contrib.auth import get_user_model
    from tenants.models import TenantUser

    User = get_user_model()

    staff_ids = TenantUser.objects.filter(
        tenant=tenant,
        role__in=["admin", "farmaceutico"],
        is_active=True,
    ).values_list("user_id", flat=True)

    for user in User.objects.filter(id__in=staff_ids):
        Notificacion.objects.create(
            destinatario=user,
            tipo="pedido_nuevo",
            titulo="Nuevo pedido recibido 🛒",
            mensaje=f"Pedido #{pedido.id} recibido. Total: {pedido.venta.total} Bs.",
            pedido=pedido,
        )

    _broadcast_nuevo_pedido_admin(pedido, tenant)


# ── Notificaciones internas ───────────────────────────────────────────────────

def _notificar_cambio_estado(pedido, nuevo_estado):
    if nuevo_estado not in MENSAJES_ESTADO:
        return

    titulo, mensaje = MENSAJES_ESTADO[nuevo_estado]
    tipo = f"pedido_{nuevo_estado}"

    cliente_user = getattr(pedido.venta.cliente, "usuario", None)
    if cliente_user:
        Notificacion.objects.create(
            destinatario=cliente_user,
            tipo=tipo,
            titulo=titulo,
            mensaje=mensaje,
            pedido=pedido,
        )
        _enviar_push_cliente(pedido, titulo, mensaje)


def _enviar_push_cliente(pedido, titulo, mensaje):
    try:
        from tratamientos.tasks import _send_push_firebase_v1
        cliente = pedido.venta.cliente
        _send_push_firebase_v1(
            title=titulo,
            body=mensaje,
            data={"tipo": "pedido", "pedido_id": str(pedido.id)},
            cliente_id=cliente.id,
        )
    except Exception as exc:
        logger.warning("Push cliente pedido #%s falló: %s", pedido.id, exc)


def _enviar_push_usuario(*, usuario, titulo, mensaje, data=None):
    """Push a un usuario concreto usando sus dispositivos registrados."""
    try:
        from tratamientos.tasks import _send_push_firebase_v1
        from tratamientos.models import DispositivoNotificacion
        from clientes.models import Cliente

        cliente = Cliente.objects.filter(usuario=usuario).first()
        if not cliente:
            return

        _send_push_firebase_v1(
            title=titulo,
            body=mensaje,
            data=data or {},
            cliente_id=cliente.id,
        )
    except Exception as exc:
        logger.warning("Push usuario %s falló: %s", usuario.id, exc)


# ── WebSocket broadcasts ──────────────────────────────────────────────────────

def _broadcast_estado(pedido, nuevo_estado, extra=None):
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from django.db import connection

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        payload = {
            "tipo": "cambio_estado",
            "estado": nuevo_estado,
            "pedido_id": pedido.id,
            "timestamp": timezone.now().isoformat(),
        }
        if extra:
            payload.update(extra)

        msg = {"type": "pedido.update", "data": payload}

        # Notificar al cliente/repartidor que sigue este pedido
        async_to_sync(channel_layer.group_send)(f"pedido_{pedido.id}", msg)

        # Notificar también al dashboard admin (cambios de estado en tiempo real)
        tenant = getattr(connection, "tenant", None)
        if tenant and getattr(tenant, "schema_name", "public") != "public":
            async_to_sync(channel_layer.group_send)(
                f"admin_pedidos_{tenant.schema_name}", msg
            )
    except Exception as exc:
        logger.warning("WebSocket broadcast pedido #%s falló: %s", pedido.id, exc)


def _broadcast_nuevo_pedido_admin(pedido, tenant):
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        async_to_sync(channel_layer.group_send)(
            f"admin_pedidos_{tenant.schema_name}",
            {
                "type": "pedido.nuevo",
                "data": {
                    "tipo": "pedido_nuevo",
                    "pedido_id": pedido.id,
                    "total": str(pedido.venta.total),
                    "timestamp": timezone.now().isoformat(),
                },
            },
        )
    except Exception as exc:
        logger.warning("WebSocket broadcast admin pedido #%s falló: %s", pedido.id, exc)
