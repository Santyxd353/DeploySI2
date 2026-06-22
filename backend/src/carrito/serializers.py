from rest_framework import serializers

from .models import Carrito, CarritoItem


class CarritoAgregarItemSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=1)


class CarritoActualizarItemSerializer(serializers.Serializer):
    cantidad = serializers.IntegerField(min_value=1)


class RecetaConfirmacionSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField(min_value=1)
    receta_id = serializers.IntegerField(min_value=1)


class CarritoConfirmarSerializer(serializers.Serializer):
    estado = serializers.CharField(required=False, default="pendiente")
    descuento = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    impuesto = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    observacion = serializers.CharField(required=False, allow_blank=True)
    recetas = RecetaConfirmacionSerializer(many=True, required=False, default=list)


class CarritoItemSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source="producto.nombre_comercial")
    producto_sku = serializers.ReadOnlyField(source="producto.sku")

    class Meta:
        model = CarritoItem
        fields = ["id", "producto", "producto_nombre", "producto_sku", "cantidad", "precio_unitario", "subtotal", "created_at", "updated_at"]


class CarritoSerializer(serializers.ModelSerializer):
    items = CarritoItemSerializer(many=True, read_only=True)

    class Meta:
        model = Carrito
        fields = ["id", "usuario", "estado", "origen", "invitado_token", "created_at", "updated_at", "items"]
        read_only_fields = ["invitado_token"]
