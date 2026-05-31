from datetime import date, timedelta

from django.db.models import Count, Exists, Max, OuterRef, Q
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from core.audit import log_system_event
from core.permissions import IsPharmacistOrAdmin
from core.rbac import ROLE_ADMIN, ROLE_CLIENTE, obtener_rol_usuario

from .models import CampanaPublicitaria, SegmentoRFM
from .serializers import CampanaPublicitariaSerializer, SegmentoRFMSerializer

_ESTADOS_COMPLETADOS = ["pagada", "entregada"]


def _clasificar_segmento_rfm(cliente):
    """Retorna el codigo de SegmentoRFM que corresponde al cliente según sus compras."""
    from ventas.models import Venta

    stats = Venta.objects.filter(
        cliente=cliente, estado__in=_ESTADOS_COMPLETADOS
    ).aggregate(
        num_compras=Count("id"),
        ultima_compra=Max("created_at"),
    )

    num_compras = stats["num_compras"] or 0
    ultima_compra = stats["ultima_compra"]

    hoy = date.today()

    if num_compras == 0 or ultima_compra is None:
        return SegmentoRFM.INACTIVOS

    dias_inactivo = (hoy - ultima_compra.date()).days

    if num_compras >= 10 and dias_inactivo <= 30:
        return SegmentoRFM.CHAMPIONS
    if num_compras >= 3 and dias_inactivo > 60:
        return SegmentoRFM.EN_RIESGO
    if num_compras >= 5:
        return SegmentoRFM.FRECUENTES
    if dias_inactivo <= 60:
        return SegmentoRFM.NUEVOS
    return SegmentoRFM.INACTIVOS


class CampanaPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class SegmentoRFMViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SegmentoRFM.objects.all()
    serializer_class = SegmentoRFMSerializer
    permission_classes = [IsAuthenticated]


class CampanaPublicitariaViewSet(viewsets.ModelViewSet):
    queryset = CampanaPublicitaria.objects.prefetch_related("segmentos").all()
    serializer_class = CampanaPublicitariaSerializer
    pagination_class = CampanaPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["titulo", "descripcion"]
    ordering_fields = ["created_at", "fecha_inicio", "fecha_fin", "activa"]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action == "activas":
            return [AllowAny()]
        return [IsAuthenticated(), IsPharmacistOrAdmin()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        log_system_event(
            request=request,
            accion="CREATE",
            modulo="publicidad",
            resultado="SUCCESS",
            mensaje=f"Campaña '{instance.titulo}' creada.",
            entidad="CampanaPublicitaria",
            entidad_id=str(instance.id),
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        log_system_event(
            request=request,
            accion="UPDATE",
            modulo="publicidad",
            resultado="SUCCESS",
            mensaje=f"Campaña '{updated.titulo}' actualizada.",
            entidad="CampanaPublicitaria",
            entidad_id=str(updated.id),
        )
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        titulo = instance.titulo
        instance_id = instance.id
        instance.delete()
        log_system_event(
            request=request,
            accion="DELETE",
            modulo="publicidad",
            resultado="SUCCESS",
            mensaje=f"Campaña '{titulo}' eliminada.",
            entidad="CampanaPublicitaria",
            entidad_id=str(instance_id),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Endpoint público: campañas activas filtradas por segmento del cliente ──

    @action(detail=False, methods=["get"], url_path="activas")
    def activas(self, request):
        hoy = date.today()
        qs = CampanaPublicitaria.objects.prefetch_related("segmentos").filter(
            activa=True,
            fecha_inicio__lte=hoy,
            fecha_fin__gte=hoy,
        )

        # Clientes autenticados: filtrar por su segmento RFM
        if (
            request.user.is_authenticated
            and obtener_rol_usuario(request.user) == ROLE_CLIENTE
            and hasattr(request.user, "cliente")
            and request.user.cliente
        ):
            codigo_segmento = _clasificar_segmento_rfm(request.user.cliente)
            Through = CampanaPublicitaria.segmentos.through

            # Campañas que tienen un segmento que coincide con el del cliente
            tiene_match = Through.objects.filter(
                campanapublicitaria_id=OuterRef("pk"),
                segmentorfm__codigo__in=[codigo_segmento, SegmentoRFM.TODOS],
            )
            # Campañas que NO tienen ningún segmento asignado (aplican a todos)
            tiene_algun_segmento = Through.objects.filter(
                campanapublicitaria_id=OuterRef("pk"),
            )
            qs = qs.filter(
                Q(Exists(tiene_match)) | ~Q(Exists(tiene_algun_segmento))
            )

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
