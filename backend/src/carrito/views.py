from django.shortcuts import get_object_or_404
from clientes.models import Cliente
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from core.audit import log_system_event
from reportes.services import ReporteError, transcribir_audio_local
from ventas.serializers import VentaSerializer
from ventas.services import VentaServiceError, crear_venta_service

from .models import Carrito
from .serializers import CarritoActualizarItemSerializer, CarritoAgregarItemSerializer, CarritoConfirmarSerializer, CarritoSerializer
from .services import CarritoServiceError, actualizar_item_carrito, agregar_item_carrito, calcular_totales_carrito, eliminar_item_carrito, obtener_o_crear_carrito_activo
from .voice_search import parse_voice_search_command


def _es_admin_operativo(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def _get_or_create_cliente(usuario):
    """Get or create a Cliente record for an authenticated user."""
    from django.db import connection as _conn

    tenant = getattr(_conn, "tenant", None)
    cliente, created = Cliente.all_objects.get_or_create(
        usuario=usuario,
        defaults={
            "tipo": "registrado",
            "nombres": usuario.first_name or usuario.email.split("@")[0],
            "apellidos": usuario.last_name or "",
            "email": usuario.email,
            "tenant": tenant,
        },
    )
    if created and tenant and not cliente.tenant_id:
        cliente.tenant = tenant
        cliente.save(update_fields=["tenant"])
    return cliente


def _extraer_token_invitado(request):
    return request.headers.get("X-Carrito-Token") or request.data.get("carrito_token") or request.query_params.get("carrito_token") or ""


def _validar_token_invitado(request, carrito):
    if carrito and carrito.usuario:
        return None
    if not carrito:
        return None
    token = _extraer_token_invitado(request)
    if not token:
        return Response({"detail": "carrito_token es requerido para usuario invitado."}, status=status.HTTP_403_FORBIDDEN)
    if token != carrito.invitado_token:
        return Response({"detail": "carrito_token invalido."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _asegurar_token_carrito(carrito, usuario):
    """Asegura que el carrito tenga un token si es de invitado"""
    if not usuario and not carrito.invitado_token:
        carrito.ensure_guest_token()
        carrito.save(update_fields=["invitado_token"])
    return carrito


@api_view(["POST"])
@permission_classes([AllowAny])
def carrito_agregar(request):
    serializer = CarritoAgregarItemSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    
    usuario = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    
    try:
        carrito = obtener_o_crear_carrito_activo(usuario=usuario)
        # Asegurar token para invitados
        carrito = _asegurar_token_carrito(carrito, usuario)
        
        agregar_item_carrito(carrito=carrito, producto_id=data["producto_id"], cantidad=data["cantidad"])
    except CarritoServiceError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    payload = CarritoSerializer(carrito).data
    payload.update(calcular_totales_carrito(carrito))
    return Response(payload, status=status.HTTP_200_OK)


@api_view(["PATCH", "DELETE"])
@permission_classes([AllowAny])
def carrito_item_detalle(request, item_id):
    usuario = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    carrito = Carrito.objects.filter(usuario=usuario, estado="activo").order_by("-updated_at").first()
    if not carrito:
        return Response({"detail": "No existe carrito activo."}, status=status.HTTP_404_NOT_FOUND)

    token_denegado = _validar_token_invitado(request, carrito)
    if token_denegado:
        return token_denegado

    if request.method == "PATCH":
        serializer = CarritoActualizarItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            actualizar_item_carrito(carrito=carrito, item_id=item_id, cantidad=serializer.validated_data["cantidad"])
        except CarritoServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    else:
        try:
            eliminar_item_carrito(carrito=carrito, item_id=item_id)
        except CarritoServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    payload = CarritoSerializer(carrito).data
    payload.update(calcular_totales_carrito(carrito))
    return Response(payload, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def carrito_listar(request):
    usuario = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    carrito = Carrito.objects.filter(usuario=usuario, estado="activo").order_by("-updated_at").first()
    
    if not carrito:
        carrito = obtener_o_crear_carrito_activo(usuario=usuario)
        # Asegurar token para invitados recién creados
        carrito = _asegurar_token_carrito(carrito, usuario)

    # Solo validar token si el usuario está autenticado
    # Para invitados, no validamos en GET porque el token aún no está en el header
    if usuario:
        token_denegado = _validar_token_invitado(request, carrito)
        if token_denegado:
            return token_denegado

    payload = CarritoSerializer(carrito).data
    payload.update(calcular_totales_carrito(carrito))
    return Response(payload, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def carrito_confirmar(request):
    serializer = CarritoConfirmarSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    
    usuario = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    if not usuario:
        return Response({"detail": "Debes iniciar sesion para confirmar el carrito."}, status=status.HTTP_403_FORBIDDEN)
    
    carrito = Carrito.objects.filter(usuario=usuario, estado="activo").order_by("-updated_at").first()
    if not carrito:
        return Response({"detail": "No existe carrito activo."}, status=status.HTTP_404_NOT_FOUND)

    items = list(carrito.items.select_related("producto").all())
    if not items:
        return Response({"detail": "El carrito esta vacio."}, status=status.HTTP_400_BAD_REQUEST)

    receta_por_producto = {row["producto_id"]: row["receta_id"] for row in data.get("recetas", [])}
    venta_items = [
        {
            "producto_id": item.producto_id,
            "cantidad": item.cantidad,
            "precio_unitario": item.precio_unitario,
            "receta_id": receta_por_producto.get(item.producto_id),
        }
        for item in items
    ]

    try:
        venta = crear_venta_service(
                        cliente=_get_or_create_cliente(usuario),
            items=venta_items,
            origen="online",
            vendedor=None,
            estado=data.get("estado", "pendiente"),
            descuento=data.get("descuento", 0),
            impuesto=data.get("impuesto", 0),
            observacion=data.get("observacion", ""),
        )
    except VentaServiceError as exc:
        log_system_event(
            request=request,
            accion="CONFIRMAR",
            modulo="carrito",
            resultado="FAILURE",
            mensaje=f"Error al confirmar carrito: {str(exc)}",
            entidad="Carrito",
            entidad_id=str(carrito.id),
        )
        return Response({"detail": str(exc), "code": exc.code}, status=status.HTTP_400_BAD_REQUEST)

    carrito.estado = "confirmado"
    carrito.save(update_fields=["estado", "updated_at"])

    return Response({"carrito_id": carrito.id, "venta": VentaSerializer(venta).data}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def carrito_buscar_audio(request):
    audio = request.FILES.get("audio")
    try:
        transcripcion = transcribir_audio_local(audio)
        interpretacion = parse_voice_search_command(transcripcion)
    except ReporteError as exc:
        return Response({"detail": str(exc), "code": getattr(exc, "code", "audio_invalido")}, status=status.HTTP_400_BAD_REQUEST)

    if request.user and request.user.is_authenticated:
        log_system_event(
            request=request,
            accion="BUSQUEDA_AUDIO",
            modulo="carrito",
            resultado="SUCCESS",
            mensaje=f"Busqueda por audio: {interpretacion.get('intent', 'unknown')}",
            entidad="Carrito",
        )

    return Response(
        {
            "transcripcion": transcripcion,
            "texto": transcripcion,
            "interpretacion": interpretacion,
        },
        status=status.HTTP_200_OK,
    )