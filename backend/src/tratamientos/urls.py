from django.urls import path

from .views import (
    admin_buscar_productos,
    admin_tratamiento_base_detail,
    admin_tratamientos_base_list_create,
    cliente_historial_mensual,
    cliente_historial_diario,
    cliente_historial_tratamientos,
    cliente_historial_semanal,
    cliente_iniciar_tratamiento,
    cliente_marcar_toma,
    cliente_mis_tratamientos,
    cliente_omitir_toma,
    cliente_posponer_toma,
    cliente_desactivar_tokens_dispositivo,
    cliente_registrar_token_dispositivo,
    cliente_cancelar_tratamiento,
    cliente_tratamientos_disponibles,
)


urlpatterns = [
    path("admin/tratamientos/base/", admin_tratamientos_base_list_create, name="admin-tratamientos-base-list-create"),
    path("admin/tratamientos/base/<int:tratamiento_id>/", admin_tratamiento_base_detail, name="admin-tratamientos-base-detail"),
    path("admin/productos/buscar/", admin_buscar_productos, name="admin-productos-buscar"),

    path("tratamientos/disponibles/", cliente_tratamientos_disponibles, name="cliente-tratamientos-disponibles"),
    path("tratamientos/mis-tratamientos/", cliente_mis_tratamientos, name="cliente-mis-tratamientos"),
    path("tratamientos/iniciar/", cliente_iniciar_tratamiento, name="cliente-iniciar-tratamiento"),
    path("tratamientos/notificaciones/token/", cliente_registrar_token_dispositivo, name="cliente-registrar-token-dispositivo"),
    path("tratamientos/notificaciones/token/desactivar/", cliente_desactivar_tokens_dispositivo, name="cliente-desactivar-tokens-dispositivo"),
    path("tratamientos/<int:tratamiento_id>/tomar/", cliente_marcar_toma, name="cliente-tratamiento-tomar"),
    path("tratamientos/<int:tratamiento_id>/posponer/", cliente_posponer_toma, name="cliente-tratamiento-posponer"),
    path("tratamientos/<int:tratamiento_id>/omitir/", cliente_omitir_toma, name="cliente-tratamiento-omitir"),
    path("tratamientos/<int:tratamiento_id>/cancelar/", cliente_cancelar_tratamiento, name="cliente-tratamiento-cancelar"),
    path("tratamientos/historial/mensual/", cliente_historial_mensual, name="cliente-tratamientos-historial-mensual"),
    path("tratamientos/historial/dia/", cliente_historial_diario, name="cliente-tratamientos-historial-diario"),
    path("tratamientos/historial/semanal/", cliente_historial_semanal, name="cliente-tratamientos-historial-semanal"),
    path("tratamientos/historial/todos/", cliente_historial_tratamientos, name="cliente-tratamientos-historial-todos"),
]
