from django.contrib import admin

from .models import TomaMedicamento, TratamientoActivo, TratamientoBase


@admin.register(TratamientoBase)
class TratamientoBaseAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre_publico", "producto", "frecuencia_horas", "duracion_dias", "activo")
    list_filter = ("activo",)
    search_fields = ("nombre_publico", "producto__nombre_comercial", "producto__sku")


@admin.register(TratamientoActivo)
class TratamientoActivoAdmin(admin.ModelAdmin):
    list_display = ("id", "cliente", "tratamiento_base", "fecha_inicio", "fecha_fin_esperada", "estado")
    list_filter = ("estado", "recordatorios_activos")
    search_fields = ("cliente__nombres", "cliente__apellidos", "tratamiento_base__nombre_publico")


@admin.register(TomaMedicamento)
class TomaMedicamentoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "tratamiento_activo",
        "fecha_hora_programada",
        "fecha_hora_real",
        "estado",
        "dosis_tomada",
    )
    list_filter = ("estado",)
    search_fields = ("tratamiento_activo__tratamiento_base__nombre_publico",)
