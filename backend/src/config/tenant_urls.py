from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("api/", include("tratamientos.urls")),
    path("api/clientes/", include("clientes.urls")),
    path("api/inventarios/", include("inventarios.urls")),
    path("api/backups/", include("backup.urls")),
    path("api/ventas/", include("ventas.urls")),
    path("api/admin/ventas/", include("ventas.admin_urls")),
    path("api/carrito/", include("carrito.urls")),
    path("api/predicciones/", include("predicciones.urls")),
    path("api/reportes/", include("reportes.urls")),
    path("api/tenants/", include("tenants.urls")),
    path("api/opiniones/", include("opiniones.urls")),
    path("api/publicidad/", include("publicidad.urls")),
    path("api/puntos/", include("puntos.urls")),
    path("api/pedidos/", include("pedidos.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
