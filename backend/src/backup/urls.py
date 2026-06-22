from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BackupViewSet, BackupScheduleViewSet   # ← importamos la nueva vista


router_manual = DefaultRouter()
router_manual.register(r'', BackupViewSet, basename='backup')   # backup manual (ya existente)

router_schedule = DefaultRouter()
router_schedule.register(r'schedule', BackupScheduleViewSet, basename='backup-schedule')  # nuevo

urlpatterns = [
    path('', include(router_manual.urls)),          # /api/backup/ → manual
    path('', include(router_schedule.urls)),        # /api/backup/schedule/ → programación
]