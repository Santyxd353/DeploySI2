from django.conf import settings
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
            name="Carrito",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "estado",
                    models.CharField(
                        choices=[("activo", "Activo"), ("confirmado", "Confirmado"), ("cancelado", "Cancelado")],
                        default="activo",
                        max_length=20,
                    ),
                ),
                ("origen", models.CharField(default="online", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "cliente",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="carritos", to="clientes.cliente"),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="carritos",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Carrito",
                "verbose_name_plural": "Carritos",
                "ordering": ["-updated_at"],
            },
        ),
        migrations.CreateModel(
            name="CarritoItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("cantidad", models.PositiveIntegerField(default=1)),
                ("precio_unitario", models.DecimalField(decimal_places=2, max_digits=12)),
                ("subtotal", models.DecimalField(decimal_places=2, max_digits=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "carrito",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="carrito.carrito"),
                ),
                (
                    "producto",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="items_carrito",
                        to="inventarios.producto",
                    ),
                ),
            ],
            options={
                "verbose_name": "Item de carrito",
                "verbose_name_plural": "Items de carrito",
                "unique_together": {("carrito", "producto")},
            },
        ),
    ]
