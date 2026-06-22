from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("clientes", "0001_initial"),
        ("inventarios", "0005_merge_0003_laboratorio_0004_alter_entradastock_motivo"),
    ]

    operations = [
        migrations.CreateModel(
            name="Venta",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("origen", models.CharField(choices=[("fisica", "Venta fisica"), ("online", "Venta online")], max_length=10)),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("pendiente", "Pendiente"),
                            ("pagada", "Pagada"),
                            ("preparando", "Preparando"),
                            ("entregada", "Entregada"),
                            ("cancelada", "Cancelada"),
                        ],
                        default="pendiente",
                        max_length=20,
                    ),
                ),
                ("subtotal", models.DecimalField(decimal_places=2, max_digits=12, validators=[MinValueValidator(0)])),
                (
                    "descuento",
                    models.DecimalField(decimal_places=2, default=0, max_digits=12, validators=[MinValueValidator(0)]),
                ),
                (
                    "impuesto",
                    models.DecimalField(decimal_places=2, default=0, max_digits=12, validators=[MinValueValidator(0)]),
                ),
                ("total", models.DecimalField(decimal_places=2, max_digits=12, validators=[MinValueValidator(0)])),
                ("observacion", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "cliente",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="ventas", to="clientes.cliente"),
                ),
                (
                    "vendedor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ventas_realizadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Venta",
                "verbose_name_plural": "Ventas",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="DetalleVenta",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("cantidad", models.PositiveIntegerField(validators=[MinValueValidator(1)])),
                ("precio_unitario", models.DecimalField(decimal_places=2, max_digits=12, validators=[MinValueValidator(0)])),
                ("subtotal", models.DecimalField(decimal_places=2, max_digits=12, validators=[MinValueValidator(0)])),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "producto",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="detalles_venta",
                        to="inventarios.producto",
                    ),
                ),
                (
                    "venta",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="detalles", to="ventas.venta"),
                ),
            ],
            options={
                "verbose_name": "Detalle de venta",
                "verbose_name_plural": "Detalles de venta",
            },
        ),
    ]
