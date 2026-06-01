from rest_framework import serializers

from .models import CampanaPublicitaria, SegmentoRFM


class SegmentoRFMSerializer(serializers.ModelSerializer):
    class Meta:
        model = SegmentoRFM
        fields = ["id", "codigo", "nombre", "descripcion"]


class CampanaPublicitariaSerializer(serializers.ModelSerializer):
    segmentos = SegmentoRFMSerializer(many=True, read_only=True)
    segmentos_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=SegmentoRFM.objects.all(),
        write_only=True,
        source="segmentos",
        required=False,
    )
    imagen_url = serializers.SerializerMethodField()

    class Meta:
        model = CampanaPublicitaria
        fields = [
            "id",
            "titulo",
            "descripcion",
            "imagen",
            "imagen_url",
            "descuento",
            "segmentos",
            "segmentos_ids",
            "fecha_inicio",
            "fecha_fin",
            "activa",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"imagen": {"write_only": True, "required": False}}

    def get_imagen_url(self, obj):
        if not obj.imagen:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.imagen.url)
        return obj.imagen.url

    def create(self, validated_data):
        segmentos = validated_data.pop("segmentos", [])
        campana = CampanaPublicitaria.objects.create(**validated_data)
        campana.segmentos.set(segmentos)
        return campana

    def update(self, instance, validated_data):
        segmentos = validated_data.pop("segmentos", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if segmentos is not None:
            instance.segmentos.set(segmentos)
        return instance
