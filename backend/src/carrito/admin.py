from django.contrib import admin

from .models import Carrito, CarritoItem


class CarritoItemInline(admin.TabularInline):
    model = CarritoItem
    extra = 0
    readonly_fields = ("created_at", "updated_at")


@admin.register(Carrito)
class CarritoAdmin(admin.ModelAdmin):
    list_display = ("id", "usuario", "estado", "origen", "updated_at")
    list_filter = ("estado", "origen")
    search_fields = ("id", "usuario__username", "usuario__email")
    readonly_fields = ("created_at", "updated_at")
    inlines = [CarritoItemInline]


@admin.register(CarritoItem)
class CarritoItemAdmin(admin.ModelAdmin):
    list_display = ("id", "carrito", "producto", "cantidad", "precio_unitario", "subtotal")
    search_fields = ("carrito__id", "producto__sku", "producto__nombre_comercial")
    readonly_fields = ("created_at", "updated_at")
