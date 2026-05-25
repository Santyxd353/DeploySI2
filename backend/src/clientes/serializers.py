from django.utils import timezone
from rest_framework import serializers

from .models import Cliente, MedicoReceta, RecetaMedica


class MedicoRecetaSerializer(serializers.ModelSerializer):
    firma_imagen_url = serializers.SerializerMethodField()

    class Meta:
        model = MedicoReceta
        fields = ["id", "nombre", "licencia", "especialidad", "firma_imagen_url"]

    def get_firma_imagen_url(self, obj):
        if not obj.firma_imagen:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.firma_imagen.url)
        return obj.firma_imagen.url


class RecetaMedicaSerializer(serializers.ModelSerializer):
    archivo_url = serializers.SerializerMethodField()
    dias_para_vencer = serializers.SerializerMethodField()
    medico = MedicoRecetaSerializer(read_only=True)

    # Flat write-only fields for medico (multipart-friendly)
    medico_nombre = serializers.CharField(write_only=True, required=False, allow_blank=True)
    medico_licencia = serializers.CharField(write_only=True, required=False, allow_blank=True)
    medico_especialidad = serializers.CharField(write_only=True, required=False, allow_blank=True)
    medico_firma_imagen = serializers.ImageField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = RecetaMedica
        fields = [
            "id",
            "cliente",
            "codigo",
            "archivo",
            "archivo_url",
            "fecha_emision",
            "fecha_vencimiento",
            "dias_para_vencer",
            "estado",
            "observacion",
            "validada_por",
            "validada_en",
            "medico",
            "medico_nombre",
            "medico_licencia",
            "medico_especialidad",
            "medico_firma_imagen",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "archivo_url", "dias_para_vencer",
            "validada_por", "validada_en", "medico",
            "created_at", "updated_at",
        ]
        extra_kwargs = {"archivo": {"write_only": True, "required": False}}

    def get_dias_para_vencer(self, obj):
        if not obj.fecha_vencimiento:
            return None
        return (obj.fecha_vencimiento - timezone.now().date()).days

    def get_archivo_url(self, obj):
        if not obj.archivo:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.archivo.url)
        return obj.archivo.url

    def validate_medico_firma_imagen(self, value):
        if not value:
            return value
        allowed = {"jpg", "jpeg", "png"}
        ext = value.name.rsplit(".", 1)[-1].lower()
        if ext not in allowed:
            raise serializers.ValidationError("La firma debe ser JPG o PNG.")
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("La firma no puede superar los 5 MB.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        instance = self.instance
        codigo = attrs.get("codigo", getattr(instance, "codigo", None))

        if codigo and request and hasattr(request, "tenant"):
            qs = RecetaMedica.objects.filter(tenant=request.tenant, codigo=codigo)
            if instance:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"codigo": "Ya existe una receta con este código en esta farmacia."}
                )

        return attrs

    def _pop_medico_data(self, validated_data):
        return {
            "nombre": (validated_data.pop("medico_nombre", "") or "").strip(),
            "licencia": (validated_data.pop("medico_licencia", "") or "").strip(),
            "especialidad": (validated_data.pop("medico_especialidad", "") or "").strip(),
            "firma_imagen": validated_data.pop("medico_firma_imagen", None),
        }

    def create(self, validated_data):
        medico_data = self._pop_medico_data(validated_data)
        receta = super().create(validated_data)
        if medico_data["nombre"]:
            MedicoReceta.objects.create(receta=receta, **medico_data)
        return receta

    def update(self, instance, validated_data):
        medico_data = self._pop_medico_data(validated_data)
        receta = super().update(instance, validated_data)
        if medico_data["nombre"]:
            defaults = {
                "nombre": medico_data["nombre"],
                "licencia": medico_data["licencia"],
                "especialidad": medico_data["especialidad"],
            }
            if medico_data["firma_imagen"] is not None:
                defaults["firma_imagen"] = medico_data["firma_imagen"]
            MedicoReceta.objects.update_or_create(receta=receta, defaults=defaults)
        return receta


class ClienteSerializer(serializers.ModelSerializer):
    usuario_email = serializers.ReadOnlyField(source="usuario.email")

    class Meta:
        model = Cliente
        fields = [
            "id",
            "usuario",
            "usuario_email",
            "tipo",
            "nombres",
            "apellidos",
            "email",
            "telefono",
            "ci_nit",
            "direccion",
            "fecha_nacimiento",
            "genero",
            "alergias",
            "medicamentos_frecuentes",
            "medico_habitual",
            "observaciones",
            "estado",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "usuario_email"]

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        email = (attrs.get("email") or getattr(instance, "email", "") or "").strip().lower()
        ci_nit = (attrs.get("ci_nit") or getattr(instance, "ci_nit", "") or "").strip()

        if email:
            qs = Cliente.objects.filter(email__iexact=email)
            if instance is not None:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"email": "Ya existe un cliente con este email en esta farmacia."})

        if ci_nit:
            qs = Cliente.objects.filter(ci_nit__iexact=ci_nit)
            if instance is not None:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"ci_nit": "Ya existe un cliente con este CI/NIT en esta farmacia."})

        return attrs
