from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoriaViewSet,
    SubcategoriaViewSet,
    LaboratorioViewSet,
    ProductoViewSet,
    LoteProductoViewSet,
    MovimientoInventarioViewSet,
    EntradaStockViewSet,
    LimiteDispensacionViewSet,
)

router = DefaultRouter()
router.register(r"categorias", CategoriaViewSet)
router.register(r"subcategorias", SubcategoriaViewSet)
router.register(r"laboratorios", LaboratorioViewSet)
router.register(r"productos", ProductoViewSet)
router.register(r"lotes", LoteProductoViewSet, basename="lote")
router.register(r"movimientos", MovimientoInventarioViewSet)
router.register(r"entradas-stock", EntradaStockViewSet, basename="entrada-stock")
router.register(r"limites-dispensacion", LimiteDispensacionViewSet, basename="limite-dispensacion")

urlpatterns = [
    path("", include(router.urls)),
]
