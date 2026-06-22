import logging

from django.contrib.auth import get_user_model

from .security import get_client_ip
from .models import BitacoraSistema


security_logger = logging.getLogger("security.audit")


def log_system_event(
    request,
    accion,
    modulo,
    resultado="SUCCESS",
    mensaje="",
    entidad="",
    entidad_id="",
    usuario=None,
    navegador="",
):
    try:
        actor = usuario
        if actor is None and request is not None and getattr(request, "user", None) and request.user.is_authenticated:
            actor = request.user

        BitacoraSistema.objects.create(
            usuario=actor,
            accion=str(accion or "").upper()[:50],
            modulo=str(modulo or "").lower()[:80],
            entidad=str(entidad or "")[:80],
            entidad_id=str(entidad_id or "")[:64],
            resultado=str(resultado or "SUCCESS").upper()[:20],
            mensaje=str(mensaje or "")[:255],
            ip_origen=get_client_ip(request) if request is not None else None,
            navegador=str(navegador or "")[:255],
            ruta=getattr(request, "path", "")[:255] if request is not None else "",
            metodo_http=getattr(request, "method", "")[:10] if request is not None else "",
        )
    except Exception:
        # Never block request flow if audit persistence fails.
        security_logger.exception("Failed to persist system audit event")


def log_auth_event(request, event, outcome="success", **details):
    payload = {
        "event": event,
        "outcome": outcome,
        "ip": get_client_ip(request),
        "path": request.path,
        "method": request.method,
    }

    user_agent = request.META.get("HTTP_USER_AGENT", "")
    if user_agent:
        payload["user_agent"] = user_agent[:200]

    safe_details = {key: value for key, value in details.items() if value not in (None, "")}
    payload.update(safe_details)

    security_logger.info(payload)

    normalized_event = str(event or "").strip().lower()
    if normalized_event == "refresh":
        return

    actor = None
    if request is not None and getattr(request, "user", None) and request.user.is_authenticated:
        actor = request.user
    elif safe_details.get("user_id"):
        try:
            actor = get_user_model().objects.filter(pk=safe_details.get("user_id")).first()
        except Exception:
            actor = None

    log_system_event(
        request=request,
        accion=event.replace("-", "_"),
        modulo="auth",
        resultado=outcome,
        mensaje=f"Evento de autenticacion: {event}",
        entidad="User",
        entidad_id=safe_details.get("user_id", ""),
        usuario=actor,
        navegador=user_agent,
    )
