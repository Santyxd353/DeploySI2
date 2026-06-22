import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("tenants", "0001_initial"),
        ("ventas", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Pedido",
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
                        related_name="pedidos_pedido_set",
                        to="tenants.tenant",
                    ),
                ),
                (
                    "venta",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="pedido",
                        to="ventas.venta",
                    ),
                ),
                (
                    "repartidor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pedidos_asignados",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("pagado", "Pagado"),
                            ("aceptado", "Aceptado"),
                            ("preparando", "Preparando"),
                            ("listo", "Listo para envío"),
                            ("en_camino", "En camino"),
                            ("cerca", "Cerca del destino"),
                            ("entregado", "Entregado"),
                            ("no_entregado", "No entregado"),
                            ("cancelado", "Cancelado"),
                        ],
                        db_index=True,
                        default="pagado",
                        max_length=20,
                    ),
                ),
                ("lat_entrega", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("lon_entrega", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("direccion_texto", models.CharField(blank=True, max_length=500)),
                ("lat_repartidor", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("lon_repartidor", models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ("aceptado_en", models.DateTimeField(blank=True, null=True)),
                ("preparando_en", models.DateTimeField(blank=True, null=True)),
                ("listo_en", models.DateTimeField(blank=True, null=True)),
                ("en_camino_en", models.DateTimeField(blank=True, null=True)),
                ("entregado_en", models.DateTimeField(blank=True, null=True)),
                ("notas_internas", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Pedido",
                "verbose_name_plural": "Pedidos",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="HistorialEstadoPedido",
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
                        related_name="pedidos_historialestadopedido_set",
                        to="tenants.tenant",
                    ),
                ),
                (
                    "pedido",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="historial",
                        to="pedidos.pedido",
                    ),
                ),
                (
                    "cambiado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="cambios_estado_pedido",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("estado_anterior", models.CharField(blank=True, max_length=20)),
                ("estado_nuevo", models.CharField(max_length=20)),
                ("notas", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Historial de estado",
                "verbose_name_plural": "Historial de estados",
                "ordering": ["created_at"],
            },
        ),
        migrations.CreateModel(
            name="Notificacion",
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
                        related_name="pedidos_notificacion_set",
                        to="tenants.tenant",
                    ),
                ),
                (
                    "destinatario",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notificaciones_pedidos",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "pedido",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="notificaciones",
                        to="pedidos.pedido",
                    ),
                ),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("pedido_nuevo", "Pedido nuevo"),
                            ("pedido_aceptado", "Pedido aceptado"),
                            ("pedido_preparando", "Preparando pedido"),
                            ("pedido_listo", "Pedido listo"),
                            ("pedido_en_camino", "Pedido en camino"),
                            ("pedido_cerca", "Pedido cerca"),
                            ("pedido_entregado", "Pedido entregado"),
                            ("pedido_no_entregado", "Entrega fallida"),
                            ("pedido_cancelado", "Pedido cancelado"),
                            ("repartidor_asignado", "Repartidor asignado"),
                        ],
                        max_length=30,
                    ),
                ),
                ("titulo", models.CharField(max_length=200)),
                ("mensaje", models.TextField()),
                ("leida", models.BooleanField(db_index=True, default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "Notificación",
                "verbose_name_plural": "Notificaciones",
                "ordering": ["-created_at"],
            },
        ),
    ]
