from django.contrib import admin

from .models import Cliente, RecetaMedica


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ("nombres", "apellidos", "tipo", "email", "telefono", "estado")
    list_filter = ("tipo", "estado")
    search_fields = ("nombres", "apellidos", "email", "telefono", "ci_nit")
    readonly_fields = ("created_at", "updated_at")


@admin.register(RecetaMedica)
class RecetaMedicaAdmin(admin.ModelAdmin):
    list_display = ("codigo", "cliente", "estado", "fecha_emision", "fecha_vencimiento", "validada_por")
    list_filter = ("estado", "fecha_emision", "fecha_vencimiento")
    search_fields = ("codigo", "cliente__nombres", "cliente__apellidos", "cliente__email")
    readonly_fields = ("created_at", "updated_at", "validada_en")
