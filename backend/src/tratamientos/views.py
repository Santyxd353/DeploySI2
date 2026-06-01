from datetime import datetime, timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.audit import log_system_event
from core.rbac import tiene_permiso
from inventarios.models import Producto

from .models import DispositivoNotificacion, TratamientoActivo, TratamientoBase
from .serializers import (
    IniciarTratamientoSerializer,
    OmitirTomaSerializer,
    PosponerTomaSerializer,
    RegistrarTokenDispositivoSerializer,
    RegistrarTomaSerializer,
    TratamientoActivoSerializer,
    TratamientoBaseAdminSerializer,
    TratamientoDisponibleSerializer,
)
from .services import (
    activar_tratamiento_si_corresponde,
    cancelar_tratamiento_para_cliente,
    cerrar_tratamientos_expirados,
    detalle_historial_diario,
    TratamientoServiceError,
    iniciar_tratamiento_para_cliente,
    obtener_o_crear_cliente_para_usuario,
    obtener_toma_objetivo,
    reprogramar_siguiente_toma_desde_ahora,
    resumen_historial_mensual,
    resumen_historial_semanal,
)


class AdminTratamientosPagination(PageNumberPagination):
    page_size = 8
    page_size_query_param = "page_size"
    max_page_size = 50


def _require_admin_permission(request, permission_code):
    tenant = getattr(request, "tenant", None)
    if request.user.is_superuser or tiene_permiso(request.user, permission_code, tenant=tenant):
        return None
    return Response({"detail": "No tienes permisos para esta acción."}, status=status.HTTP_403_FORBIDDEN)


def _require_cliente(request):
    if not request.user.is_authenticated:
        return None, Response({"detail": "Debes iniciar sesión."}, status=status.HTTP_401_UNAUTHORIZED)

    cliente = obtener_o_crear_cliente_para_usuario(request.user)
    return cliente, None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def admin_tratamientos_base_list_create(request):
    if request.method == "GET":
        denied = _require_admin_permission(request, "tratamientos.ver")
        if denied:
            return denied

        qs = TratamientoBase.objects.select_related("producto").order_by("-updated_at")
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(nombre_publico__icontains=q)
                | Q(producto__nombre_comercial__icontains=q)
                | Q(producto__sku__icontains=q)
            )

        activo = request.query_params.get("activo")
        if activo is not None:
            qs = qs.filter(activo=activo.lower() == "true")

        paginator = AdminTratamientosPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = TratamientoBaseAdminSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    denied = _require_admin_permission(request, "tratamientos.gestionar")
    if denied:
        return denied

    serializer = TratamientoBaseAdminSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    instance = serializer.save()

    log_system_event(
        request=request,
        accion="CREATE",
        modulo="tratamientos",
        resultado="SUCCESS",
        mensaje=f"Tratamiento base creado: {instance.nombre_publico}",
        entidad="TratamientoBase",
        entidad_id=str(instance.id),
    )

    return Response(TratamientoBaseAdminSerializer(instance).data, status=status.HTTP_201_CREATED)


