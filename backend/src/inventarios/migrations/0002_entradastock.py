import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventarios", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EntradaStock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("cantidad", models.PositiveIntegerField(validators=[django.core.validators.MinValueValidator(1)])),
                (
                    "motivo",
                    models.CharField(
                        choices=[
                            ("reposicion", "Reposicion Proveedor"),
                            ("devolucion", "Devolucion de Cliente"),
                            ("ajuste", "Ajuste de Inventario"),
                            ("correccion", "Correccion de Conteo"),
                            ("otro", "Otro"),
                        ],
                        max_length=20,
                    ),
                ),
                ("descripcion", models.TextField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("usuario", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("producto", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entradas", to="inventarios.producto")),
            ],
            options={
                "verbose_name": "Entrada de Stock",
                "verbose_name_plural": "Entradas de Stock",
                "ordering": ["-created_at"],
            },
        ),
    ]
