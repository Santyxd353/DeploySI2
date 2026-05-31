from datetime import timedelta

from django.db.models import Count, Max, Min, Q, Sum
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.audit import log_system_event
from core.permissions import IsPharmacistOrAdmin
from ventas.models import DetalleVenta

from .models import Cliente, RecetaMedica
from .serializers import ClienteSerializer, RecetaMedicaSerializer

_ESTADOS_COMPLETADOS = ["pagada", "entregada"]


class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombres", "apellidos", "email", "telefono", "ci_nit"]
    ordering_fields = ["nombres", "apellidos", "email", "created_at"]
    ordering = ["nombres", "apellidos"]

    @action(detail=False, methods=["get"])
    def segmentacion(self, request):
        frecuencia_min = request.query_params.get("frecuencia_min")
        inactivo_dias = request.query_params.get("inactivo_dias")

        clientes = Cliente.objects.filter(estado=True).annotate(
            num_compras=Count("ventas", filter=Q(ventas__estado__in=_ESTADOS_COMPLETADOS)),
            ultima_compra=Max("ventas__created_at", filter=Q(ventas__estado__in=_ESTADOS_COMPLETADOS)),
            monto_total=Sum("ventas__total", filter=Q(ventas__estado__in=_ESTADOS_COMPLETADOS)),
        )

        if frecuencia_min:
            clientes = clientes.filter(num_compras__gte=int(frecuencia_min))

        if inactivo_dias:
            fecha_limite = timezone.now() - timedelta(days=int(inactivo_dias))
            clientes = clientes.filter(
                Q(ultima_compra__lt=fecha_limite) | Q(ultima_compra__isnull=True)
            )

        clientes = clientes.order_by("-num_compras")

        data = [
            {
                "id": c.id,
                "nombres": c.nombres,
                "apellidos": c.apellidos,
                "email": c.email,
                "telefono": c.telefono,
                "num_compras": c.num_compras,
                "ultima_compra": c.ultima_compra,
                "monto_total": float(c.monto_total) if c.monto_total else 0,
            }
            for c in clientes
        ]

        return Response(data)

    @action(detail=True, methods=["get"], url_path="historial-compras")
    def historial_compras(self, request, pk=None):
        from core.rbac import tiene_permiso

        tenant = getattr(request, "tenant", None)
        can_see_all = tiene_permiso(request.user, "ventas.ver", tenant=tenant)

        cliente = self.get_object()

        if not can_see_all:
            mi_cliente = Cliente.objects.filter(usuario=request.user, estado=True).first()
            if not mi_cliente or mi_cliente.id != cliente.id:
                return Response(
                    {"detail": "No tienes permiso para ver el historial de este cliente."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # Ventas completadas con detalles
        ventas = cliente.ventas.filter(
            estado__in=_ESTADOS_COMPLETADOS
        ).select_related("factura").prefetch_related("detalles__producto").order_by("-created_at")

        # Resumen agregado
        agg = cliente.ventas.filter(
            estado__in=_ESTADOS_COMPLETADOS
        ).aggregate(
            total_gastado=Sum("total"),
            num_compras=Count("id"),
            primera_compra=Min("created_at"),
            ultima_compra=Max("created_at"),
        )

        total_gastado = float(agg["total_gastado"] or 0)
        num_compras = agg["num_compras"] or 0
        primera_compra = agg["primera_compra"]
        ultima_compra = agg["ultima_compra"]

        frecuencia_dias_promedio = None
        if num_compras > 1 and primera_compra and ultima_compra:
            dias_entre = (ultima_compra - primera_compra).days
            frecuencia_dias_promedio = dias_entre / (num_compras - 1) if num_compras > 1 else dias_entre

        resumen = {
            "total_gastado": total_gastado,
            "num_compras": num_compras,
            "promedio_por_compra": total_gastado / num_compras if num_compras > 0 else 0,
            "primera_compra": primera_compra,
            "ultima_compra": ultima_compra,
            "frecuencia_dias_promedio": round(frecuencia_dias_promedio, 1) if frecuencia_dias_promedio else None,
        }

        # Productos frecuentes
        productos_frecuentes = DetalleVenta.objects.filter(
            venta__cliente=cliente,
            venta__estado__in=_ESTADOS_COMPLETADOS,
        ).values("producto__nombre_comercial").annotate(
            veces_comprado=Count("id"),
            cantidad_total=Sum("cantidad"),
        ).order_by("-veces_comprado")[:10]

        # Serializar ventas
        ventas_data = [
            {
                "id": v.id,
                "created_at": v.created_at,
                "total": float(v.total),
                "subtotal": float(v.subtotal),
                "descuento": float(v.descuento),
                "impuesto": float(v.impuesto),
                "origen": v.origen,
                "estado": v.estado,
                "numero_factura": v.factura.numero_factura if hasattr(v, "factura") and v.factura else None,
                "detalles": [
                    {
                        "producto_nombre": d.producto.nombre_comercial,
                        "cantidad": d.cantidad,
                        "precio_unitario": float(d.precio_unitario),
                        "subtotal": float(d.subtotal),
                    }
                    for d in v.detalles.all()
                ],
            }
            for v in ventas
        ]

        productos_frecuentes_data = [
            {
                "nombre": p["producto__nombre_comercial"],
                "veces_comprado": p["veces_comprado"],
                "cantidad_total": p["cantidad_total"],
            }
            for p in productos_frecuentes
        ]

        return Response({
            "ventas": ventas_data,
            "resumen": resumen,
            "productos_frecuentes": productos_frecuentes_data,
        })

    def get_queryset(self):
        queryset = super().get_queryset()
        estado = self.request.query_params.get("estado")
        tipo = self.request.query_params.get("tipo")

        if estado is not None:
            queryset = queryset.filter(estado=estado.lower() == "true")

        if tipo:
            queryset = queryset.filter(tipo=tipo)

        return queryset

    def perform_create(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="CREATE",
            modulo="clientes",
            resultado="SUCCESS",
            mensaje=f"Cliente creado: {instance.nombres} {instance.apellidos}".strip(),
            entidad="Cliente",
            entidad_id=str(instance.id),
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="UPDATE",
            modulo="clientes",
            resultado="SUCCESS",
            mensaje=f"Cliente actualizado: {instance.nombres} {instance.apellidos}".strip(),
            entidad="Cliente",
            entidad_id=str(instance.id),
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.estado = False
        instance.save(update_fields=["estado", "updated_at"])

        log_system_event(
            request=request,
            accion="DELETE",
            modulo="clientes",
            resultado="SUCCESS",
            mensaje=f"Cliente desactivado: {instance.nombres} {instance.apellidos}".strip(),
            entidad="Cliente",
            entidad_id=str(instance.id),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class RecetaMedicaViewSet(viewsets.ModelViewSet):
    queryset = RecetaMedica.objects.select_related("validada_por").all()
    serializer_class = RecetaMedicaSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["fecha_emision", "fecha_vencimiento", "estado", "created_at"]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "validar"):
            return [IsAuthenticated(), IsPharmacistOrAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        cliente_id = self.request.query_params.get("cliente")
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)
        estado = self.request.query_params.get("estado")
        if estado:
            queryset = queryset.filter(estado=estado)
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="CREATE",
            modulo="clientes",
            resultado="SUCCESS",
            mensaje=f"Receta creada: {instance.codigo} para cliente {instance.cliente_id}",
            entidad="RecetaMedica",
            entidad_id=str(instance.id),
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="UPDATE",
            modulo="clientes",
            resultado="SUCCESS",
            mensaje=f"Receta actualizada: {instance.codigo}",
            entidad="RecetaMedica",
            entidad_id=str(instance.id),
        )

    def perform_destroy(self, instance):
        log_system_event(
            request=self.request,
            accion="DELETE",
            modulo="clientes",
            resultado="SUCCESS",
            mensaje=f"Receta eliminada: {instance.codigo}",
            entidad="RecetaMedica",
            entidad_id=str(instance.id),
        )
        instance.delete()

    @action(detail=True, methods=["post"])
    def validar(self, request, pk=None):
        receta = self.get_object()
        if receta.estado != "pendiente":
            return Response({"error": "Solo se pueden validar recetas en estado pendiente."}, status=status.HTTP_400_BAD_REQUEST)

        nuevo_estado = request.data.get("estado")
        if nuevo_estado not in ("aprobada", "rechazada"):
            return Response({"error": "Estado debe ser 'aprobada' o 'rechazada'."}, status=status.HTTP_400_BAD_REQUEST)

        observacion = request.data.get("observacion", "")
        receta.estado = nuevo_estado
        receta.observacion = observacion
        receta.validada_por = request.user
        receta.validada_en = timezone.now()
        receta.save(update_fields=["estado", "observacion", "validada_por", "validada_en", "updated_at"])

        log_system_event(
            request=request,
            accion="UPDATE",
            modulo="clientes",
            resultado="SUCCESS",
            mensaje=f"Receta {receta.codigo} {nuevo_estado} por {request.user}",
            entidad="RecetaMedica",
            entidad_id=str(receta.id),
        )

        serializer = self.get_serializer(receta)
        return Response(serializer.data)
