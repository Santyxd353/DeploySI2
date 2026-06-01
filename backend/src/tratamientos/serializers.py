from django.utils import timezone
from rest_framework import serializers

from .models import TomaMedicamento, TratamientoActivo, TratamientoBase


class TratamientoBaseAdminSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source="producto.nombre_comercial")
    producto_sku = serializers.ReadOnlyField(source="producto.sku")

    class Meta:
        model = TratamientoBase
        fields = [
            "id",
            "producto",
            "producto_nombre",
            "producto_sku",
            "nombre_publico",
            "dosis_cantidad",
            "unidad_dosis",
            "frecuencia_horas",
            "frecuencia_minutos",
            "duracion_dias",
            "duracion_minutos",
            "instrucciones",
            "activo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "producto_nombre", "producto_sku"]

    def validate(self, attrs):
        frecuencia_horas = attrs.get("frecuencia_horas")
        frecuencia_minutos = attrs.get("frecuencia_minutos")
        duracion_dias = attrs.get("duracion_dias")
        duracion_minutos = attrs.get("duracion_minutos")
        dosis_cantidad = attrs.get("dosis_cantidad")

        if dosis_cantidad is not None and dosis_cantidad <= 0:
            raise serializers.ValidationError({"dosis_cantidad": "La dosis debe ser mayor que 0."})

        if frecuencia_horas is not None and frecuencia_horas < 1:
            raise serializers.ValidationError({"frecuencia_horas": "La frecuencia en horas debe ser mayor o igual a 1."})

        if frecuencia_minutos is not None and frecuencia_minutos < 1:
            raise serializers.ValidationError({"frecuencia_minutos": "La frecuencia en minutos debe ser mayor o igual a 1."})

        if duracion_dias is not None and duracion_dias < 1:
            raise serializers.ValidationError({"duracion_dias": "La duración en días debe ser mayor o igual a 1."})

        if duracion_minutos is not None and duracion_minutos < 1:
            raise serializers.ValidationError({"duracion_minutos": "La duración en minutos debe ser mayor o igual a 1."})

        return attrs


class TratamientoDisponibleSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source="producto.nombre_comercial")
    producto_sku = serializers.ReadOnlyField(source="producto.sku")
    producto_presentacion = serializers.ReadOnlyField(source="producto.presentacion")
    producto_imagen = serializers.ImageField(source="producto.imagen", read_only=True)

    class Meta:
        model = TratamientoBase
        fields = [
            "id",
            "producto",
            "producto_nombre",
            "producto_sku",
            "producto_presentacion",
            "producto_imagen",
            "nombre_publico",
            "dosis_cantidad",
            "unidad_dosis",
            "frecuencia_horas",
            "frecuencia_minutos",
            "duracion_dias",
            "duracion_minutos",
            "instrucciones",
        ]


class TomaMedicamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TomaMedicamento
        fields = [
            "id",
            "fecha_hora_programada",
            "fecha_hora_real",
            "estado",
            "dosis_tomada",
        ]


class TratamientoActivoSerializer(serializers.ModelSerializer):
    tratamiento_base = TratamientoDisponibleSerializer(read_only=True)
    tomas_hoy = serializers.SerializerMethodField()
    proxima_toma = serializers.SerializerMethodField()

    class Meta:
        model = TratamientoActivo
        fields = [
            "id",
            "tratamiento_base",
            "fecha_inicio",
            "activado_en",
            "dosis_objetivo",
            "dosis_tomadas",
            "ultima_toma_real_at",
            "fecha_fin_esperada",
            "fecha_fin_programada",
            "pausa_desde",
            "estado",
            "recordatorios_activos",
            "tomas_hoy",
            "proxima_toma",
        ]

    def get_tomas_hoy(self, obj):
        today = timezone.localdate()
        tomas = obj.tomas.filter(fecha_hora_programada__date=today).order_by("fecha_hora_programada")
        return TomaMedicamentoSerializer(tomas, many=True).data

    def get_proxima_toma(self, obj):
        toma = obj.tomas.filter(estado__in=["pendiente", "pospuesta"]).order_by("fecha_hora_programada").first()
        return toma.fecha_hora_programada if toma else None


class IniciarTratamientoSerializer(serializers.Serializer):
    tratamiento_base_id = serializers.IntegerField()


class RegistrarTomaSerializer(serializers.Serializer):
    toma_id = serializers.IntegerField(required=False)
    fecha_hora = serializers.DateTimeField(required=False)

    def validate(self, attrs):
        if not attrs.get("toma_id") and not attrs.get("fecha_hora"):
            raise serializers.ValidationError("Debes enviar toma_id o fecha_hora.")
        return attrs


class PosponerTomaSerializer(serializers.Serializer):
    toma_id = serializers.IntegerField(required=False)
    minutos = serializers.IntegerField(required=False, min_value=1, max_value=180, default=10)


class OmitirTomaSerializer(serializers.Serializer):
    toma_id = serializers.IntegerField(required=False)


class RegistrarTokenDispositivoSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=512)
    plataforma = serializers.ChoiceField(
        choices=["android", "ios", "web", "unknown"],
        required=False,
        default="unknown",
    )

    def validate_token(self, value):
        token = value.strip()
        if not token:
            raise serializers.ValidationError("El token de dispositivo es obligatorio.")
        return token
