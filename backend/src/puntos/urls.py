from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CanjearPuntosView,
    CatalogoCanjePublicoView,
    CatalogoCanjeViewSet,
    ConfiguracionPuntosViewSet,
    CuentaPuntosViewSet,
    HistorialPuntosView,
    MiCuentaPuntosView,
    CanjePuntosViewSet,
    TransaccionPuntosViewSet,
)

router = DefaultRouter()
router.register(r"configuracion", ConfiguracionPuntosViewSet, basename="configuracion-puntos")
router.register(r"cuentas", CuentaPuntosViewSet, basename="cuentas-puntos")
router.register(r"catalogo", CatalogoCanjeViewSet, basename="catalogo-canje")
router.register(r"canjes", CanjePuntosViewSet, basename="canjes-puntos")
router.register(r"transacciones", TransaccionPuntosViewSet, basename="transacciones-puntos")

urlpatterns = [
    path("mi-cuenta/", MiCuentaPuntosView.as_view(), name="mi-cuenta-puntos"),
    path("mi-cuenta/historial/", HistorialPuntosView.as_view(), name="historial-puntos"),
    path("catalogo-publico/", CatalogoCanjePublicoView.as_view(), name="catalogo-canje-publico"),
    path("canjear/", CanjearPuntosView.as_view(), name="canjear-puntos"),
    path("", include(router.urls)),
]