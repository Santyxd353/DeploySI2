from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
from django.utils import timezone

from core.permissions import IsPharmacistOrAdmin

from .models import CanjePuntos, CatalogoCanje, ConfiguracionPuntos, CuentaPuntos, TransaccionPuntos
from .serializers import (
    AjustePuntosSerializer,
    CanjePuntosSerializer,
    CanjearPuntosSerializer,
    CatalogoCanjeSerializer,
    ConfiguracionPuntosSerializer,
    CuentaPuntosSerializer,
    TransaccionPuntosSerializer,
)
from .services import ajustar_puntos, canjear_catalogo, obtener_cuenta, obtener_configuracion


class MiCuentaPuntosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cliente = getattr(request.user, "cliente", None)
        if cliente is None:
            return Response({"detail": "El usuario no tiene un perfil de cliente asociado."}, status=status.HTTP_400_BAD_REQUEST)

        cuenta = obtener_cuenta(cliente)
        configuracion = obtener_configuracion(getattr(request, "tenant", None))
        return Response(
            {
                "cuenta": CuentaPuntosSerializer(cuenta, context={"request": request}).data,
                "configuracion": ConfiguracionPuntosSerializer(configuracion).data,
            }
        )


class HistorialPuntosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cliente = getattr(request.user, "cliente", None)
        if cliente is None:
            return Response({"detail": "El usuario no tiene un perfil de cliente asociado."}, status=status.HTTP_400_BAD_REQUEST)

        cuenta = obtener_cuenta(cliente)
        transacciones = cuenta.transacciones.select_related("venta", "canje", "canje__catalogo")[:100]
        serializer = TransaccionPuntosSerializer(transacciones, many=True)
        return Response(serializer.data)


class CatalogoCanjePublicoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        queryset = CatalogoCanje.objects.filter(
            activo=True,
        ).filter(
            Q(valido_hasta__isnull=True) | Q(valido_hasta__gte=today)
        )
        serializer = CatalogoCanjeSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)


class CanjearPuntosView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        cliente = getattr(request.user, "cliente", None)
        if cliente is None:
            return Response({"detail": "El usuario no tiene un perfil de cliente asociado."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CanjearPuntosSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            catalogo = CatalogoCanje.objects.get(pk=serializer.validated_data["catalogo_id"], activo=True)
            canje = canjear_catalogo(cliente, catalogo)
        except CatalogoCanje.DoesNotExist:
            return Response({"detail": "La recompensa no existe o esta inactiva."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(CanjePuntosSerializer(canje, context={"request": request}).data, status=status.HTTP_201_CREATED)


class ConfiguracionPuntosViewSet(viewsets.ModelViewSet):
    serializer_class = ConfiguracionPuntosSerializer
    permission_classes = [IsAuthenticated, IsPharmacistOrAdmin]

    def get_queryset(self):
        return ConfiguracionPuntos.objects.all()


class CuentaPuntosViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CuentaPuntosSerializer
    permission_classes = [IsAuthenticated, IsPharmacistOrAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["cliente__nombres", "cliente__apellidos", "cliente__email", "cliente__ci_nit"]
    ordering_fields = ["puntos_disponibles", "puntos_acumulados", "nivel", "actualizado_en"]
    ordering = ["-puntos_disponibles"]

    def get_queryset(self):
        queryset = CuentaPuntos.objects.select_related("cliente").all()
        cliente_id = self.request.query_params.get("cliente")
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)
        return queryset


class CatalogoCanjeViewSet(viewsets.ModelViewSet):
    serializer_class = CatalogoCanjeSerializer
    permission_classes = [IsAuthenticated, IsPharmacistOrAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre", "descripcion", "codigo_cupon_externo"]
    ordering_fields = ["puntos_requeridos", "nombre", "actualizado_en"]
    ordering = ["puntos_requeridos", "nombre"]

    def get_queryset(self):
        return CatalogoCanje.objects.select_related("producto").all()


class CanjePuntosViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CanjePuntosSerializer
    permission_classes = [IsAuthenticated, IsPharmacistOrAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["codigo_voucher", "catalogo__nombre", "cuenta__cliente__nombres", "cuenta__cliente__apellidos"]
    ordering_fields = ["creado_en", "puntos_usados", "estado"]
    ordering = ["-creado_en"]

    def get_queryset(self):
        queryset = CanjePuntos.objects.select_related("cuenta__cliente", "catalogo", "venta").all()
        cuenta_id = self.request.query_params.get("cuenta")
        cliente_id = self.request.query_params.get("cliente")
        if cuenta_id:
            queryset = queryset.filter(cuenta_id=cuenta_id)
        if cliente_id:
            queryset = queryset.filter(cuenta__cliente_id=cliente_id)
        return queryset


class TransaccionPuntosViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransaccionPuntosSerializer
    permission_classes = [IsAuthenticated, IsPharmacistOrAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["tipo", "descripcion", "cuenta__cliente__nombres", "cuenta__cliente__apellidos"]
    ordering_fields = ["creado_en", "puntos", "saldo_resultante"]
    ordering = ["-creado_en"]

    def get_queryset(self):
        queryset = TransaccionPuntos.objects.select_related("cuenta__cliente", "venta", "canje", "canje__catalogo").all()
        cuenta_id = self.request.query_params.get("cuenta")
        cliente_id = self.request.query_params.get("cliente")
        if cuenta_id:
            queryset = queryset.filter(cuenta_id=cuenta_id)
        if cliente_id:
            queryset = queryset.filter(cuenta__cliente_id=cliente_id)
        return queryset

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated, IsPharmacistOrAdmin])
    def ajuste_manual(self, request):
        serializer = AjustePuntosSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            cuenta = CuentaPuntos.objects.get(pk=serializer.validated_data["cuenta_id"])
        except CuentaPuntos.DoesNotExist:
            return Response({"detail": "La cuenta de puntos no existe."}, status=status.HTTP_404_NOT_FOUND)

        transaccion = ajustar_puntos(
            cuenta=cuenta,
            puntos=serializer.validated_data["puntos"],
            descripcion=serializer.validated_data.get("descripcion") or "Ajuste manual",
        )
        if transaccion is None:
            return Response({"detail": "No se pudo aplicar el ajuste."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(transaccion).data, status=status.HTTP_201_CREATED)