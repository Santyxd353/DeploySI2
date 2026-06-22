from django.urls import path

from .views import catalogo_reportes_view, generar_reporte_view, interpretar_texto_view, interpretar_audio_view


urlpatterns = [
    path("catalogo/", catalogo_reportes_view, name="reportes-catalogo"),
    path("generar/", generar_reporte_view, name="reportes-generar"),
    path("ia/interpretar/", interpretar_texto_view, name="reportes-ia-interpretar"),
    path("ia/audio/", interpretar_audio_view, name="reportes-ia-audio"),
]
