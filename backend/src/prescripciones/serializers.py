from rest_framework import serializers

from .models import CapturaReceta, ItemCapturaReceta


class ItemCapturaRecetaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre_comercial", read_only=True)
    tratamiento_nombre = serializers.CharField(source="tratamiento_base.nombre_publico", read_only=True)

    class Meta:
        model = ItemCapturaReceta
        fields = [
            "id",
            "orden",
            "nombre_detectado",
            "presentacion_detectada",
            "cantidad_detectada",
            "indicaciones_detectadas",
            "duracion_detectada",
            "confianza",
            "producto",
            "producto_nombre",
            "tratamiento_base",
            "tratamiento_nombre",
            "decision_cliente",
            "nombre_resuelto",
            "indicaciones_resueltas",
            "duracion_resuelta",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "producto_nombre", "tratamiento_nombre"]


class CapturaRecetaCrearSerializer(serializers.ModelSerializer):
    class Meta:
        model = CapturaReceta
        fields = [
            "id",
            "cliente",
            "archivo_imagen",
            "nombre_archivo_original",
            "mime_type",
        ]
        read_only_fields = ["id"]

    def validate_archivo_imagen(self, value):
        allowed = {"jpg", "jpeg", "png", "webp"}
        ext = value.name.rsplit(".", 1)[-1].lower() if "." in value.name else ""
        if ext not in allowed:
            raise serializers.ValidationError("La imagen debe ser JPG, PNG o WEBP.")
        if value.size > 12 * 1024 * 1024:
            raise serializers.ValidationError("La imagen no puede superar los 12 MB.")
        return value


class CapturaRecetaDetalleSerializer(serializers.ModelSerializer):
    archivo_imagen_url = serializers.SerializerMethodField()
    items = ItemCapturaRecetaSerializer(many=True, read_only=True)

    class Meta:
        model = CapturaReceta
        fields = [
            "id",
            "cliente",
            "receta_medica",
            "archivo_imagen",
            "archivo_imagen_url",
            "nombre_archivo_original",
            "mime_type",
            "estado",
            "motor_ia",
            "modelo_ia",
            "texto_extraido",
            "respuesta_ia",
            "datos_extraidos",
            "datos_resueltos",
            "carrito_enviado",
            "carrito_enviado_at",
            "requiere_revision_manual",
            "error_detalle",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_archivo_imagen_url(self, obj):
        if not obj.archivo_imagen:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.archivo_imagen.url)
        return obj.archivo_imagen.url


class CapturaRecetaActualizarSerializer(serializers.ModelSerializer):
    class Meta:
        model = CapturaReceta
        fields = [
            "datos_extraidos",
            "datos_resueltos",
            "texto_extraido",
            "requiere_revision_manual",
        ]


class ItemCapturaRecetaActualizarSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCapturaReceta
        fields = [
            "decision_cliente",
            "nombre_resuelto",
            "indicaciones_resueltas",
            "duracion_resuelta",
            "producto",
            "tratamiento_base",
        ]


class ConfirmarCapturaRecetaSerializer(serializers.Serializer):
    resumen_receta = serializers.JSONField(required=False)
    items_receta = serializers.ListField(child=serializers.JSONField(), required=False)


class AplicarCapturaRecetaSerializer(serializers.Serializer):
    item_ids_confirmados = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )
    crear_tratamientos = serializers.BooleanField(required=False, default=False)
    agregar_a_carrito = serializers.BooleanField(required=False, default=False)


class RecetaGuardadaActualizarSerializer(serializers.Serializer):
    observacion = serializers.CharField(required=False, allow_blank=True)
    fecha_vencimiento = serializers.DateField(required=False, allow_null=True)
    fecha_validez = serializers.DateField(required=False, allow_null=True)
