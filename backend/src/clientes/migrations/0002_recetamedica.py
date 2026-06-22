from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("clientes", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="RecetaMedica",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("codigo", models.CharField(max_length=50, unique=True)),
                ("archivo", models.FileField(blank=True, null=True, upload_to="recetas/")),
                ("fecha_emision", models.DateField(default=django.utils.timezone.localdate)),
                ("fecha_vencimiento", models.DateField(blank=True, null=True)),
                (
                    "estado",
                    models.CharField(
                        choices=[("pendiente", "Pendiente"), ("aprobada", "Aprobada"), ("rechazada", "Rechazada"), ("vencida", "Vencida")],
                        default="pendiente",
                        max_length=20,
                    ),
                ),
                ("observacion", models.TextField(blank=True)),
                ("validada_en", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "cliente",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recetas", to="clientes.cliente"),
                ),
                (
                    "validada_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recetas_validadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"verbose_name": "Receta medica", "verbose_name_plural": "Recetas medicas", "ordering": ["-created_at"]},
        ),
    ]
