from django.conf import settings
import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("clientes", "0005_medicoreceta"),
        ("inventarios", "0011_backfill_movimiento_stock_balances"),
        ("tenants", "0001_initial"),
        ("ventas", "0004_detalleventa_tenant_factura_tenant_venta_tenant_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Opinion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "tenant",
                    models.ForeignKey(
                        blank=True,
                        db_index=True,
                        editable=False,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="opiniones_opinion_set",
                        to="tenants.tenant",
                    ),
                ),
                (
                    "cliente",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="opiniones",
                        to="clientes.cliente",
                    ),
                ),
                (
                    "venta",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="opiniones",
                        to="ventas.venta",
                    ),
                ),
                (
                    "producto",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="opiniones",
                        to="inventarios.producto",
                    ),
                ),
                (
                    "respondida_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="opiniones_respondidas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("general", "General"),
                            ("venta", "Venta"),
                            ("producto", "Producto"),
                            ("servicio", "Servicio"),
                        ],
                        default="general",
                        max_length=20,
                    ),
                ),
                (
                    "puntuacion",
                    models.PositiveSmallIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(5),
                        ]
                    ),
                ),
                ("comentario", models.TextField(blank=True, max_length=500)),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("pendiente", "Pendiente"),
                            ("respondida", "Respondida"),
                            ("escalada", "Escalada"),
                            ("archivada", "Archivada"),
                        ],
                        default="pendiente",
                        max_length=20,
                    ),
                ),
                ("respuesta_staff", models.TextField(blank=True)),
                ("fecha_respuesta", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="opinion",
            constraint=models.UniqueConstraint(
                condition=models.Q(venta__isnull=False),
                fields=["cliente", "venta"],
                name="unique_cliente_venta_opinion",
            ),
        ),
        migrations.CreateModel(
            name="OpinionMetrica",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "tenant",
                    models.ForeignKey(
                        blank=True,
                        db_index=True,
                        editable=False,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="opiniones_opinionmetrica_set",
                        to="tenants.tenant",
                    ),
                ),
                ("fecha", models.DateField(auto_now_add=True)),
                ("total_opiniones", models.PositiveIntegerField(default=0)),
                ("promedio_estrellas", models.DecimalField(decimal_places=2, default=0.0, max_digits=3)),
                ("distribucion_1", models.PositiveIntegerField(default=0)),
                ("distribucion_2", models.PositiveIntegerField(default=0)),
                ("distribucion_3", models.PositiveIntegerField(default=0)),
                ("distribucion_4", models.PositiveIntegerField(default=0)),
                ("distribucion_5", models.PositiveIntegerField(default=0)),
            ],
            options={
                "ordering": ["-fecha"],
            },
        ),
    ]
