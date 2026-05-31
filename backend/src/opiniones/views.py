from datetime import timedelta

from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.audit import log_system_event
from core.permissions import IsPharmacistOrAdmin
from core.rbac import ROLE_CLIENTE, obtener_rol_usuario

from .models import Opinion
from .serializers import (
    MetricasSerializer,
    OpinionCreateSerializer,
    OpinionMiasSerializer,
    OpinionSerializer,
)


class OpinionPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50


class OpinionViewSet(viewsets.ModelViewSet):
    queryset = Opinion.objects.select_related(
        "cliente", "venta", "producto", "respondida_por"
    ).all()
    pagination_class = OpinionPagination
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at", "puntuacion", "estado"]
    ordering = ["-created_at"]

    # R1/R6: clientes crean, staff administra
    def get_permissions(self):
        if self.action in ("create", "mias"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsPharmacistOrAdmin()]

    def get_serializer_class(self):
        if self.action == "create":
            return OpinionCreateSerializer
        if self.action == "mias":
            return OpinionMiasSerializer
        if self.action == "metricas":
            return MetricasSerializer
        return OpinionSerializer

    # ── Creación (cliente) ────────────────────────────────────────────────────

    def create(self, request, *args, **kwargs):
        rol = obtener_rol_usuario(request.user)
        if rol != ROLE_CLIENTE:
            return Response(
                {"detail": "Solo clientes pueden crear opiniones."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not hasattr(request.user, "cliente") or request.user.cliente is None:
            return Response(
                {"detail": "Tu cuenta no tiene un perfil de cliente asociado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        log_system_event(
            request=request,
            accion="CREATE",
            modulo="opiniones",
            resultado="SUCCESS",
            mensaje=f"Opinión #{instance.id} creada — {instance.puntuacion}★ tipo={instance.tipo}",
            entidad="Opinion",
            entidad_id=str(instance.id),
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ── Listado admin con filtros ─────────────────────────────────────────────

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        tipo = params.get("tipo")
        estado = params.get("estado")
        puntuacion = params.get("puntuacion")
        fecha_desde = params.get("fecha_desde")
        fecha_hasta = params.get("fecha_hasta")
        con_venta = params.get("con_venta")
        sin_respuesta = params.get("sin_respuesta")

        if tipo:
            qs = qs.filter(tipo=tipo)
        if estado:
            qs = qs.filter(estado=estado)
        if puntuacion:
            qs = qs.filter(puntuacion=puntuacion)
        if fecha_desde:
            qs = qs.filter(created_at__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(created_at__date__lte=fecha_hasta)
        if con_venta == "true":
            qs = qs.filter(venta__isnull=False)
        elif con_venta == "false":
            qs = qs.filter(venta__isnull=True)
        if sin_respuesta == "true":
            qs = qs.filter(respuesta_staff="")

        return qs

    # ── PATCH: staff responde / cambia estado ─────────────────────────────────

    def partial_update(self, request, *args, **kwargs):
        # R7: solo estado y respuesta_staff son editables
        allowed = {"estado", "respuesta_staff"}
        data = {k: v for k, v in request.data.items() if k in allowed}

        instance = self.get_object()
        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()

        log_system_event(
            request=request,
            accion="UPDATE",
            modulo="opiniones",
            resultado="SUCCESS",
            mensaje=f"Opinión #{updated.id} actualizada — estado={updated.estado}",
            entidad="Opinion",
            entidad_id=str(updated.id),
        )
        return Response(serializer.data)

    # R6: clientes no pueden editar ni eliminar
    def update(self, request, *args, **kwargs):
        return Response(
            {"detail": "Método no permitido."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance_id = instance.id
        instance.delete()
        log_system_event(
            request=request,
            accion="DELETE",
            modulo="opiniones",
            resultado="SUCCESS",
            mensaje=f"Opinión #{instance_id} eliminada por admin.",
            entidad="Opinion",
            entidad_id=str(instance_id),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Acción: historial del cliente ─────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="mias")
    def mias(self, request):
        rol = obtener_rol_usuario(request.user)
        if rol != ROLE_CLIENTE:
            return Response(
                {"detail": "Solo clientes pueden acceder a esta acción."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not hasattr(request.user, "cliente") or request.user.cliente is None:
            return Response({"results": [], "count": 0})

        qs = Opinion.objects.filter(cliente=request.user.cliente).order_by("-created_at")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = OpinionMiasSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = OpinionMiasSerializer(qs, many=True)
        return Response(serializer.data)

    # ── Acción: métricas ─────────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="metricas")
    def metricas(self, request):
        dias = int(request.query_params.get("dias", 30))
        desde = timezone.now() - timedelta(days=dias)

        qs_total = Opinion.objects.all()
        qs_periodo = Opinion.objects.filter(created_at__gte=desde)

        total = qs_total.count()
        promedio_raw = qs_total.aggregate(p=Avg("puntuacion"))["p"]
        promedio = round(float(promedio_raw), 2) if promedio_raw else None

        dist = qs_total.values("puntuacion").annotate(n=Count("id"))
        distribucion = {str(i): 0 for i in range(1, 6)}
        for row in dist:
            distribucion[str(row["puntuacion"])] = row["n"]

        # R8: urgentes = ≤2★ + sin respuesta + >24h sin atender
        hace_24h = timezone.now() - timedelta(hours=24)
        urgentes = qs_total.filter(
            puntuacion__lte=2,
            respuesta_staff="",
            created_at__lte=hace_24h,
            estado="pendiente",
        ).count()

        respondidas = qs_total.filter(estado="respondida").count()
        porcentaje_respondidas = round(respondidas / total * 100, 1) if total else 0.0

        # Evolución diaria últimos N días
        from django.db.models.functions import TruncDate

        evolucion_qs = (
            qs_periodo.annotate(fecha=TruncDate("created_at"))
            .values("fecha")
            .annotate(total=Count("id"), promedio=Avg("puntuacion"))
            .order_by("fecha")
        )
        evolucion = [
            {
                "fecha": str(row["fecha"]),
                "total": row["total"],
                "promedio": round(float(row["promedio"]), 2) if row["promedio"] else 0,
            }
            for row in evolucion_qs
        ]

        data = {
            "total": total,
            "promedio": promedio,
            "distribucion": distribucion,
            "evolucion": evolucion,
            "urgentes": urgentes,
            "porcentaje_respondidas": porcentaje_respondidas,
        }
        serializer = MetricasSerializer(data)
        return Response(serializer.data)
