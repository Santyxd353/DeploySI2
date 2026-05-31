from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings

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
