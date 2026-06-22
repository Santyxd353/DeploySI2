import math
from datetime import datetime, time, timedelta

from django.db import transaction
from django.utils import timezone

from clientes.models import Cliente

from .models import TomaMedicamento, TratamientoActivo, TratamientoBase


class TratamientoServiceError(Exception):
    pass


def obtener_o_crear_cliente_para_usuario(usuario):
    cliente = Cliente.objects.filter(usuario=usuario, estado=True).first()
    if cliente is not None:
        return cliente

    return Cliente.objects.create(
        usuario=usuario,
        tipo="registrado",
        nombres=usuario.first_name or usuario.username or "Cliente",
        apellidos=usuario.last_name or "",
        email=usuario.email or "",
        estado=True,
    )


def _resolver_inicio_programacion(fecha_inicio):
    now = timezone.localtime()
    if fecha_inicio > now.date():
        return timezone.make_aware(datetime.combine(fecha_inicio, time(hour=8, minute=0)))
    return now.replace(second=0, microsecond=0)


def intervalo_frecuencia(tratamiento_base):
    minutos = getattr(tratamiento_base, "frecuencia_minutos", None)
    if minutos is not None and minutos >= 1:
        return timedelta(minutes=minutos)
    return timedelta(hours=max(1, tratamiento_base.frecuencia_horas))


def _fin_programacion_dt(tratamiento_activo):
    if tratamiento_activo.fecha_fin_programada is not None:
        return tratamiento_activo.fecha_fin_programada
    return timezone.make_aware(datetime.combine(tratamiento_activo.fecha_fin_esperada, time.max))


def _calcular_fechas_fin_desde_referencia(tratamiento_base, referencia_dt):
    if tratamiento_base.duracion_minutos is not None and tratamiento_base.duracion_minutos >= 1:
        fecha_fin_programada = referencia_dt + timedelta(minutes=tratamiento_base.duracion_minutos)
        fecha_fin_esperada = fecha_fin_programada.date()
    else:
        fecha_fin_programada = None
        fecha_fin_esperada = referencia_dt.date() + timedelta(days=max(1, tratamiento_base.duracion_dias) - 1)
    return fecha_fin_esperada, fecha_fin_programada


