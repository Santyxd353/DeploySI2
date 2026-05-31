from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OpinionViewSet

router = DefaultRouter()
router.register(r"", OpinionViewSet, basename="opinion")

urlpatterns = [path("", include(router.urls))]
