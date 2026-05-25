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
