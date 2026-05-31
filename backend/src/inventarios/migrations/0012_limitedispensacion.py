import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventarios", "0011_backfill_movimiento_stock_balances"),
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="LimiteDispensacion",
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
                        to="tenants.tenant",
                    ),
                ),
                (
                    "producto",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="limite_dispensacion",
                        to="inventarios.producto",
                    ),
                ),
                (
                    "cantidad_maxima",
                    models.PositiveIntegerField(
                        help_text="Unidades máximas que puede dispensar un cliente en el periodo.",
                        validators=[django.core.validators.MinValueValidator(1)],
                    ),
                ),
                (
                    "periodo_dias",
                    models.PositiveIntegerField(
                        default=30,
                        help_text="Ventana de tiempo en días para contabilizar las dispensaciones.",
                        validators=[django.core.validators.MinValueValidator(1)],
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Límite de Dispensación",
                "verbose_name_plural": "Límites de Dispensación",
            },
        ),
    ]
