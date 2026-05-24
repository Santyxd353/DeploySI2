from rest_framework import serializers
from .models import (
    Categoria,
    Subcategoria,
    Laboratorio,
    Producto,
    Inventario,
    LoteProducto,
    MovimientoInventario,
    EntradaStock,
)


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "nombre", "descripcion", "estado", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class SubcategoriaSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.ReadOnlyField(source="categoria.nombre")

    class Meta:
        model = Subcategoria
        fields = ["id", "categoria", "categoria_nombre", "nombre", "descripcion", "estado", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class LaboratorioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Laboratorio
        fields = [
            "id", "nombre", "pais", "telefono", "email", "direccion",
            "contacto_representante", "estado", "created_at", "updated_at"
        ]
        read_only_fields = ["created_at", "updated_at"]


class InventarioSerializer(serializers.ModelSerializer):
    stock_disponible = serializers.ReadOnlyField()
    necesita_reabastecimiento = serializers.ReadOnlyField()

    class Meta:
        model = Inventario
        fields = [
            "id", "stock_actual", "stock_reservado", "stock_disponible",
            "stock_minimo", "necesita_reabastecimiento", "ultima_entrada_fecha",
            "ultima_salida_fecha", "updated_at"
        ]
        read_only_fields = ["ultima_entrada_fecha", "ultima_salida_fecha", "updated_at"]


class LoteProductoSerializer(serializers.ModelSerializer):
    producto_sku = serializers.ReadOnlyField(source="producto.sku")
    producto_nombre = serializers.ReadOnlyField(source="producto.nombre_comercial")

    class Meta:
        model = LoteProducto
        fields = [
            "id",
            "producto",
            "producto_sku",
            "producto_nombre",
            "numero_lote",
            "fecha_fabricacion",
            "fecha_vencimiento",
            "cantidad_inicial",
            "cantidad_disponible",
            "precio_compra",
            "proveedor",
            "estado",
            "fecha_ingreso",
            "updated_at",
        ]
        read_only_fields = ["fecha_ingreso", "updated_at"]


class ProductoSerializer(serializers.ModelSerializer):
    # Use FileField to allow SVG uploads in addition to raster formats.
    imagen = serializers.FileField(required=False, allow_null=True)
    categoria_nombre = serializers.ReadOnlyField(source="categoria.nombre")
    laboratorio_nombre = serializers.ReadOnlyField(source="laboratorio.nombre")
    subcategoria_nombre = serializers.ReadOnlyField(source="subcategoria.nombre", allow_null=True)

    categoria_id = serializers.PrimaryKeyRelatedField(source="categoria", queryset=Categoria.objects.all(), write_only=True)
    laboratorio_id = serializers.PrimaryKeyRelatedField(source="laboratorio", queryset=Laboratorio.objects.all(), write_only=True)
    subcategoria_id = serializers.PrimaryKeyRelatedField(source="subcategoria", queryset=Subcategoria.objects.all(), required=False, allow_null=True, write_only=True)

    inventario = InventarioSerializer(read_only=True)

    class Meta:
        model = Producto
        fields = [
            "id", "sku", "nombre_comercial", "nombre_generico", "descripcion", "imagen",
            "categoria", "categoria_nombre", "categoria_id",
            "subcategoria", "subcategoria_nombre", "subcategoria_id",
            "laboratorio", "laboratorio_nombre", "laboratorio_id",
            "forma_farmaceutica", "concentracion", "presentacion", "unidad_medida",
            "precio_compra", "precio_venta", "stock_minimo",
            "requiere_receta", "es_controlado", "estado",
            "inventario", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at", "categoria", "laboratorio", "subcategoria"]

    def validate(self, attrs):
        categoria = attrs.get("categoria")
        subcategoria = attrs.get("subcategoria")

        # On partial updates, fall back to instance values when fields are omitted.
        if self.instance is not None:
            if categoria is None:
                categoria = self.instance.categoria
            if subcategoria is None:
                subcategoria = self.instance.subcategoria

        if categoria and subcategoria and subcategoria.categoria_id != categoria.id:
            raise serializers.ValidationError(
                {"subcategoria_id": "La subcategoría seleccionada no pertenece a la categoría elegida."}
            )

        return attrs


class MovimientoInventarioSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source="producto.nombre_comercial")
    producto_sku = serializers.ReadOnlyField(source="producto.sku")
    usuario_nombre = serializers.ReadOnlyField(source="usuario.get_full_name")
    lote_numero = serializers.ReadOnlyField(source="lote.numero_lote")

    class Meta:
        model = MovimientoInventario
        fields = [
            "id", "producto", "producto_nombre", "producto_sku",
            "lote", "lote_numero", "tipo_movimiento", "cantidad", "motivo", "referencia",
            "usuario", "usuario_nombre", "fecha_movimiento", "observacion", "created_at"
        ]
        read_only_fields = ["id", "fecha_movimiento", "created_at"]


class EntradaStockSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source="producto.nombre_comercial")
    producto_sku = serializers.ReadOnlyField(source="producto.sku")
    usuario_nombre = serializers.ReadOnlyField(source="usuario.get_full_name")
    motivo_display = serializers.CharField(source="get_motivo_display", read_only=True)
    lote_numero = serializers.ReadOnlyField(source="lote.numero_lote")
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = EntradaStock
        fields = [
            "id", "producto", "producto_nombre", "producto_sku", "cantidad", "motivo",
            "motivo_display", "referencia", "descripcion",
            "lote", "lote_numero",
            "estado", "estado_display",
            "usuario", "usuario_nombre", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "usuario", "created_at", "updated_at", "usuario_nombre", "lote_numero"]

    def validate_cantidad(self, value):
        if value <= 0:
            raise serializers.ValidationError("La cantidad debe ser mayor a 0.")
        return value

    def validate(self, attrs):
        producto = attrs.get("producto") or getattr(self.instance, "producto", None)
        lote = attrs.get("lote") or getattr(self.instance, "lote", None)
        if producto and lote and lote.producto_id != producto.id:
            raise serializers.ValidationError({"lote": "El lote seleccionado no corresponde al producto."})
        if lote and lote.estado != "disponible":
            raise serializers.ValidationError({"lote": "Solo se permiten lotes en estado disponible."})
        return attrs
