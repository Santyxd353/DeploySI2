from rest_framework import serializers

from .models import HistorialEstadoPedido, Notificacion, Pedido


class HistorialEstadoSerializer(serializers.ModelSerializer):
    cambiado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = HistorialEstadoPedido
        fields = ["id", "estado_anterior", "estado_nuevo", "cambiado_por_nombre", "notas", "created_at"]

    def get_cambiado_por_nombre(self, obj):
        if obj.cambiado_por:
            return obj.cambiado_por.get_full_name() or obj.cambiado_por.username
        return None


class PedidoListSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.SerializerMethodField()
    cliente_email = serializers.SerializerMethodField()
    repartidor_nombre = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    numero_factura = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            "id",
            "estado",
            "cliente_nombre",
            "cliente_email",
            "repartidor_nombre",
            "total",
            "numero_factura",
            "lat_entrega",
            "lon_entrega",
            "direccion_texto",
            "created_at",
            "updated_at",
        ]

    def get_cliente_nombre(self, obj):
        c = obj.venta.cliente
        return f"{c.nombres} {c.apellidos}".strip()

    def get_cliente_email(self, obj):
        return obj.venta.cliente.email

    def get_repartidor_nombre(self, obj):
        if obj.repartidor:
            return obj.repartidor.get_full_name() or obj.repartidor.username
        return None

    def get_total(self, obj):
        return str(obj.venta.total)

    def get_numero_factura(self, obj):
        try:
            return obj.venta.factura.numero_factura
        except Exception:
            return None


class PedidoDetalleSerializer(PedidoListSerializer):
    historial = HistorialEstadoSerializer(many=True, read_only=True)
    items = serializers.SerializerMethodField()
    lat_repartidor = serializers.DecimalField(max_digits=9, decimal_places=6, read_only=True)
    lon_repartidor = serializers.DecimalField(max_digits=9, decimal_places=6, read_only=True)

    class Meta(PedidoListSerializer.Meta):
        fields = PedidoListSerializer.Meta.fields + [
            "lat_repartidor",
            "lon_repartidor",
            "aceptado_en",
            "preparando_en",
            "listo_en",
            "en_camino_en",
            "entregado_en",
            "notas_internas",
            "historial",
            "items",
        ]

    def get_items(self, obj):
        return [
            {
                "producto": d.producto.nombre_comercial,
                "cantidad": d.cantidad,
                "precio_unitario": str(d.precio_unitario),
                "subtotal": str(d.subtotal),
            }
            for d in obj.venta.detalles.select_related("producto").all()
        ]


class PedidoTrackingSerializer(serializers.ModelSerializer):
    """Usado para el estado inicial al conectarse por WebSocket."""
    estado = serializers.CharField()
    lat_entrega = serializers.DecimalField(max_digits=9, decimal_places=6, allow_null=True)
    lon_entrega = serializers.DecimalField(max_digits=9, decimal_places=6, allow_null=True)
    lat_repartidor = serializers.DecimalField(max_digits=9, decimal_places=6, allow_null=True)
    lon_repartidor = serializers.DecimalField(max_digits=9, decimal_places=6, allow_null=True)
    repartidor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            "id",
            "estado",
            "lat_entrega",
            "lon_entrega",
            "lat_repartidor",
            "lon_repartidor",
            "repartidor_nombre",
            "aceptado_en",
            "preparando_en",
            "listo_en",
            "en_camino_en",
            "entregado_en",
        ]

    def get_repartidor_nombre(self, obj):
        if obj.repartidor:
            return obj.repartidor.get_full_name() or obj.repartidor.username
        return None


class NotificacionSerializer(serializers.ModelSerializer):
    pedido_id = serializers.SerializerMethodField()

    class Meta:
        model = Notificacion
        fields = ["id", "tipo", "titulo", "mensaje", "pedido_id", "leida", "created_at"]

    def get_pedido_id(self, obj):
        return obj.pedido_id
