from django.contrib import admin

from .models import CapturaReceta, ItemCapturaReceta


class ItemCapturaRecetaInline(admin.TabularInline):
    model = ItemCapturaReceta
    extra = 0


@admin.register(CapturaReceta)
class CapturaRecetaAdmin(admin.ModelAdmin):
    list_display = ("id", "cliente", "estado", "motor_ia", "modelo_ia", "requiere_revision_manual", "created_at")
    list_filter = ("estado", "motor_ia", "requiere_revision_manual")
    search_fields = ("id", "nombre_archivo_original", "texto_extraido", "cliente__nombres", "cliente__apellidos")
    inlines = [ItemCapturaRecetaInline]


@admin.register(ItemCapturaReceta)
class ItemCapturaRecetaAdmin(admin.ModelAdmin):
    list_display = ("id", "captura", "orden", "nombre_detectado", "decision_cliente", "producto", "tratamiento_base")
    list_filter = ("decision_cliente",)
    search_fields = ("nombre_detectado", "nombre_resuelto", "captura__id")
