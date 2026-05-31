from django.conf import settings
from django.db import models
from django.utils import timezone
from tenants.mixins import TenantAwareModel


class Cliente(TenantAwareModel):
    TIPO_CHOICES = [
        ("registrado", "Registrado"),
        ("invitado", "Invitado"),
    ]

    GENERO_CHOICES = [
        ("M", "Masculino"),
        ("F", "Femenino"),
        ("O", "Otro"),
    ]

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cliente",
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    nombres = models.CharField(max_length=150)
    apellidos = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    ci_nit = models.CharField(max_length=30, blank=True)
    direccion = models.TextField(blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    genero = models.CharField(max_length=1, choices=GENERO_CHOICES, blank=True)
    alergias = models.TextField(blank=True)
    medicamentos_frecuentes = models.TextField(blank=True)
    medico_habitual = models.CharField(max_length=200, blank=True)
    observaciones = models.TextField(blank=True)
    estado = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        ordering = ["nombres", "apellidos"]

    def __str__(self):
        if self.apellidos:
            return f"{self.nombres} {self.apellidos}".strip()
        return self.nombres


class RecetaMedica(TenantAwareModel):
    ESTADO_CHOICES = [
        ("pendiente", "Pendiente"),
        ("aprobada", "Aprobada"),
        ("rechazada", "Rechazada"),
        ("vencida", "Vencida"),
    ]

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="recetas")
    codigo = models.CharField(max_length=50)
    archivo = models.FileField(upload_to="recetas/", null=True, blank=True)
    firma_digital = models.ImageField(upload_to="firmas_recetas/", null=True, blank=True)
    fecha_emision = models.DateField(default=timezone.localdate)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    fecha_validez = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="pendiente")
    observacion = models.TextField(blank=True)
    validada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="recetas_validadas",
    )
    validada_en = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Receta medica"
        verbose_name_plural = "Recetas medicas"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "codigo"], name="uq_receta_tenant_codigo"),
        ]

    def save(self, *args, **kwargs):
        if (
            self.fecha_vencimiento
            and self.fecha_vencimiento < timezone.now().date()
            and self.estado == "pendiente"
        ):
            self.estado = "vencida"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Receta {self.codigo} - Cliente {self.cliente_id}"


class MedicoReceta(models.Model):
    receta = models.OneToOneField(
        RecetaMedica,
        on_delete=models.CASCADE,
        related_name="medico",
    )
    nombre = models.CharField(max_length=200)
    licencia = models.CharField(max_length=100, blank=True)
    especialidad = models.CharField(max_length=100, blank=True)
    firma_imagen = models.ImageField(upload_to="firmas_medicos/", blank=True, null=True)

    class Meta:
        verbose_name = "Médico de receta"
        verbose_name_plural = "Médicos de recetas"

    def __str__(self):
        return f"{self.nombre} — Receta {self.receta.codigo}"
