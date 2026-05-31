from django.db import models

from tenants.mixins import TenantAwareModel


class SegmentoRFM(TenantAwareModel):
    TODOS = "todos"
    CHAMPIONS = "champions"
    FRECUENTES = "frecuentes"
    NUEVOS = "nuevos"
    EN_RIESGO = "en_riesgo"
    INACTIVOS = "inactivos"

    CODIGOS = [
        (TODOS, "Todos los clientes"),
        (CHAMPIONS, "Campeones"),
        (FRECUENTES, "Frecuentes"),
        (NUEVOS, "Nuevos"),
        (EN_RIESGO, "En riesgo"),
        (INACTIVOS, "Inactivos"),
    ]

    codigo = models.CharField(max_length=20, choices=CODIGOS)
    nombre = models.CharField(max_length=60)
    descripcion = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["codigo"]

    def __str__(self):
        return self.nombre


class CampanaPublicitaria(TenantAwareModel):
    titulo = models.CharField(max_length=120)
    descripcion = models.TextField(blank=True)
    imagen = models.ImageField(upload_to="campanas/", null=True, blank=True)
    descuento = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    segmentos = models.ManyToManyField(
        SegmentoRFM,
        blank=True,
        related_name="campanas",
        verbose_name="Segmentos RFM",
    )
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    activa = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.titulo
