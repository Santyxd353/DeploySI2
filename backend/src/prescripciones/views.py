from django.db.models import Prefetch
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from clientes.models import RecetaMedica
from core.audit import log_system_event
from tratamientos.services import obtener_o_crear_cliente_para_usuario

from .models import CapturaReceta, ItemCapturaReceta
from .serializers import (
    AplicarCapturaRecetaSerializer,
    CapturaRecetaActualizarSerializer,
    CapturaRecetaCrearSerializer,
    CapturaRecetaDetalleSerializer,
    ConfirmarCapturaRecetaSerializer,
    ItemCapturaRecetaActualizarSerializer,
    RecetaGuardadaActualizarSerializer,
)
from .services import AplicacionRecetaService, ProcesadorCapturaReceta, PrescripcionesServiceError


def _require_cliente(request):
    if not request.user.is_authenticated:
        return None, Response({"detail": "Debes iniciar sesión."}, status=status.HTTP_401_UNAUTHORIZED)
    cliente = obtener_o_crear_cliente_para_usuario(request.user)
    return cliente, None


def _obtener_captura(request, captura_id):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return None, None, error_response

    captura = (
        CapturaReceta.objects.filter(id=captura_id, cliente=cliente)
        .prefetch_related(Prefetch("items", queryset=ItemCapturaReceta.objects.order_by("orden", "id")))
        .first()
    )
    if captura is None:
        return None, None, Response({"detail": "Captura no encontrada."}, status=status.HTTP_404_NOT_FOUND)
    return cliente, captura, None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def crear_captura_receta(request):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return error_response

    serializer = CapturaRecetaCrearSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    captura = serializer.save(
        tenant=request.tenant,
        cliente=serializer.validated_data.get("cliente") or cliente,
        creada_por=request.user,
    )

    procesador = ProcesadorCapturaReceta()
    try:
        captura = procesador.procesar(captura)
    except NotImplementedError as exc:
        captura = procesador.marcar_fallida(captura, str(exc))
    except PrescripcionesServiceError as exc:
        captura = procesador.marcar_fallida(captura, str(exc))

    log_system_event(
        request=request,
        accion="CREATE",
        modulo="prescripciones",
        resultado="SUCCESS",
        mensaje=f"Captura de receta creada: {captura.id}",
        entidad="CapturaReceta",
        entidad_id=str(captura.id),
    )

    return Response(
        CapturaRecetaDetalleSerializer(captura, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def detalle_captura_receta(request, captura_id):
    _, captura, error_response = _obtener_captura(request, captura_id)
    if error_response:
        return error_response

    if request.method == "GET":
        return Response(CapturaRecetaDetalleSerializer(captura, context={"request": request}).data)

    serializer = CapturaRecetaActualizarSerializer(captura, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(CapturaRecetaDetalleSerializer(captura, context={"request": request}).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def actualizar_item_captura_receta(request, captura_id, item_id):
    _, captura, error_response = _obtener_captura(request, captura_id)
    if error_response:
        return error_response

    item = captura.items.filter(id=item_id).first()
    if item is None:
        return Response({"detail": "Item no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    serializer = ItemCapturaRecetaActualizarSerializer(item, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirmar_captura_receta(request, captura_id):
    _, captura, error_response = _obtener_captura(request, captura_id)
    if error_response:
        return error_response

    serializer = ConfirmarCapturaRecetaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    service = AplicacionRecetaService()
    captura = service.confirmar_captura(
        captura,
        resumen_receta=serializer.validated_data.get("resumen_receta"),
        items_receta=serializer.validated_data.get("items_receta"),
    )

    return Response(CapturaRecetaDetalleSerializer(captura, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def aplicar_captura_receta(request, captura_id):
    _, captura, error_response = _obtener_captura(request, captura_id)
    if error_response:
        return error_response

    serializer = AplicarCapturaRecetaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    service = AplicacionRecetaService()
    resultado = service.aplicar_captura(
        captura,
        item_ids_confirmados=serializer.validated_data.get("item_ids_confirmados"),
        crear_tratamientos=serializer.validated_data.get("crear_tratamientos", False),
        agregar_a_carrito=serializer.validated_data.get("agregar_a_carrito", False),
    )
    return Response(resultado, status=status.HTTP_200_OK)


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def receta_guardada_detalle(request, receta_id):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return error_response

    receta = RecetaMedica.objects.filter(id=receta_id, cliente=cliente).first()
    if receta is None:
        return Response({"detail": "Receta no encontrada."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(
            {
                "id": receta.id,
                "cliente": receta.cliente_id,
                "codigo": receta.codigo,
                "fecha_emision": receta.fecha_emision,
                "fecha_vencimiento": receta.fecha_vencimiento,
                "fecha_validez": receta.fecha_validez,
                "estado": receta.estado,
                "observacion": receta.observacion,
            }
        )

    serializer = RecetaGuardadaActualizarSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    for field, value in serializer.validated_data.items():
        setattr(receta, field, value)
    receta.save(update_fields=[*serializer.validated_data.keys(), "updated_at"])

    return Response(
        {
            "id": receta.id,
            "cliente": receta.cliente_id,
            "codigo": receta.codigo,
            "fecha_emision": receta.fecha_emision,
            "fecha_vencimiento": receta.fecha_vencimiento,
            "fecha_validez": receta.fecha_validez,
            "estado": receta.estado,
            "observacion": receta.observacion,
        }
    )
