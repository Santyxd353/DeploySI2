from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ClienteViewSet, RecetaMedicaViewSet

router = DefaultRouter()
router.register(r"recetas", RecetaMedicaViewSet, basename="receta")
router.register(r"", ClienteViewSet, basename="cliente")

urlpatterns = [
    path("", include(router.urls)),
]
