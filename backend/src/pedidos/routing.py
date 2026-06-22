from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r"^ws/pedidos/admin/$", consumers.AdminPedidosConsumer.as_asgi()),
    re_path(r"^ws/pedidos/(?P<pedido_id>\d+)/tracking/$", consumers.OrderTrackingConsumer.as_asgi()),
    re_path(r"^ws/pedidos/(?P<pedido_id>\d+)/ubicacion/$", consumers.RepartidorLocationConsumer.as_asgi()),
]
