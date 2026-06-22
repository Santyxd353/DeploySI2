from django.urls import path

from .views import carrito_agregar, carrito_buscar_audio, carrito_confirmar, carrito_item_detalle, carrito_listar

urlpatterns = [
    path("agregar/", carrito_agregar, name="carrito-agregar"),
    path("items/<int:item_id>/", carrito_item_detalle, name="carrito-item-detalle"),
    path("", carrito_listar, name="carrito-listar"),
    path("confirmar/", carrito_confirmar, name="carrito-confirmar"),
    path("buscar-audio/", carrito_buscar_audio, name="carrito-buscar-audio"),
]
