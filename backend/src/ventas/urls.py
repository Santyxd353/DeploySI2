from django.urls import path

from .views import (
    crear_venta_fisica,
    crear_venta_online,
    crear_venta_pos,
    crear_intent_pago,
    confirmar_pago_venta,
    listar_mis_facturas,
    listar_historial_ventas,
    obtener_estadisticas_cliente,
    obtener_factura,
    stripe_webhook,
)

urlpatterns = [
    # URLs existentes
    path("crear-fisica/", crear_venta_fisica, name="ventas-crear-fisica"),
    path("crear-online/", crear_venta_online, name="ventas-crear-online"),
    path("pos/crear/", crear_venta_pos, name="ventas-pos-crear"),

    # HU-18: Historial de ventas con RBAC y paginación
    path("historial/", listar_historial_ventas, name="ventas-historial"),
    path("historial/estadisticas/", obtener_estadisticas_cliente, name="ventas-estadisticas"),

    # Stripe + Facturación
    path("intent-pago/", crear_intent_pago, name="crear_intent_pago"),
    path("confirmar-pago/", confirmar_pago_venta, name="confirmar_pago_venta"),
    path("mis-facturas/", listar_mis_facturas, name="listar_mis_facturas"),
    path("factura/<str:numero_factura>/", obtener_factura, name="obtener_factura"),
    path("stripe/webhook/", stripe_webhook, name="stripe_webhook"),
]