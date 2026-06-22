from django.contrib import admin

from .models import HistorialEstadoPedido, Notificacion, Pedido


class HistorialInline(admin.TabularInline):
    model = HistorialEstadoPedido
    extra = 0
    readonly_fields = ["estado_anterior", "estado_nuevo", "cambiado_por", "notas", "created_at"]


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ["id", "estado", "venta", "repartidor", "created_at"]
    list_filter = ["estado"]
    search_fields = ["venta__id", "repartidor__username"]
    inlines = [HistorialInline]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ["id", "tipo", "destinatario", "leida", "created_at"]
    list_filter = ["tipo", "leida"]
    search_fields = ["destinatario__username", "titulo"]
