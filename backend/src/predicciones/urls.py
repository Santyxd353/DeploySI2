from django.urls import path
from . import views

urlpatterns = [
    path('demanda/', views.predecir_demanda, name='predecir_demanda'),
    path('recomendaciones-compra/', views.recomendaciones_compra, name='recomendaciones_compra'),
    path('tendencias/', views.tendencias_consumo, name='tendencias_consumo'),
    path('patrones-estacionales/', views.patrones_estacionales, name='patrones_estacionales'),
]