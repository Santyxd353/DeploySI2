from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CampanaPublicitariaViewSet, SegmentoRFMViewSet

router = DefaultRouter()
router.register(r"segmentos", SegmentoRFMViewSet, basename="segmento-rfm")
router.register(r"campanas", CampanaPublicitariaViewSet, basename="campana")

urlpatterns = [path("", include(router.urls))]
