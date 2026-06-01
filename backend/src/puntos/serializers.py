from rest_framework import serializers

from clientes.serializers import ClienteSerializer

from .models import CanjePuntos, CatalogoCanje, ConfiguracionPuntos, CuentaPuntos, TransaccionPuntos


class ConfiguracionPuntosSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionPuntos
        fields = [
            "id",
            "activo",
            "bolivianos_por_punto",
            "puntos_minimos_canje",
            "dias_expiracion",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = ["id", "creado_en", "actualizado_en"]


class CuentaPuntosSerializer(serializers.ModelSerializer):
    cliente_detalle = ClienteSerializer(source="cliente", read_only=True)

    class Meta:
        model = CuentaPuntos
        fields = [
            "id",
            "cliente",
            "cliente_detalle",
            "puntos_disponibles",
            "puntos_acumulados",
            "puntos_canjeados",
            "puntos_expirados",
            "nivel",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "cliente_detalle",
            "puntos_disponibles",
            "puntos_acumulados",
            "puntos_canjeados",
            "puntos_expirados",
            "nivel",
            "creado_en",
            "actualizado_en",
        ]


class CatalogoCanjeSerializer(serializers.ModelSerializer):
    imagen_url = serializers.SerializerMethodField()

    class Meta:
        model = CatalogoCanje
        fields = [
            "id",
            "nombre",
            "tipo",
            "descripcion",
            "imagen",
            "imagen_url",
            "puntos_requeridos",
            "valor_descuento_bs",
            "producto",
            "codigo_cupon_externo",
            "instrucciones_canje",
            "url_externa",
            "stock_disponible",
            "limite_por_cliente",
            "activo",
            "valido_hasta",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = ["id", "imagen_url", "creado_en", "actualizado_en"]

    def get_imagen_url(self, obj):
        if not obj.imagen:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.imagen.url)
        return obj.imagen.url

    def validate_stock_disponible(self, value):
        if value is None or int(value) <= 0:
            raise serializers.ValidationError("El stock debe ser mayor a 0. No se permite stock ilimitado.")
        return value


class CanjePuntosSerializer(serializers.ModelSerializer):
    catalogo_detalle = CatalogoCanjeSerializer(source="catalogo", read_only=True)

    class Meta:
        model = CanjePuntos
        fields = [
            "id",
            "cuenta",
            "catalogo",
            "catalogo_detalle",
            "venta",
            "codigo_voucher",
            "puntos_usados",
            "estado",
            "observacion",
            "aplicado_en",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = ["id", "codigo_voucher", "aplicado_en", "creado_en", "actualizado_en"]


class TransaccionPuntosSerializer(serializers.ModelSerializer):
    canje_detalle = serializers.SerializerMethodField()

    class Meta:
        model = TransaccionPuntos
        fields = [
            "id",
            "cuenta",
            "tipo",
            "puntos",
            "saldo_resultante",
            "venta",
            "canje",
            "canje_detalle",
            "descripcion",
            "creado_en",
        ]
        read_only_fields = fields

    def get_canje_detalle(self, obj):
        canje = getattr(obj, "canje", None)
        if canje is None:
            return None

        catalogo = getattr(canje, "catalogo", None)
        return {
            "id": canje.id,
            "codigo_voucher": canje.codigo_voucher,
            "estado": canje.estado,
            "puntos_usados": canje.puntos_usados,
            "creado_en": canje.creado_en,
            "aplicado_en": canje.aplicado_en,
            "catalogo_nombre": getattr(catalogo, "nombre", ""),
            "catalogo_tipo": getattr(catalogo, "tipo", ""),
        }


class CanjearPuntosSerializer(serializers.Serializer):
    catalogo_id = serializers.IntegerField()


class AjustePuntosSerializer(serializers.Serializer):
    cuenta_id = serializers.IntegerField()
    puntos = serializers.IntegerField()
    descripcion = serializers.CharField(required=False, allow_blank=True)