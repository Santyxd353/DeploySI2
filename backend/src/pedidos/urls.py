from django.urls import path

from .views import (
    asignar_repartidor_view,
    cambiar_estado,
    contador_no_leidas,
    detalle_pedido,
    listar_pedidos,
    listar_repartidores,
    marcar_leida,
    marcar_todas_leidas,
    mis_entregas,
    mis_notificaciones,
    mis_pedidos,
    tracking_pedido,
)

urlpatterns = [
    # Admin
    path("", listar_pedidos, name="pedidos-listar"),
    path("<int:pedido_id>/", detalle_pedido, name="pedidos-detalle"),
    path("<int:pedido_id>/estado/", cambiar_estado, name="pedidos-cambiar-estado"),
    path("<int:pedido_id>/repartidor/", asignar_repartidor_view, name="pedidos-asignar-repartidor"),
    path("repartidores/", listar_repartidores, name="pedidos-repartidores"),

    # Cliente
    path("mis-pedidos/", mis_pedidos, name="pedidos-mis-pedidos"),
    path("<int:pedido_id>/tracking/", tracking_pedido, name="pedidos-tracking"),

    # Repartidor
    path("mis-entregas/", mis_entregas, name="pedidos-mis-entregas"),

    # Notificaciones (campana)
    path("notificaciones/", mis_notificaciones, name="pedidos-notificaciones"),
    path("notificaciones/no-leidas/", contador_no_leidas, name="pedidos-notificaciones-contador"),
    path("notificaciones/marcar-todas/", marcar_todas_leidas, name="pedidos-notificaciones-marcar-todas"),
    path("notificaciones/<int:notif_id>/leida/", marcar_leida, name="pedidos-notificacion-leida"),
]