@api_view(["PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_tratamiento_base_detail(request, tratamiento_id):
    tratamiento = TratamientoBase.objects.filter(id=tratamiento_id).first()
    if tratamiento is None:
        return Response({"detail": "Tratamiento base no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    if request.method in ["PUT", "PATCH"]:
        denied = _require_admin_permission(request, "tratamientos.gestionar")
        if denied:
            return denied

        serializer = TratamientoBaseAdminSerializer(tratamiento, data=request.data, partial=request.method == "PATCH")
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        log_system_event(
            request=request,
            accion="UPDATE",
            modulo="tratamientos",
            resultado="SUCCESS",
            mensaje=f"Tratamiento base actualizado: {instance.nombre_publico}",
            entidad="TratamientoBase",
            entidad_id=str(instance.id),
        )

        return Response(TratamientoBaseAdminSerializer(instance).data, status=status.HTTP_200_OK)

    denied = _require_admin_permission(request, "tratamientos.gestionar")
    if denied:
        return denied

    tratamiento.activo = False
    tratamiento.save(update_fields=["activo", "updated_at"])

    log_system_event(
        request=request,
        accion="DELETE",
        modulo="tratamientos",
        resultado="SUCCESS",
        mensaje=f"Tratamiento base desactivado: {tratamiento.nombre_publico}",
        entidad="TratamientoBase",
        entidad_id=str(tratamiento.id),
    )

    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_buscar_productos(request):
    denied = _require_admin_permission(request, "tratamientos.ver")
    if denied:
        return denied

    q = (request.query_params.get("q") or "").strip()

    productos = Producto.objects.filter(estado=True)
    if q:
        productos = productos.filter(Q(nombre_comercial__icontains=q) | Q(sku__icontains=q))

    productos = productos.order_by("nombre_comercial")[:20]

    data = []
    for producto in productos:
        tratamiento_existente = TratamientoBase.objects.filter(producto=producto).first()
        data.append(
            {
                "id": producto.id,
                "sku": producto.sku,
                "nombre_comercial": producto.nombre_comercial,
                "presentacion": producto.presentacion,
                "tiene_tratamiento_base": bool(tratamiento_existente and tratamiento_existente.activo),
                "tratamiento_base_id": tratamiento_existente.id if tratamiento_existente else None,
            }
        )

    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cliente_tratamientos_disponibles(request):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return error_response

    iniciados_ids = TratamientoActivo.objects.filter(
        cliente=cliente,
        estado__in=["activo", "pausado"],
    ).values_list("tratamiento_base_id", flat=True)

    disponibles = (
        TratamientoBase.objects.select_related("producto")
        .filter(activo=True, producto__estado=True)
        .exclude(id__in=iniciados_ids)
        .order_by("nombre_publico")
    )

    serializer = TratamientoDisponibleSerializer(disponibles, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cliente_mis_tratamientos(request):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return error_response

    cerrar_tratamientos_expirados(cliente=cliente)

    tratamientos = (
        TratamientoActivo.objects.select_related("tratamiento_base", "tratamiento_base__producto")
        .filter(cliente=cliente, estado__in=["activo", "pausado"])
        .order_by("-created_at")
    )

    serializer = TratamientoActivoSerializer(tratamientos, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cliente_iniciar_tratamiento(request):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return error_response

    serializer = IniciarTratamientoSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    tratamiento_base = TratamientoBase.objects.filter(
        id=serializer.validated_data["tratamiento_base_id"],
        activo=True,
        producto__estado=True,
    ).first()
    if tratamiento_base is None:
        return Response({"detail": "Tratamiento base no disponible."}, status=status.HTTP_404_NOT_FOUND)

    try:
        tratamiento_activo = iniciar_tratamiento_para_cliente(cliente=cliente, tratamiento_base=tratamiento_base)
    except TratamientoServiceError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    log_system_event(
        request=request,
        accion="CREATE",
        modulo="tratamientos",
        resultado="SUCCESS",
        mensaje=f"Cliente inició tratamiento {tratamiento_base.nombre_publico}",
        entidad="TratamientoActivo",
        entidad_id=str(tratamiento_activo.id),
    )

    return Response(TratamientoActivoSerializer(tratamiento_activo).data, status=status.HTTP_201_CREATED)


def _resolver_tratamiento_cliente(request, tratamiento_id):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return None, error_response

    tratamiento = TratamientoActivo.objects.filter(id=tratamiento_id, cliente=cliente).first()
    if tratamiento is None:
        return None, Response({"detail": "Tratamiento activo no encontrado."}, status=status.HTTP_404_NOT_FOUND)

    return tratamiento, None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cliente_marcar_toma(request, tratamiento_id):
    tratamiento, error_response = _resolver_tratamiento_cliente(request, tratamiento_id)
    if error_response:
        return error_response

    if tratamiento.estado == "completado":
        return Response({"detail": "Este tratamiento ya está completado."}, status=status.HTTP_400_BAD_REQUEST)

    serializer = RegistrarTomaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        toma = obtener_toma_objetivo(
            tratamiento,
            toma_id=serializer.validated_data.get("toma_id"),
            fecha_hora=serializer.validated_data.get("fecha_hora"),
        )
    except TratamientoServiceError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    toma.estado = "tomada"
    toma.fecha_hora_real = timezone.now()
    toma.dosis_tomada = tratamiento.tratamiento_base.dosis_cantidad
    toma.recordatorio_enviado_at = timezone.now()
    toma.recordatorio_retraso_enviado_at = timezone.now()
    toma.save(
        update_fields=[
            "estado",
            "fecha_hora_real",
            "dosis_tomada",
            "recordatorio_enviado_at",
            "recordatorio_retraso_enviado_at",
            "updated_at",
        ]
    )

    activar_tratamiento_si_corresponde(tratamiento, activation_time=toma.fecha_hora_real)
    tratamiento.refresh_from_db(
        fields=[
            "estado",
            "fecha_inicio",
            "fecha_fin_esperada",
            "fecha_fin_programada",
            "dosis_tomadas",
            "dosis_objetivo",
        ]
    )

    tratamiento.dosis_tomadas = tratamiento.dosis_tomadas + 1
    tratamiento.ultima_toma_real_at = toma.fecha_hora_real
    if tratamiento.dosis_objetivo > 0 and tratamiento.dosis_tomadas >= tratamiento.dosis_objetivo:
        tratamiento.estado = "completado"
        tratamiento.save(update_fields=["dosis_tomadas", "ultima_toma_real_at", "estado", "updated_at"])
    else:
        tratamiento.save(update_fields=["dosis_tomadas", "ultima_toma_real_at", "updated_at"])

    if tratamiento.estado != "completado":
        reprogramar_siguiente_toma_desde_ahora(tratamiento, base_time=toma.fecha_hora_real)

    tratamiento.refresh_from_db(fields=["estado"])
    return Response(
        {
            "detail": "Toma registrada correctamente.",
            "toma_id": toma.id,
            "tratamiento_estado": tratamiento.estado,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cliente_posponer_toma(request, tratamiento_id):
    tratamiento, error_response = _resolver_tratamiento_cliente(request, tratamiento_id)
    if error_response:
        return error_response

    serializer = PosponerTomaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        toma = obtener_toma_objetivo(tratamiento, toma_id=serializer.validated_data.get("toma_id"))
    except TratamientoServiceError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    minutos = serializer.validated_data.get("minutos", 10)
    toma.fecha_hora_programada = toma.fecha_hora_programada + timedelta(minutes=minutos)
    toma.estado = "pospuesta"
    toma.save(update_fields=["fecha_hora_programada", "estado", "updated_at"])

    return Response(
        {
            "detail": "Toma pospuesta correctamente.",
            "toma_id": toma.id,
            "nueva_fecha_hora": toma.fecha_hora_programada,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cliente_omitir_toma(request, tratamiento_id):
    tratamiento, error_response = _resolver_tratamiento_cliente(request, tratamiento_id)
    if error_response:
        return error_response

    serializer = OmitirTomaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        toma = obtener_toma_objetivo(tratamiento, toma_id=serializer.validated_data.get("toma_id"))
    except TratamientoServiceError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    toma.estado = "omitida"
    toma.save(update_fields=["estado", "updated_at"])

    return Response({"detail": "Toma marcada como omitida.", "toma_id": toma.id}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cliente_cancelar_tratamiento(request, tratamiento_id):
    tratamiento, error_response = _resolver_tratamiento_cliente(request, tratamiento_id)
    if error_response:
        return error_response

    try:
        cancelar_tratamiento_para_cliente(tratamiento)
    except TratamientoServiceError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    log_system_event(
        request=request,
        accion="UPDATE",
        modulo="tratamientos",
        resultado="SUCCESS",
        mensaje=f"Cliente canceló tratamiento {tratamiento.tratamiento_base.nombre_publico}",
        entidad="TratamientoActivo",
        entidad_id=str(tratamiento.id),
    )

    return Response(
        {
            "detail": "Tratamiento cancelado correctamente.",
            "tratamiento_id": tratamiento.id,
            "tratamiento_estado": tratamiento.estado,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cliente_registrar_token_dispositivo(request):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return error_response

    serializer = RegistrarTokenDispositivoSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    token = serializer.validated_data["token"]
    plataforma = serializer.validated_data.get("plataforma", "unknown")

    dispositivo, _ = DispositivoNotificacion.objects.update_or_create(
        token=token,
        defaults={
            "cliente": cliente,
            "plataforma": plataforma,
            "activo": True,
        },
    )

    return Response(
        {
            "detail": "Token de dispositivo registrado correctamente.",
            "dispositivo_id": dispositivo.id,
            "plataforma": dispositivo.plataforma,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cliente_desactivar_tokens_dispositivo(request):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return error_response

    DispositivoNotificacion.objects.filter(cliente=cliente, activo=True).update(activo=False, updated_at=timezone.now())
    return Response({"detail": "Tokens desactivados correctamente."}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cliente_historial_mensual(request):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return error_response

    mes = (request.query_params.get("mes") or timezone.localdate().strftime("%Y-%m")).strip()
    if len(mes) != 7 or mes[4] != "-":
        return Response({"detail": "Parámetro mes inválido. Usa YYYY-MM."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        payload = resumen_historial_mensual(cliente=cliente, mes=mes)
    except Exception:
        return Response({"detail": "No se pudo calcular el historial mensual."}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"mes": mes, "dias": payload}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cliente_historial_diario(request):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return error_response

    fecha_raw = (request.query_params.get("fecha") or timezone.localdate().isoformat()).strip()
    try:
        fecha = datetime.strptime(fecha_raw, "%Y-%m-%d").date()
    except ValueError:
        return Response(
            {"detail": "Parámetro fecha inválido. Usa YYYY-MM-DD."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    payload = detalle_historial_diario(cliente=cliente, fecha=fecha)
    return Response(payload, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cliente_historial_semanal(request):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return error_response

    data = resumen_historial_semanal(cliente=cliente, semanas=4)
    return Response(data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cliente_historial_tratamientos(request):
    cliente, error_response = _require_cliente(request)
    if error_response:
        return error_response

    tratamientos = (
        TratamientoActivo.objects.select_related("tratamiento_base", "tratamiento_base__producto")
        .filter(cliente=cliente)
        .order_by("-updated_at")
    )

    payload = []
    for t in tratamientos:
        total_tomas = t.tomas.count()
        tomadas = t.tomas.filter(estado="tomada").count()
        omitidas = t.tomas.filter(estado="omitida").count()
        pendientes = t.tomas.filter(estado__in=["pendiente", "pospuesta"]).count()

        payload.append(
            {
                "id": t.id,
                "estado": t.estado,
                "fecha_inicio": t.fecha_inicio,
                "activado_en": t.activado_en,
                "fecha_fin_esperada": t.fecha_fin_esperada,
                "fecha_fin_programada": t.fecha_fin_programada,
                "pausa_desde": t.pausa_desde,
                "dosis_objetivo": t.dosis_objetivo,
                "dosis_tomadas": t.dosis_tomadas,
                "ultima_toma_real_at": t.ultima_toma_real_at,
                "tratamiento_base": {
                    "id": t.tratamiento_base.id,
                    "nombre_publico": t.tratamiento_base.nombre_publico,
                    "producto_nombre": t.tratamiento_base.producto.nombre_comercial,
                    "unidad_dosis": t.tratamiento_base.unidad_dosis,
                    "dosis_cantidad": t.tratamiento_base.dosis_cantidad,
                    "frecuencia_horas": t.tratamiento_base.frecuencia_horas,
                    "frecuencia_minutos": t.tratamiento_base.frecuencia_minutos,
                    "duracion_dias": t.tratamiento_base.duracion_dias,
                    "duracion_minutos": t.tratamiento_base.duracion_minutos,
                },
                "resumen": {
                    "total_tomas_registradas": total_tomas,
                    "tomadas": tomadas,
                    "omitidas": omitidas,
                    "pendientes": pendientes,
                },
            }
        )

    return Response({"tratamientos": payload}, status=status.HTTP_200_OK)
