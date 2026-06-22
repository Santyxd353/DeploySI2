from django.urls import path

from .views import admin_ventas_dashboard, admin_ventas_lista

urlpatterns = [
    path("dashboard/", admin_ventas_dashboard, name="admin-ventas-dashboard"),
    path("lista/", admin_ventas_lista, name="admin-ventas-lista"),
]
