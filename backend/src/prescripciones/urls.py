from django.urls import path

from .views import (
    actualizar_item_captura_receta,
    aplicar_captura_receta,
    confirmar_captura_receta,
    crear_captura_receta,
    detalle_captura_receta,
    receta_guardada_detalle,
)


urlpatterns = [
    path("capturas/", crear_captura_receta, name="crear-captura-receta"),
    path("capturas/<int:captura_id>/", detalle_captura_receta, name="detalle-captura-receta"),
    path(
        "capturas/<int:captura_id>/items/<int:item_id>/",
        actualizar_item_captura_receta,
        name="actualizar-item-captura-receta",
    ),
    path("capturas/<int:captura_id>/confirmar/", confirmar_captura_receta, name="confirmar-captura-receta"),
    path("capturas/<int:captura_id>/aplicar/", aplicar_captura_receta, name="aplicar-captura-receta"),
    path("recetas/<int:receta_id>/", receta_guardada_detalle, name="detalle-receta-guardada"),
]
