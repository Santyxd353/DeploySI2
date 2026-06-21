from rest_framework import serializers

from clientes.models import Cliente

from .models import DetalleVenta, Venta


class VentaItemInputSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=1)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    receta_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)


class VentaCreateInputSerializer(serializers.Serializer):
    cliente_id = serializers.IntegerField(min_value=1)
    items = VentaItemInputSerializer(many=True)
    estado = serializers.ChoiceField(choices=Venta.ESTADO_CHOICES, required=False, default="pendiente")
    descuento = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    impuesto = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    observacion = serializers.CharField(required=False, allow_blank=True)

    def validate_cliente_id(self, value):
        if not Cliente.objects.filter(id=value, estado=True).exists():
            raise serializers.ValidationError("Cliente no encontrado o inactivo.")
        return value


class POSItemInputSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=1)
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    receta_id = serializers.IntegerField(min_value=1, required=False, allow_null=True)


class POSClienteInputSerializer(serializers.Serializer):
    nombres = serializers.CharField(max_length=150)
    apellidos = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    telefono = serializers.CharField(max_length=30, required=False, allow_blank=True)
    ci_nit = serializers.CharField(max_length=30, required=False, allow_blank=True)


class POSVentaInputSerializer(serializers.Serializer):
    items = POSItemInputSerializer(many=True, min_length=1)
    cliente_id = serializers.IntegerField(min_value=1, required=False)
    cliente_data = POSClienteInputSerializer(required=False)
    estado = serializers.ChoiceField(choices=Venta.ESTADO_CHOICES, required=False, default="pagada")
    descuento = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    impuesto = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    observacion = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("cliente_id") and not attrs.get("cliente_data"):
            raise serializers.ValidationError("Debe proporcionar cliente_id o cliente_data.")
        if attrs.get("cliente_id"):
            try:
                Cliente.objects.get(id=attrs["cliente_id"], estado=True)
            except Cliente.DoesNotExist:
                raise serializers.ValidationError({"cliente_id": "Cliente no encontrado o inactivo."})
        return attrs


class DetalleVentaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source="producto.nombre_comercial")
    producto_sku = serializers.ReadOnlyField(source="producto.sku")

    class Meta:
        model = DetalleVenta
        fields = [
            "id",
            "producto",
            "producto_nombre",
            "producto_sku",
            "cantidad",
            "precio_unitario",
            "subtotal",
        ]


class VentaSerializer(serializers.ModelSerializer):
    detalles = DetalleVentaSerializer(many=True, read_only=True)

    class Meta:
        model = Venta
        fields = [
            "id",
            "cliente",
            "vendedor",
            "origen",
            "estado",
            "subtotal",
            "descuento",
            "impuesto",
            "total",
            "stripe_payment_intent_id",
            "observacion",
            "created_at",
            "updated_at",
            "detalles",
        ]
        read_only_fields = ["stripe_payment_intent_id"]


# HU-18: Serializers para Cliente
class VentaClienteSerializer(serializers.ModelSerializer):
    """
    Serializer limitado para cliente (HU-18).
    Solo muestra información relevante de sus propias compras.
    """
    detalles = DetalleVentaSerializer(many=True, read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    
    class Meta:
        model = Venta
        fields = [
            "id",
            "estado",
            "estado_label",
            "total",
            "created_at",
            "detalles",
            "observacion",
        ]
        read_only_fields = fields


# HU-36: Serializers para Admin
class VentaAdminSerializer(serializers.ModelSerializer):
    """
    Serializer completo para admin (HU-36).
    Incluye información del cliente y vendedor.
    """
    cliente_nombre = serializers.CharField(source="cliente.nombres", read_only=True)
    cliente_email = serializers.CharField(source="cliente.email", read_only=True)
    vendedor_nombre = serializers.SerializerMethodField()
    detalles = DetalleVentaSerializer(many=True, read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    origen_label = serializers.CharField(source="get_origen_display", read_only=True)
    
    class Meta:
        model = Venta
        fields = [
            "id",
            "cliente",
            "cliente_nombre",
            "cliente_email",
            "vendedor",
            "vendedor_nombre",
            "origen",
            "origen_label",
            "estado",
            "estado_label",
            "subtotal",
            "descuento",
            "impuesto",
            "total",
            "observacion",
            "created_at",
            "updated_at",
            "detalles",
        ]
    
    def get_vendedor_nombre(self, obj):
        if obj.vendedor:
            return f"{obj.vendedor.first_name} {obj.vendedor.last_name}".strip() or obj.vendedor.username
        return "Sin asignar"
