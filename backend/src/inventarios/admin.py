from django.contrib import admin
from .models import (
    Categoria,
    Subcategoria,
    Laboratorio,
    Producto,
    Inventario,
    MovimientoInventario,
    EntradaStock,
)


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "estado", "created_at")
    search_fields = ("nombre",)
    list_filter = ("estado",)


@admin.register(Subcategoria)
class SubcategoriaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "categoria", "estado")
    search_fields = ("nombre", "categoria__nombre")
    list_filter = ("estado", "categoria")


@admin.register(Laboratorio)
class LaboratorioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "pais", "estado")
    search_fields = ("nombre", "pais")
    list_filter = ("estado",)


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ("sku", "nombre_comercial", "precio_venta", "stock_minimo", "estado")
    list_filter = ("estado", "requiere_receta", "es_controlado", "categoria", "laboratorio")
    search_fields = ("sku", "nombre_comercial", "nombre_generico")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Inventario)
class InventarioAdmin(admin.ModelAdmin):
    list_display = ("producto", "stock_actual", "stock_reservado", "stock_minimo")
    search_fields = ("producto__sku", "producto__nombre_comercial")


@admin.register(MovimientoInventario)
class MovimientoInventarioAdmin(admin.ModelAdmin):
    list_display = ("producto", "tipo_movimiento", "cantidad", "motivo", "usuario", "fecha_movimiento")
    list_filter = ("tipo_movimiento", "motivo")
    search_fields = ("producto__sku", "producto__nombre_comercial", "referencia")


@admin.register(EntradaStock)
class EntradaStockAdmin(admin.ModelAdmin):
    list_display = ("producto", "cantidad", "motivo", "usuario", "created_at")
    list_filter = ("motivo", "created_at", "producto")
    search_fields = ("producto__nombre_comercial", "producto__sku", "usuario__email")
    readonly_fields = ("usuario", "created_at", "updated_at")
