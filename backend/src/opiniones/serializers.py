from datetime import timedelta

from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework import serializers

from .models import Opinion


class OpinionSerializer(serializers.ModelSerializer):
    """Serializer completo para listado y detalle del staff."""

    cliente_nombre = serializers.SerializerMethodField()
    respondida_por_email = serializers.EmailField(
        source="respondida_por.email", read_only=True, allow_null=True
    )
    venta_numero = serializers.IntegerField(source="venta.id", read_only=True, allow_null=True)
    producto_nombre = serializers.CharField(
        source="producto.nombre_comercial", read_only=True, allow_null=True
    )

    class Meta:
        model = Opinion
        fields = [
            "id",
            "cliente",
            "cliente_nombre",
            "venta",
            "venta_numero",
            "producto",
            "producto_nombre",
            "tipo",
            "puntuacion",
            "comentario",
            "estado",
            "respuesta_staff",
            "respondida_por",
            "respondida_por_email",
            "fecha_respuesta",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "cliente",
            "cliente_nombre",
            "venta",
            "venta_numero",
            "producto",
            "producto_nombre",
            "tipo",
            "puntuacion",
            "comentario",
            "respondida_por",
            "respondida_por_email",
            "fecha_respuesta",
            "created_at",
            "updated_at",
        ]

    def get_cliente_nombre(self, obj):
        return f"{obj.cliente.nombres} {obj.cliente.apellidos}"

    def update(self, instance, validated_data):
        # R7: staff solo puede editar estado y respuesta_staff
        request = self.context.get("request")
        nueva_respuesta = validated_data.get("respuesta_staff", "").strip()

        if "respuesta_staff" in validated_data and nueva_respuesta:
            instance.respuesta_staff = nueva_respuesta
            instance.respondida_por = request.user if request else None
            instance.fecha_respuesta = timezone.now()
            if validated_data.get("estado") not in ("escalada", "archivada"):
                instance.estado = "respondida"

        if "estado" in validated_data:
            instance.estado = validated_data["estado"]

        instance.save()
        return instance


class OpinionCreateSerializer(serializers.ModelSerializer):
    """Serializer para creación de opiniones por parte del cliente."""

    class Meta:
        model = Opinion
        fields = [
            "id",
            "venta",
            "producto",
            "tipo",
            "puntuacion",
            "comentario",
            "estado",
            "created_at",
        ]
        read_only_fields = ["id", "estado", "created_at"]

    def validate(self, attrs):
        request = self.context["request"]
        cliente = request.user.cliente

        tipo = attrs.get("tipo", "general")
        venta = attrs.get("venta")
        producto = attrs.get("producto")

        # R2: anti-spam — máximo 1 opinión general cada 7 días
        if tipo == "general":
            hace_7_dias = timezone.now() - timedelta(days=7)
            if Opinion.objects.filter(
                cliente=cliente, tipo="general", created_at__gte=hace_7_dias
            ).exists():
                raise serializers.ValidationError(
                    {"tipo": "Ya enviaste una opinión general en los últimos 7 días."}
                )

        # R3: la venta debe pertenecer al cliente
        if venta is not None and venta.cliente_id != cliente.id:
            raise serializers.ValidationError(
                {"venta": "Esta venta no pertenece a tu cuenta."}
            )

        # R4: 1 opinión por venta
        if venta is not None and Opinion.objects.filter(cliente=cliente, venta=venta).exists():
            raise serializers.ValidationError(
                {"venta": "Ya dejaste una opinión para esta compra."}
            )

        # Consistencia tipo <-> venta/producto
        if tipo == "venta" and venta is None:
            raise serializers.ValidationError(
                {"venta": "Debes seleccionar una compra para este tipo de opinión."}
            )
        if tipo == "producto" and producto is None:
            raise serializers.ValidationError(
                {"producto": "Debes seleccionar un producto para este tipo de opinión."}
            )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        return Opinion.objects.create(cliente=request.user.cliente, **validated_data)


class OpinionMiasSerializer(serializers.ModelSerializer):
    """Serializer reducido para que el cliente vea sus propias opiniones."""

    venta_numero = serializers.IntegerField(source="venta.id", read_only=True, allow_null=True)
    producto_nombre = serializers.CharField(
        source="producto.nombre_comercial", read_only=True, allow_null=True
    )

    class Meta:
        model = Opinion
        fields = [
            "id",
            "venta",
            "venta_numero",
            "producto",
            "producto_nombre",
            "tipo",
            "puntuacion",
            "comentario",
            "estado",
            "respuesta_staff",
            "fecha_respuesta",
            "created_at",
        ]
        read_only_fields = fields


class MetricasSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    promedio = serializers.FloatField(allow_null=True)
    distribucion = serializers.DictField(child=serializers.IntegerField())
    evolucion = serializers.ListField(child=serializers.DictField())
    urgentes = serializers.IntegerField()
    porcentaje_respondidas = serializers.FloatField()
