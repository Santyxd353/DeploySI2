from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.utils.dateparse import parse_date
from django.utils import timezone
from datetime import datetime, time, timedelta

from core.rbac import tiene_permiso, ROLE_FARMACEUTICO
from core.audit import log_system_event
from inventarios.services.stock_service import (
    StockServiceError,
    ajustar_stock as stock_ajustar_stock,
    aumentar_stock as stock_aumentar_stock,
    descontar_stock as stock_descontar_stock,
)
from .models import (
    Categoria,
    Subcategoria,
    Laboratorio,
    Producto,
    Inventario,
    LoteProducto,
    MovimientoInventario,
    EntradaStock,
    LimiteDispensacion,
)
from .serializers import (
    CategoriaSerializer,
    SubcategoriaSerializer,
    LaboratorioSerializer,
    ProductoSerializer,
    InventarioSerializer,
    LoteProductoSerializer,
    MovimientoInventarioSerializer,
    EntradaStockSerializer,
    LimiteDispensacionSerializer,
)


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre", "descripcion"]
    ordering_fields = ["nombre", "created_at"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        estado = self.request.query_params.get("estado")
        if estado is not None:
            queryset = queryset.filter(estado=estado.lower() == "true")
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="CREATE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Categoría creada: {instance.nombre}",
            entidad="Categoria",
            entidad_id=str(instance.id),
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="UPDATE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Categoría actualizada: {instance.nombre}",
            entidad="Categoria",
            entidad_id=str(instance.id),
        )

    def perform_destroy(self, instance):
        instance.estado = False
        instance.save()
        log_system_event(
            request=self.request,
            accion="DELETE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Categoría desactivada: {instance.nombre}",
            entidad="Categoria",
            entidad_id=str(instance.id),
        )


class SubcategoriaViewSet(viewsets.ModelViewSet):
    queryset = Subcategoria.objects.all()
    serializer_class = SubcategoriaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre", "descripcion"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        categoria_id = self.request.query_params.get("categoria")
        if categoria_id:
            queryset = queryset.filter(categoria_id=categoria_id)
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="CREATE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Subcategoría creada: {instance.nombre}",
            entidad="Subcategoria",
            entidad_id=str(instance.id),
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="UPDATE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Subcategoría actualizada: {instance.nombre}",
            entidad="Subcategoria",
            entidad_id=str(instance.id),
        )

    def perform_destroy(self, serializer):
        log_system_event(
            request=self.request,
            accion="DELETE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Subcategoría eliminada: {self.get_object().nombre}",
            entidad="Subcategoria",
            entidad_id=str(self.get_object().id),
        )
        self.get_object().delete()


class LaboratorioViewSet(viewsets.ModelViewSet):
    queryset = Laboratorio.objects.all()
    serializer_class = LaboratorioSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre", "pais", "contacto_representante"]
    ordering_fields = ["nombre", "created_at"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="CREATE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Laboratorio creado: {instance.nombre}",
            entidad="Laboratorio",
            entidad_id=str(instance.id),
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="UPDATE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Laboratorio actualizado: {instance.nombre}",
            entidad="Laboratorio",
            entidad_id=str(instance.id),
        )

    def perform_destroy(self, instance):
        log_system_event(
            request=self.request,
            accion="DELETE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Laboratorio eliminado: {instance.nombre}",
            entidad="Laboratorio",
            entidad_id=str(instance.id),
        )
        instance.delete()


class ProductoPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = ProductoPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["sku", "nombre_comercial", "nombre_generico"]
    ordering_fields = ["sku", "nombre_comercial", "precio_venta", "created_at"]

    def get_permissions(self):
        if self.action in ["list", "retrieve", "inventario", "resumen_stock", "stock_bajo", "sin_stock"]:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset().select_related("categoria", "laboratorio", "subcategoria", "inventario")

        categoria = self.request.query_params.get("categoria")
        if categoria:
            queryset = queryset.filter(categoria_id=categoria)

        subcategoria = self.request.query_params.get("subcategoria")
        if subcategoria:
            queryset = queryset.filter(subcategoria_id=subcategoria)

        laboratorio = self.request.query_params.get("laboratorio")
        if laboratorio:
            queryset = queryset.filter(laboratorio_id=laboratorio)

        estado = self.request.query_params.get("estado")
        if estado is not None:
            queryset = queryset.filter(estado=estado.lower() == "true")

        requiere_receta = self.request.query_params.get("requiere_receta")
        if requiere_receta is not None:
            queryset = queryset.filter(requiere_receta=requiere_receta.lower() == "true")

        precio_min = self.request.query_params.get("precio_min")
        if precio_min:
            queryset = queryset.filter(precio_venta__gte=precio_min)

        precio_max = self.request.query_params.get("precio_max")
        if precio_max:
            queryset = queryset.filter(precio_venta__lte=precio_max)

        stock_estado = self.request.query_params.get("stock_estado")
        if stock_estado == "sin_stock":
            queryset = queryset.filter(inventario__stock_actual__lte=0)
        elif stock_estado == "stock_bajo":
            queryset = queryset.filter(
                inventario__stock_actual__gt=0,
                inventario__stock_actual__lte=F("stock_minimo"),
            )
        elif stock_estado == "disponible":
            queryset = queryset.filter(inventario__stock_actual__gt=F("stock_minimo"))

        # Filtro específico para catálogo WEB:
        # oculta productos que tengan lotes comercialmente no vendibles.
        visible_web = self.request.query_params.get("visible_web")
        if visible_web is not None and visible_web.lower() == "true":
            queryset = queryset.exclude(
                lotes__estado__in=["bloqueado", "vencido"],
                lotes__cantidad_disponible__gt=0,
            ).distinct()

        return queryset

    @action(detail=False, methods=["get"])
    def resumen_stock(self, request):
        qs = Producto.objects.select_related("inventario").filter(estado=True)
        today = timezone.localdate()
        month_start = today.replace(day=1)
        expiry_limit = today + timedelta(days=30)
        valor_costo_expr = ExpressionWrapper(
            F("inventario__stock_actual") * F("precio_compra"),
            output_field=DecimalField(max_digits=16, decimal_places=2),
        )
        valor_venta_expr = ExpressionWrapper(
            F("inventario__stock_actual") * F("precio_venta"),
            output_field=DecimalField(max_digits=16, decimal_places=2),
        )
        agg = qs.aggregate(
            stock_total=Sum("inventario__stock_actual"),
            valor_total_costo=Sum(valor_costo_expr),
            valor_total_venta=Sum(valor_venta_expr),
        )
        sin_stock = qs.filter(inventario__stock_actual__lte=0).count()
        stock_bajo = qs.filter(
            inventario__stock_actual__gt=0,
            inventario__stock_actual__lte=F("stock_minimo"),
        ).count()
        disponible = qs.filter(inventario__stock_actual__gt=F("stock_minimo")).count()

        lotes_activos = LoteProducto.objects.select_related("producto").filter(
            producto__estado=True,
            cantidad_disponible__gt=0,
        )
        lotes_proximos = lotes_activos.filter(
            estado="disponible",
            fecha_vencimiento__gte=today,
            fecha_vencimiento__lte=expiry_limit,
        )
        lotes_vencidos = lotes_activos.filter(fecha_vencimiento__lt=today).exclude(estado__in=["retirado", "agotado"])
        lotes_bloqueados = lotes_activos.filter(estado="bloqueado").count()

        movimientos_mes = MovimientoInventario.objects.filter(fecha_movimiento__date__gte=month_start)
        entradas_mes = movimientos_mes.filter(tipo_movimiento="entrada")
        salidas_mes = movimientos_mes.filter(tipo_movimiento="salida")
        ajustes_mes = movimientos_mes.filter(tipo_movimiento="ajuste")
        mermas_mes = salidas_mes.filter(motivo__in=["merma", "devolucion_proveedor"])

        weekly = []
        week_start = today - timedelta(days=6)
        for offset in range(7):
            day = week_start + timedelta(days=offset)
            day_qs = MovimientoInventario.objects.filter(fecha_movimiento__date=day)
            entradas = day_qs.filter(tipo_movimiento="entrada").aggregate(total=Sum("cantidad"))["total"] or 0
            salidas = day_qs.filter(tipo_movimiento="salida").aggregate(total=Sum("cantidad"))["total"] or 0
            weekly.append({
                "day": day.strftime("%a"),
                "fecha": day.isoformat(),
                "entrada": int(entradas),
                "salida": int(salidas),
            })

        alertas_activas = stock_bajo + sin_stock + lotes_proximos.count() + lotes_vencidos.count() + lotes_bloqueados
        return Response({
            "total_productos": qs.count(),
            "sin_stock": sin_stock,
            "stock_bajo": stock_bajo,
            "disponible": disponible,
            "stock_total_unidades": int(agg["stock_total"] or 0),
            "valor_total_costo": str(agg["valor_total_costo"] or "0.00"),
            "valor_total_venta": str(agg["valor_total_venta"] or "0.00"),
            "alertas_activas": alertas_activas,
            "lotes_proximos_vencer": lotes_proximos.count(),
            "productos_proximos_vencer": lotes_proximos.values("producto_id").distinct().count(),
            "lotes_vencidos": lotes_vencidos.count(),
            "lotes_bloqueados": lotes_bloqueados,
            "movimientos_mes": movimientos_mes.count(),
            "entradas_mes": entradas_mes.count(),
            "salidas_mes": salidas_mes.count(),
            "ajustes_mes": ajustes_mes.count(),
            "mermas_mes": mermas_mes.count(),
            "unidades_entradas_mes": int(entradas_mes.aggregate(total=Sum("cantidad"))["total"] or 0),
            "unidades_salidas_mes": int(salidas_mes.aggregate(total=Sum("cantidad"))["total"] or 0),
            "productos_controlados": qs.filter(es_controlado=True).count(),
            "movimiento_semanal": weekly,
        })

    @action(detail=True, methods=["get"])
    def inventario(self, request, pk=None):
        producto = self.get_object()
        inventario = get_object_or_404(Inventario, producto=producto)
        serializer = InventarioSerializer(inventario)
        return Response(serializer.data)

    def perform_create(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="CREATE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Producto creado: {instance.nombre_comercial} (SKU: {instance.sku})",
            entidad="Producto",
            entidad_id=str(instance.id),
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_system_event(
            request=self.request,
            accion="UPDATE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Producto actualizado: {instance.nombre_comercial} (SKU: {instance.sku})",
            entidad="Producto",
            entidad_id=str(instance.id),
        )

    def perform_destroy(self, instance):
        log_system_event(
            request=self.request,
            accion="DELETE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Producto eliminado: {instance.nombre_comercial} (SKU: {instance.sku})",
            entidad="Producto",
            entidad_id=str(instance.id),
        )
        instance.delete()

    @action(detail=True, methods=["post"])
    def ajustar_stock(self, request, pk=None):
        producto = self.get_object()

        tipo_movimiento = request.data.get("tipo_movimiento")
        cantidad = request.data.get("cantidad")
        motivo = request.data.get("motivo")
        observacion = request.data.get("observacion", "")

        if not tipo_movimiento or not cantidad or not motivo:
            return Response({"error": "Se requiere tipo_movimiento, cantidad y motivo"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if tipo_movimiento == "ajuste":
                inventario, movimiento, _, _ = stock_ajustar_stock(
                    producto=producto,
                    nuevo_stock=int(cantidad),
                    motivo=motivo,
                    usuario=request.user,
                    observacion=observacion,
                )
            else:
                return Response(
                    {"error": "En este endpoint solo se permite tipo_movimiento='ajuste'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            log_system_event(
                request=request,
                accion="AJUSTE_STOCK",
                modulo="inventarios",
                resultado="SUCCESS",
                mensaje=f"Stock ajustado - SKU: {producto.sku} | Tipo: {tipo_movimiento} | Cantidad: {cantidad} | Motivo: {motivo}",
                entidad="Producto",
                entidad_id=str(producto.id),
            )

            return Response(
                {
                    "message": "Stock ajustado correctamente",
                    "movimiento": MovimientoInventarioSerializer(movimiento).data,
                    "inventario": InventarioSerializer(inventario).data,
                },
                status=status.HTTP_200_OK,
            )
        except StockServiceError as e:
            log_system_event(
                request=request,
                accion="AJUSTE_STOCK",
                modulo="inventarios",
                resultado="FAILURE",
                mensaje=f"Error al ajustar stock - SKU: {producto.sku} | Error: {str(e)}",
                entidad="Producto",
                entidad_id=str(producto.id),
            )
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            log_system_event(
                request=request,
                accion="AJUSTE_STOCK",
                modulo="inventarios",
                resultado="FAILURE",
                mensaje=f"Error interno al ajustar stock - SKU: {producto.sku} | Error: {str(e)}",
                entidad="Producto",
                entidad_id=str(producto.id),
            )
            return Response({"error": f"Error al ajustar stock: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=["get"])
    def stock_bajo(self, request):
        productos_bajo_stock = []
        for producto in self.get_queryset():
            if hasattr(producto, "inventario") and producto.inventario.necesita_reabastecimiento:
                productos_bajo_stock.append(producto)
        serializer = self.get_serializer(productos_bajo_stock, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def sin_stock(self, request):
        productos_sin_stock = []
        for producto in self.get_queryset():
            if hasattr(producto, "inventario") and producto.inventario.stock_disponible == 0:
                productos_sin_stock.append(producto)
        serializer = self.get_serializer(productos_sin_stock, many=True)
        return Response(serializer.data)


class LoteProductoViewSet(viewsets.ModelViewSet):
    queryset = LoteProducto.objects.all()
    serializer_class = LoteProductoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["numero_lote", "producto__sku", "producto__nombre_comercial", "proveedor"]
    ordering_fields = ["fecha_ingreso", "numero_lote", "fecha_vencimiento", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset().select_related("producto")
        producto_id = self.request.query_params.get("producto") or self.request.query_params.get("producto_id")
        if producto_id:
            queryset = queryset.filter(producto_id=producto_id)
        estado = self.request.query_params.get("estado")
        if estado:
            queryset = queryset.filter(estado=estado)
        return queryset.order_by("-fecha_ingreso")

    @action(detail=False, methods=["get"], url_path="proximos-vencer")
    def proximos_vencer(self, request):
        try:
            dias = int(request.query_params.get("dias", 30))
        except (TypeError, ValueError):
            dias = 30
        dias = max(1, min(dias, 365))
        hoy = timezone.localdate()
        limite = hoy + timedelta(days=dias)
        lotes = self.get_queryset().filter(
            estado="disponible",
            cantidad_disponible__gt=0,
            fecha_vencimiento__gte=hoy,
            fecha_vencimiento__lte=limite,
        ).order_by("fecha_vencimiento", "producto__nombre_comercial")
        return Response(self.get_serializer(lotes, many=True).data)

    @action(detail=False, methods=["get"])
    def vencidos(self, request):
        hoy = timezone.localdate()
        lotes = (
            self.get_queryset()
            .filter(cantidad_disponible__gt=0, fecha_vencimiento__lt=hoy)
            .exclude(estado__in=["agotado", "retirado"])
            .order_by("fecha_vencimiento", "producto__nombre_comercial")
        )
        return Response(self.get_serializer(lotes, many=True).data)

    @action(detail=True, methods=["patch"])
    def bloquear(self, request, pk=None):
        lote = self.get_object()
        if lote.estado in {"retirado", "vencido"}:
            return Response({"detail": "El lote ya no está disponible para bloqueo."}, status=status.HTTP_400_BAD_REQUEST)
        lote.estado = "bloqueado"
        lote.save(update_fields=["estado", "updated_at"])
        return Response(self.get_serializer(lote).data)

    @action(detail=True, methods=["post"])
    def anular(self, request, pk=None):
        lote = self.get_object()
        motivo_anulacion = request.data.get("motivo_anulacion", "alerta_fabricante")
        observacion = request.data.get("observacion", "")
        cantidad_a_descontar = int(lote.cantidad_disponible or 0)

        if cantidad_a_descontar > 0:
            motivo_mov = "merma" if motivo_anulacion == "vencimiento" else "devolucion_proveedor"
            stock_descontar_stock(
                producto=lote.producto,
                cantidad=cantidad_a_descontar,
                motivo=motivo_mov,
                referencia=f"ANUL-LOTE-{lote.id}",
                usuario=request.user,
                observacion=observacion or f"Anulación de lote {lote.numero_lote}",
                lote=lote,
            )

        lote.cantidad_disponible = 0
        lote.estado = "vencido" if motivo_anulacion == "vencimiento" else "retirado"
        lote.save(update_fields=["cantidad_disponible", "estado", "updated_at"])
        return Response(self.get_serializer(lote).data)


class MovimientoInventarioViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MovimientoInventario.objects.all()
    serializer_class = MovimientoInventarioSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["producto__nombre_comercial", "producto__sku", "referencia"]
    ordering_fields = ["fecha_movimiento", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset().select_related("producto", "usuario")

        producto_id = self.request.query_params.get("producto") or self.request.query_params.get("producto_id")
        if producto_id:
            queryset = queryset.filter(producto_id=producto_id)

        tipo = self.request.query_params.get("tipo_movimiento")
        if tipo:
            queryset = queryset.filter(tipo_movimiento=tipo)

        fecha_desde = self.request.query_params.get("fecha_desde")
        if fecha_desde:
            parsed_from = parse_date(fecha_desde)
            if parsed_from:
                dt_from = datetime.combine(parsed_from, time.min)
                if timezone.is_naive(dt_from):
                    dt_from = timezone.make_aware(dt_from)
                queryset = queryset.filter(fecha_movimiento__gte=dt_from)

        fecha_hasta = self.request.query_params.get("fecha_hasta")
        if fecha_hasta:
            parsed_to = parse_date(fecha_hasta)
            if parsed_to:
                dt_to = datetime.combine(parsed_to, time.max)
                if timezone.is_naive(dt_to):
                    dt_to = timezone.make_aware(dt_to)
                queryset = queryset.filter(fecha_movimiento__lte=dt_to)

        return queryset


class EntradaStockViewSet(viewsets.ModelViewSet):
    queryset = EntradaStock.objects.all()
    serializer_class = EntradaStockSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related("producto", "usuario", "lote").order_by("-created_at")

    def _confirmar_entrada(self, entrada, usuario, force=False):
        if entrada.estado == "anulada":
            raise StockServiceError("No se puede confirmar una entrada anulada.")
        if entrada.estado == "confirmada" and not force:
            return

        stock_aumentar_stock(
            producto=entrada.producto,
            cantidad=entrada.cantidad,
            motivo=entrada.motivo,
            referencia=entrada.referencia or "",
            usuario=usuario,
            observacion=entrada.descripcion or "",
            lote=entrada.lote,
        )

        if entrada.lote:
            entrada.lote.cantidad_disponible = F("cantidad_disponible") + entrada.cantidad
            entrada.lote.save(update_fields=["cantidad_disponible", "updated_at"])

        entrada.estado = "confirmada"
        entrada.save(update_fields=["estado", "updated_at"])

    def perform_create(self, serializer):
        instance = serializer.save(usuario=self.request.user)
        if instance.estado == "confirmada":
            self._confirmar_entrada(instance, self.request.user, force=True)
        log_system_event(
            request=self.request,
            accion="ENTRADA_STOCK",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Entrada de stock registrada - SKU: {instance.producto.sku} | Cantidad: {instance.cantidad} | Motivo: {instance.motivo}",
            entidad="EntradaStock",
            entidad_id=str(instance.id),
        )

    def perform_update(self, serializer):
        estado_anterior = serializer.instance.estado
        instance = serializer.save()
        if estado_anterior != "confirmada" and instance.estado == "confirmada":
            self._confirmar_entrada(instance, self.request.user, force=True)
        log_system_event(
            request=self.request,
            accion="UPDATE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Entrada de stock actualizada - SKU: {instance.producto.sku}",
            entidad="EntradaStock",
            entidad_id=str(instance.id),
        )

    def perform_destroy(self, instance):
        log_system_event(
            request=self.request,
            accion="DELETE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Entrada de stock eliminada - SKU: {instance.producto.sku}",
            entidad="EntradaStock",
            entidad_id=str(instance.id),
        )
        instance.delete()

    def create(self, request, *args, **kwargs):
        from core.rbac import obtener_rol_usuario

        tenant = getattr(request, "tenant", None)
        role = obtener_rol_usuario(request.user, tenant=tenant)
        if not (
            tiene_permiso(request.user, "inventario.registrar_entrada", tenant=tenant)
            or role == ROLE_FARMACEUTICO
            or request.user.is_superuser
        ):
            log_system_event(
                request=request,
                accion="ENTRADA_STOCK",
                modulo="inventarios",
                resultado="FAILURE",
                mensaje="Intento de registro de entrada sin permisos",
                entidad="EntradaStock",
                entidad_id="",
            )
            return Response(
                {"detail": "No tienes permiso para registrar entradas de stock."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def por_producto(self, request):
        producto_id = request.query_params.get("producto_id")
        if not producto_id:
            return Response({"detail": "Parámetro producto_id requerido."}, status=status.HTTP_400_BAD_REQUEST)

        entradas = self.get_queryset().filter(producto_id=producto_id)
        serializer = self.get_serializer(entradas, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def ultimas(self, request):
        entradas = self.get_queryset()[:10]
        serializer = self.get_serializer(entradas, many=True)
        return Response(serializer.data)


class LimiteDispensacionViewSet(viewsets.ModelViewSet):
    """CRUD de límites de dispensación. Solo admin y farmacéuticos pueden gestionar."""

    queryset = LimiteDispensacion.objects.select_related("producto").all()
    serializer_class = LimiteDispensacionSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        from core.rbac import obtener_rol_usuario, ROLE_ADMIN, ROLE_FARMACEUTICO

        if self.action in ["list", "retrieve", "por_producto"]:
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def _check_gestion_permission(self, request):
        from core.rbac import tiene_permiso, obtener_rol_usuario, ROLE_ADMIN, ROLE_FARMACEUTICO

        tenant = getattr(request, "tenant", None)
        if request.user.is_superuser:
            return True
        if not tiene_permiso(request.user, "productos.gestionar", tenant=tenant):
            return False
        return True

    def create(self, request, *args, **kwargs):
        if not self._check_gestion_permission(request):
            return Response(
                {"detail": "No tienes permiso para configurar límites de dispensación."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        log_system_event(
            request=request,
            accion="CREATE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Límite de dispensación creado para '{instance.producto.nombre_comercial}': máx {instance.cantidad_maxima} u. / {instance.periodo_dias} días.",
            entidad="LimiteDispensacion",
            entidad_id=str(instance.id),
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        if not self._check_gestion_permission(request):
            return Response(
                {"detail": "No tienes permiso para modificar límites de dispensación."},
                status=status.HTTP_403_FORBIDDEN,
            )
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        log_system_event(
            request=request,
            accion="UPDATE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Límite de dispensación actualizado para '{updated.producto.nombre_comercial}': máx {updated.cantidad_maxima} u. / {updated.periodo_dias} días.",
            entidad="LimiteDispensacion",
            entidad_id=str(updated.id),
        )
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        if not self._check_gestion_permission(request):
            return Response(
                {"detail": "No tienes permiso para eliminar límites de dispensación."},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance = self.get_object()
        nombre = instance.producto.nombre_comercial
        instance_id = instance.id
        instance.delete()
        log_system_event(
            request=request,
            accion="DELETE",
            modulo="inventarios",
            resultado="SUCCESS",
            mensaje=f"Límite de dispensación eliminado para '{nombre}'.",
            entidad="LimiteDispensacion",
            entidad_id=str(instance_id),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="por-producto/(?P<producto_id>[0-9]+)")
    def por_producto(self, request, producto_id=None):
        try:
            limite = LimiteDispensacion.objects.select_related("producto").get(producto_id=producto_id)
            return Response(self.get_serializer(limite).data)
        except LimiteDispensacion.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

