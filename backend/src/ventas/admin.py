from django.contrib import admin

from .models import DetalleVenta, Venta


class DetalleVentaInline(admin.TabularInline):
    model = DetalleVenta
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(Venta)
class VentaAdmin(admin.ModelAdmin):
    list_display = ("id", "cliente", "origen", "estado", "total", "vendedor", "created_at")
    list_filter = ("origen", "estado", "created_at")
    search_fields = ("id", "cliente__nombres", "cliente__apellidos", "cliente__email")
    readonly_fields = ("created_at", "updated_at")
    inlines = [DetalleVentaInline]


@admin.register(DetalleVenta)
class DetalleVentaAdmin(admin.ModelAdmin):
    list_display = ("id", "venta", "producto", "cantidad", "precio_unitario", "subtotal")
    list_filter = ("created_at",)
    search_fields = ("venta__id", "producto__sku", "producto__nombre_comercial")
    readonly_fields = ("created_at",)
