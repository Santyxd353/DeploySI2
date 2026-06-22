import os
import logging
from datetime import datetime, timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from django.db.utils import ProgrammingError
from django_tenants.utils import tenant_context
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account
import requests

from .models import DispositivoNotificacion, TomaMedicamento, TratamientoActivo
from tenants.models import Tenant


logger = logging.getLogger(__name__)


INACTIVITY_ABANDON_DAYS = 3
FCM_V1_SCOPES = ("https://www.googleapis.com/auth/firebase.messaging",)


_fcm_v1_credentials = None
_fcm_v1_project_id = None


def _get_push_tokens(*, cliente_id=None):
    qs = DispositivoNotificacion.objects.filter(activo=True)
    if cliente_id is not None:
        qs = qs.filter(cliente_id=cliente_id)
    return list(qs.values_list("token", flat=True).distinct())


def _get_fcm_v1_client():
    global _fcm_v1_credentials, _fcm_v1_project_id

    project_id = getattr(settings, "FCM_PROJECT_ID", "").strip()
    service_account_file = getattr(settings, "FIREBASE_SERVICE_ACCOUNT_FILE", "").strip()

    if not project_id or not service_account_file:
        return None, None

    if not os.path.exists(service_account_file):
        logger.warning("Archivo de credenciales Firebase no encontrado: %s", service_account_file)
        return None, None

    try:
        if _fcm_v1_credentials is None or _fcm_v1_project_id != project_id:
            _fcm_v1_credentials = service_account.Credentials.from_service_account_file(
                service_account_file,
                scopes=FCM_V1_SCOPES,
            )
            _fcm_v1_project_id = project_id

        if not _fcm_v1_credentials.valid or _fcm_v1_credentials.expired:
            _fcm_v1_credentials.refresh(GoogleAuthRequest())

        return project_id, _fcm_v1_credentials.token
    except Exception as exc:
        logger.warning("No se pudo inicializar FCM HTTP v1: %s", exc)
        return None, None


def _send_push_firebase_v1(*, title, body, data=None, cliente_id=None):
    project_id, access_token = _get_fcm_v1_client()
    if not project_id or not access_token:
        return False

    tokens = _get_push_tokens(cliente_id=cliente_id)
    if not tokens:
        return False

    payload_data = {key: str(value) for key, value in {"type": "dose_reminder", **(data or {})}.items()}
    invalid_tokens = []
    sent = 0

    for token in tokens:
        payload = {
            "message": {
                "token": token,
                "notification": {
                    "title": title,
                    "body": body,
                },
                "data": payload_data,
                "android": {
                    "priority": "HIGH",
                    "notification": {
                        "sound": "default",
                        "channel_id": "dose_reminders",
                    },
                },
            }
        }

        try:
            response = requests.post(
                f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8",
                },
                json=payload,
                timeout=8,
            )
        except Exception as exc:
            logger.warning("Error enviando push FCM HTTP v1: %s", exc)
            continue

        if response.status_code < 400:
            sent += 1
            continue

        try:
            response_body = response.json()
        except ValueError:
            response_body = {"raw": response.text[:400]}

        error_info = response_body.get("error", {}) if isinstance(response_body, dict) else {}
        error_status = str(error_info.get("status", "")).upper()
        error_message = str(error_info.get("message", ""))
        if error_status == "UNREGISTERED" or (
            error_status == "INVALID_ARGUMENT"
            and "registration token" in error_message.lower()
        ):
            invalid_tokens.append(token)

        logger.warning(
            "FCM HTTP v1 falló token=%s status=%s error=%s",
            token[:12],
            response.status_code,
            response_body,
        )

    if invalid_tokens:
        DispositivoNotificacion.objects.filter(token__in=invalid_tokens).update(activo=False)

    return sent > 0