def calcular_dosis_objetivo(tratamiento_base):
    intervalo = max(1, int(intervalo_frecuencia(tratamiento_base).total_seconds() // 60))
    if tratamiento_base.duracion_minutos is not None and tratamiento_base.duracion_minutos >= 1:
        duracion_total = tratamiento_base.duracion_minutos
    else:
        duracion_total = max(1, tratamiento_base.duracion_dias) * 24 * 60
    return max(1, math.ceil(duracion_total / intervalo))


def generar_tomas_programadas(tratamiento_activo):
    base = tratamiento_activo.tratamiento_base
    inicio = _resolver_inicio_programacion(tratamiento_activo.fecha_inicio)
    fin = _fin_programacion_dt(tratamiento_activo)

    frecuencia = intervalo_frecuencia(base)
    cursor = inicio
    tomas = []

    while cursor <= fin:
        tomas.append(
            TomaMedicamento(
                tratamiento_activo=tratamiento_activo,
                fecha_hora_programada=cursor,
                estado="pendiente",
            )
        )
        cursor = cursor + frecuencia

    TomaMedicamento.objects.bulk_create(tomas)
    return len(tomas)


@transaction.atomic
def iniciar_tratamiento_para_cliente(*, cliente, tratamiento_base):
    activo_existente = TratamientoActivo.objects.filter(
        cliente=cliente,
        tratamiento_base=tratamiento_base,
        estado__in=["activo", "pausado"],
    ).exists()
    if activo_existente:
        raise TratamientoServiceError("Ya tienes este tratamiento iniciado.")

    now = timezone.now()
    fecha_inicio = timezone.localdate()
    # Hasta que el paciente confirme la primera toma real, el tratamiento permanece en pausa.
    # Guardamos fechas de fin provisionales y las recalculamos desde la primera toma real.
    fecha_fin_esperada = fecha_inicio
    fecha_fin_programada = None

    tratamiento_activo = TratamientoActivo.objects.create(
        cliente=cliente,
        tratamiento_base=tratamiento_base,
        fecha_inicio=fecha_inicio,
        fecha_fin_esperada=fecha_fin_esperada,
        fecha_fin_programada=fecha_fin_programada,
        estado="pausado",
        dosis_objetivo=0,
        dosis_tomadas=0,
        recordatorios_activos=True,
    )

    # La primera toma queda creada de inmediato, pendiente de confirmación del usuario en la app.
    TomaMedicamento.objects.create(
        tratamiento_activo=tratamiento_activo,
        fecha_hora_programada=now.replace(second=0, microsecond=0),
        estado="pendiente",
    )

    return tratamiento_activo


def activar_tratamiento_si_corresponde(tratamiento_activo, *, activation_time):
    if tratamiento_activo.estado != "pausado":
        return False

    # La primera toma real inicia el conteo del tratamiento.
    if tratamiento_activo.activado_en is None:
        fecha_fin_esperada, fecha_fin_programada = _calcular_fechas_fin_desde_referencia(
            tratamiento_activo.tratamiento_base,
            activation_time,
        )
        tratamiento_activo.estado = "activo"
        tratamiento_activo.activado_en = activation_time
        tratamiento_activo.dosis_objetivo = calcular_dosis_objetivo(tratamiento_activo.tratamiento_base)
        tratamiento_activo.fecha_inicio = activation_time.date()
        tratamiento_activo.fecha_fin_esperada = fecha_fin_esperada
        tratamiento_activo.fecha_fin_programada = fecha_fin_programada
        tratamiento_activo.pausa_desde = None
        tratamiento_activo.save(
            update_fields=[
                "estado",
                "activado_en",
            "dosis_objetivo",
                "fecha_inicio",
                "fecha_fin_esperada",
                "fecha_fin_programada",
                "pausa_desde",
                "updated_at",
            ]
        )
        return True

    # Reanuda desde la pausa y desplaza la fecha de fin esperada por la duración pausada.
    pausa_desde = tratamiento_activo.pausa_desde
    if pausa_desde is not None and activation_time > pausa_desde:
        delta = activation_time - pausa_desde
        tratamiento_activo.fecha_fin_esperada = (
            timezone.make_aware(datetime.combine(tratamiento_activo.fecha_fin_esperada, time.min)) + delta
        ).date()
        if tratamiento_activo.fecha_fin_programada is not None:
            tratamiento_activo.fecha_fin_programada = tratamiento_activo.fecha_fin_programada + delta

    tratamiento_activo.estado = "activo"
    tratamiento_activo.pausa_desde = None
    tratamiento_activo.save(update_fields=["estado", "pausa_desde", "fecha_fin_esperada", "fecha_fin_programada", "updated_at"])
    return True


def obtener_toma_objetivo(tratamiento_activo, *, toma_id=None, fecha_hora=None):
    qs = tratamiento_activo.tomas.order_by("fecha_hora_programada")

    if toma_id:
        toma = qs.filter(id=toma_id).first()
        if toma is None:
            raise TratamientoServiceError("La toma indicada no existe para este tratamiento.")
        return toma

    if fecha_hora:
        window_start = fecha_hora - timedelta(hours=2)
        window_end = fecha_hora + timedelta(hours=2)
        toma = qs.filter(
            fecha_hora_programada__gte=window_start,
            fecha_hora_programada__lte=window_end,
            estado__in=["pendiente", "pospuesta"],
        ).first()
        if toma:
            return toma

    toma = qs.filter(estado__in=["pendiente", "pospuesta"]).first()
    if toma is None:
        raise TratamientoServiceError("No hay tomas pendientes para este tratamiento.")
    return toma


def reprogramar_siguiente_toma_desde_ahora(tratamiento_activo, *, base_time=None):
    """Reinicia el ciclo desde la toma recién registrada.

    Busca la siguiente toma pendiente/pospuesta y la mueve a base_time + frecuencia.
    Si no existe una próxima toma y el tratamiento aún no terminó, crea una nueva.
    """
    reference_time = base_time or timezone.now()

    if tratamiento_activo.dosis_objetivo > 0 and tratamiento_activo.dosis_tomadas >= tratamiento_activo.dosis_objetivo:
        tratamiento_activo.estado = "completado"
        tratamiento_activo.save(update_fields=["estado", "updated_at"])
        return None

    frecuencia = intervalo_frecuencia(tratamiento_activo.tratamiento_base)
    next_due = reference_time + frecuencia

    proxima = (
        tratamiento_activo.tomas.filter(estado__in=["pendiente", "pospuesta"])
        .exclude(fecha_hora_programada__lte=reference_time)
        .order_by("fecha_hora_programada")
        .first()
    )

    if proxima is None:
        return TomaMedicamento.objects.create(
            tratamiento_activo=tratamiento_activo,
            fecha_hora_programada=next_due,
            estado="pendiente",
        )

    proxima.fecha_hora_programada = next_due
    proxima.estado = "pendiente"
    proxima.recordatorio_enviado_at = None
    proxima.recordatorio_retraso_enviado_at = None
    proxima.save(
        update_fields=[
            "fecha_hora_programada",
            "estado",
            "recordatorio_enviado_at",
            "recordatorio_retraso_enviado_at",
            "updated_at",
        ]
    )
    return proxima


def cerrar_tratamientos_expirados(*, cliente=None):
    # El cierre depende de las dosis; esta función se mantiene por compatibilidad con los llamadores.
    return 0


@transaction.atomic
def cancelar_tratamiento_para_cliente(tratamiento_activo):
    if tratamiento_activo.estado == "cancelado":
        raise TratamientoServiceError("Este tratamiento ya está cancelado.")

    if tratamiento_activo.estado in {"completado", "abandonado"}:
        raise TratamientoServiceError("Este tratamiento ya finalizó y no se puede cancelar.")

    tratamiento_activo.tomas.filter(estado__in=["pendiente", "pospuesta"]).delete()

    tratamiento_activo.estado = "cancelado"
    tratamiento_activo.recordatorios_activos = False
    tratamiento_activo.pausa_desde = None
    tratamiento_activo.save(
        update_fields=["estado", "recordatorios_activos", "pausa_desde", "updated_at"]
    )

    return tratamiento_activo


def resumen_historial_mensual(*, cliente, mes):
    year = int(mes[:4])
    month = int(mes[5:7])

    inicio = datetime(year, month, 1)
    if month == 12:
        fin = datetime(year + 1, 1, 1)
    else:
        fin = datetime(year, month + 1, 1)

    inicio_aware = timezone.make_aware(inicio)
    fin_aware = timezone.make_aware(fin)

    tomas = TomaMedicamento.objects.filter(
        tratamiento_activo__cliente=cliente,
        fecha_hora_programada__gte=inicio_aware,
        fecha_hora_programada__lt=fin_aware,
    )

    dias = {}
    for toma in tomas:
        day = toma.fecha_hora_programada.date().isoformat()
        if day not in dias:
            dias[day] = {"tomadas": 0, "incompletas": 0, "pendientes": 0, "total": 0}

        dias[day]["total"] += 1
        if toma.estado == "tomada":
            dias[day]["tomadas"] += 1
        elif toma.estado == "pendiente":
            dias[day]["pendientes"] += 1
        else:
            dias[day]["incompletas"] += 1

    payload = []
    for fecha, stats in sorted(dias.items()):
        if stats["total"] == 0:
            marca = "sin_datos"
        elif stats["tomadas"] == stats["total"]:
            marca = "completo"
        else:
            marca = "incompleto"

        payload.append({"fecha": fecha, **stats, "marca": marca})

    return payload


def detalle_historial_diario(*, cliente, fecha):
    tomas = (
        TomaMedicamento.objects.select_related(
            "tratamiento_activo",
            "tratamiento_activo__tratamiento_base",
            "tratamiento_activo__tratamiento_base__producto",
        )
        .filter(
            tratamiento_activo__cliente=cliente,
            fecha_hora_programada__date=fecha,
        )
        .order_by("fecha_hora_programada", "id")
    )

    payload = []
    total = 0
    tomadas = 0
    pendientes = 0
    incompletas = 0

    for toma in tomas:
        total += 1
        if toma.estado == "tomada":
            tomadas += 1
        elif toma.estado in {"pendiente", "pospuesta"}:
            pendientes += 1
        else:
            incompletas += 1

        base = toma.tratamiento_activo.tratamiento_base
        payload.append(
            {
                "id": toma.id,
                "estado": toma.estado,
                "fecha_hora_programada": toma.fecha_hora_programada,
                "fecha_hora_real": toma.fecha_hora_real,
                "dosis_tomada": toma.dosis_tomada,
                "tratamiento_activo_id": toma.tratamiento_activo_id,
                "tratamiento_estado": toma.tratamiento_activo.estado,
                "tratamiento_base": {
                    "id": base.id,
                    "nombre_publico": base.nombre_publico,
                    "producto_nombre": base.producto.nombre_comercial,
                    "producto_sku": base.producto.sku,
                    "unidad_dosis": base.unidad_dosis,
                    "dosis_cantidad": base.dosis_cantidad,
                    "frecuencia_horas": base.frecuencia_horas,
                    "frecuencia_minutos": base.frecuencia_minutos,
                    "duracion_dias": base.duracion_dias,
                    "duracion_minutos": base.duracion_minutos,
                    "instrucciones": base.instrucciones,
                },
            }
        )

    return {
        "fecha": fecha.isoformat(),
        "total": total,
        "tomadas": tomadas,
        "pendientes": pendientes,
        "incompletas": incompletas,
        "tomas": payload,
    }


def resumen_historial_semanal(*, cliente, semanas=4):
    hoy = timezone.localdate()
    inicio = hoy - timedelta(days=(semanas * 7) - 1)

    tomas = TomaMedicamento.objects.filter(
        tratamiento_activo__cliente=cliente,
        fecha_hora_programada__date__gte=inicio,
        fecha_hora_programada__date__lte=hoy,
    ).order_by("fecha_hora_programada")

    semanas_map = {}
    for toma in tomas:
        year, week, _ = toma.fecha_hora_programada.isocalendar()
        key = f"{year}-W{week:02d}"

        if key not in semanas_map:
            semanas_map[key] = {"semana": key, "total": 0, "tomadas": 0, "omitidas": 0}

        semanas_map[key]["total"] += 1
        if toma.estado == "tomada":
            semanas_map[key]["tomadas"] += 1
        elif toma.estado in {"omitida", "pospuesta", "pendiente"}:
            semanas_map[key]["omitidas"] += 1

    resumen = []
    total_global = 0
    tomadas_global = 0
    omitidas_global = 0

    for key in sorted(semanas_map.keys()):
        row = semanas_map[key]
        porcentaje = round((row["tomadas"] / row["total"]) * 100, 2) if row["total"] else 0
        row["cumplimiento"] = porcentaje
        resumen.append(row)

        total_global += row["total"]
        tomadas_global += row["tomadas"]
        omitidas_global += row["omitidas"]

    cumplimiento_total = round((tomadas_global / total_global) * 100, 2) if total_global else 0

    return {
        "cumplimiento_total": cumplimiento_total,
        "dosis_tomadas": tomadas_global,
        "dosis_omitidas": omitidas_global,
        "semanas": resumen,
    }
