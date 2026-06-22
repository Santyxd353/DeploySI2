from rest_framework import serializers

class PrediccionDemandaRequestSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    dias = serializers.IntegerField(min_value=1, max_value=30, default=7)

class PrediccionDiariaSerializer(serializers.Serializer):
    fecha = serializers.DateField()
    unidades = serializers.FloatField()

class PrediccionDemandaResponseSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    predicciones = PrediccionDiariaSerializer(many=True)
    tendencia = serializers.CharField()
    estacionalidad = serializers.CharField(allow_blank=True)

class RecomendacionCompraSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    nombre_producto = serializers.CharField()
    stock_actual = serializers.IntegerField()
    stock_minimo = serializers.IntegerField()
    prediccion_semana = serializers.FloatField()
    cantidad_recomendada = serializers.IntegerField()
    urgencia = serializers.CharField()  # baja, media, alta

class TendenciaProductoSerializer(serializers.Serializer):
    producto_id = serializers.IntegerField()
    nombre_producto = serializers.CharField()
    pendiente = serializers.FloatField()
    tendencia = serializers.CharField()  # creciente, decreciente, estable

class PatronEstacionalSerializer(serializers.Serializer):
    categoria_nombre = serializers.CharField()
    mes = serializers.IntegerField()
    promedio_ventas = serializers.FloatField()
    porcentaje_vs_anual = serializers.FloatField()