def _send_push_firebase_legacy(*, title, body, data=None, cliente_id=None):
    api_key = getattr(settings, "FCM_API_KEY", "")
    if not api_key:
        return False

    tokens = _get_push_tokens(cliente_id=cliente_id)
    if not tokens:
        return False

    request_tokens = tokens[:500]
    payload = {
        "registration_ids": request_tokens,
        "priority": "high",
        "notification": {
            "title": title,
            "body": body,
            "sound": "default",
        },
        "data": {
            "type": "dose_reminder",
            **(data or {}),
        },
    }

    try:
        response = requests.post(
            "https://fcm.googleapis.com/fcm/send",
            headers={
                "Authorization": f"key={api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=8,
        )
        if response.status_code >= 400:
            logger.warning(
                "FCM legacy envío falló status=%s body=%s",
                response.status_code,
                response.text[:400],
            )
            return False

        body_json = response.json() if response.text else {}
        failed = int(body_json.get("failure", 0))
        results = body_json.get("results", [])
        if failed and isinstance(results, list):
            invalid_errors = {"InvalidRegistration", "NotRegistered"}
            invalid_tokens = []
            for index, result in enumerate(results):
                if not isinstance(result, dict):
                    continue
                if result.get("error") in invalid_errors and index < len(request_tokens):
                    invalid_tokens.append(request_tokens[index])
            if invalid_tokens:
                DispositivoNotificacion.objects.filter(token__in=invalid_tokens).update(activo=False)

        return int(body_json.get("success", 0)) > 0
    except Exception as exc:
        logger.warning("Error enviando push FCM legacy: %s", exc)
        return False


def _marcar_abandonados_por_inactividad(*, now):
    threshold = now - timedelta(days=INACTIVITY_ABANDON_DAYS)
    candidatos = TratamientoActivo.objects.filter(
        estado__in=["activo", "pausado"],
        activado_en__isnull=False,
    )

    abandonados = 0
    for tratamiento in candidatos:
        ref = tratamiento.ultima_toma_real_at or tratamiento.activado_en
        if ref is not None and ref <= threshold:
            tratamiento.estado = "abandonado"
            tratamiento.recordatorios_activos = False
            tratamiento.save(update_fields=["estado", "recordatorios_activos", "updated_at"])
            abandonados += 1
    return abandonados


def _send_push_firebase(*, title, body, data=None, cliente_id=None):
    if getattr(settings, "FCM_PROJECT_ID", "").strip() and getattr(
        settings,
        "FIREBASE_SERVICE_ACCOUNT_FILE",
        "",
    ).strip():
        return _send_push_firebase_v1(
            title=title,
            body=body,
            data=data,
            cliente_id=cliente_id,
        )

    if getattr(settings, "FCM_API_KEY", "").strip():
        logger.warning("Usando FCM legacy fallback. Configura FCM HTTP v1 para producción.")
        return _send_push_firebase_legacy(
            title=title,
            body=body,
            data=data,
            cliente_id=cliente_id,
        )

    logger.debug("FCM no configurado. Notificación omitida: %s", title)
    return False


@shared_task
def notificar_tomas_proximas():
    now = timezone.now()
    grace_window_start = now - timedelta(minutes=15)

    total_procesados = 0
    total_enviados = 0

    for tenant in Tenant.objects.filter(status="activo").exclude(schema_name="public"):
        try:
            with tenant_context(tenant):
                abandonados_tenant = _marcar_abandonados_por_inactividad(now=now)
                tomas_pendientes = TomaMedicamento.objects.select_related(
                    "tratamiento_activo",
                    "tratamiento_activo__tratamiento_base",
                ).filter(
                    estado__in=["pendiente", "pospuesta"],
                    fecha_hora_programada__lte=now,
                    tratamiento_activo__estado__in=["activo", "pausado"],
                    tratamiento_activo__recordatorios_activos=True,
                )

                # Congela los tratamientos con dosis vencida hasta que el paciente registre la toma.
                tratamiento_ids = tomas_pendientes.values_list("tratamiento_activo_id", flat=True).distinct()
                if tratamiento_ids:
                    TratamientoActivo.objects.filter(id__in=tratamiento_ids, estado="activo").update(
                        estado="pausado",
                        pausa_desde=now,
                        updated_at=now,
                    )

                procesados_tenant = tomas_pendientes.count()
                enviados_tenant = 0

                for toma in tomas_pendientes:
                    base = toma.tratamiento_activo.tratamiento_base

                    if toma.recordatorio_enviado_at is None:
                        ok = _send_push_firebase(
                            title="Hora de tu medicamento",
                            body=f"{base.nombre_publico} - {base.dosis_cantidad} {base.unidad_dosis}",
                            data={
                                "tratamiento_id": str(toma.tratamiento_activo_id),
                                "toma_id": str(toma.id),
                                "screen": "daily_schedule",
                            },
                            cliente_id=toma.tratamiento_activo.cliente_id,
                        )
                        toma.recordatorio_enviado_at = now
                        toma.save(update_fields=["recordatorio_enviado_at", "updated_at"])
                        if ok:
                            enviados_tenant += 1

                    # Segundo recordatorio una sola vez después de 15 minutos si aún no la ha tomado.
                    if (
                        toma.recordatorio_retraso_enviado_at is None
                        and toma.fecha_hora_programada <= grace_window_start
                    ):
                        ok = _send_push_firebase(
                            title="No olvides tu medicamento",
                            body=f"Sigue pendiente: {base.nombre_publico} ({base.dosis_cantidad} {base.unidad_dosis})",
                            data={
                                "tratamiento_id": str(toma.tratamiento_activo_id),
                                "toma_id": str(toma.id),
                                "screen": "daily_schedule",
                                "delayed": "1",
                            },
                            cliente_id=toma.tratamiento_activo.cliente_id,
                        )
                        toma.recordatorio_retraso_enviado_at = now
                        toma.save(update_fields=["recordatorio_retraso_enviado_at", "updated_at"])
                        if ok:
                            enviados_tenant += 1

                total_procesados += procesados_tenant
                total_enviados += enviados_tenant

                logger.info(
                    "Recordatorios tenant %s: procesados=%s enviados=%s abandonados=%s",
                    tenant.schema_name,
                    procesados_tenant,
                    enviados_tenant,
                    abandonados_tenant,
                )
        except ProgrammingError as exc:
            logger.warning(
                "Saltando tenant %s por esquema incompleto en tratamientos: %s",
                tenant.schema_name,
                exc,
            )

    logger.info(
        "Recordatorios globales procesados: %s (enviados=%s)",
        total_procesados,
        total_enviados,
    )
    return {"procesados": total_procesados, "enviados": total_enviados}


@shared_task
def cierre_diario_tratamientos():
    today = timezone.localdate()
    day_start = timezone.make_aware(datetime.combine(today, datetime.min.time()))

    total_omitidas = 0
    total_completados = 0

    for tenant in Tenant.objects.filter(status="activo").exclude(schema_name="public"):
        try:
            with tenant_context(tenant):
                pendientes_anteriores = TomaMedicamento.objects.filter(
                    estado__in=["pendiente", "pospuesta"],
                    fecha_hora_programada__lt=day_start,
                )
                omitidas_tenant = pendientes_anteriores.count()
                pendientes_anteriores.update(estado="omitida", updated_at=timezone.now())

                # La finalización depende de las dosis; el cierre diario ya no completa automáticamente por fecha.
                cerrados_tenant = 0

                total_omitidas += omitidas_tenant
                total_completados += cerrados_tenant

                logger.info(
                    "Cierre diario tenant %s: omitidas=%s completados=%s",
                    tenant.schema_name,
                    omitidas_tenant,
                    cerrados_tenant,
                )
        except ProgrammingError as exc:
            logger.warning(
                "Saltando cierre en tenant %s por esquema incompleto en tratamientos: %s",
                tenant.schema_name,
                exc,
            )

    logger.info(
        "Cierre diario global tratamientos: omitidas=%s completados=%s",
        total_omitidas,
        total_completados,
    )

    return {
        "tomas_omitidas": total_omitidas,
        "tratamientos_completados": total_completados,
    }
