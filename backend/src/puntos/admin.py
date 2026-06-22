from django.contrib import admin

from .models import CanjePuntos, CatalogoCanje, ConfiguracionPuntos, CuentaPuntos, TransaccionPuntos


@admin.register(ConfiguracionPuntos)
class ConfiguracionPuntosAdmin(admin.ModelAdmin):
    list_display = ["id", "activo", "bolivianos_por_punto", "puntos_minimos_canje", "dias_expiracion"]


@admin.register(CuentaPuntos)
class CuentaPuntosAdmin(admin.ModelAdmin):
    list_display = ["id", "cliente", "puntos_disponibles", "puntos_acumulados", "nivel"]
    search_fields = ["cliente__nombres", "cliente__apellidos", "cliente__email"]


@admin.register(CatalogoCanje)
class CatalogoCanjeAdmin(admin.ModelAdmin):
    list_display = ["id", "nombre", "tipo", "puntos_requeridos", "stock_disponible", "activo"]
    list_filter = ["tipo", "activo"]
    search_fields = ["nombre", "descripcion", "codigo_cupon_externo"]


@admin.register(CanjePuntos)
class CanjePuntosAdmin(admin.ModelAdmin):
    list_display = ["id", "codigo_voucher", "cuenta", "catalogo", "puntos_usados", "estado", "creado_en"]
    list_filter = ["estado", "catalogo__tipo"]


@admin.register(TransaccionPuntos)
class TransaccionPuntosAdmin(admin.ModelAdmin):
    list_display = ["id", "cuenta", "tipo", "puntos", "saldo_resultante", "creado_en"]
    list_filter = ["tipo"]