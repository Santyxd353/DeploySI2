from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("tenants", "0001_initial"),
        ("clientes", "0001_initial"),
        ("inventarios", "0001_initial"),
        ("ventas", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ConfiguracionPuntos",
            fields=[
                (
                    "id",
                    models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                ),
                ("tenant", models.ForeignKey(blank=True, db_index=True, editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="puntos_configuracionpuntos_set", to=settings.TENANT_MODEL)),
                ("activo", models.BooleanField(default=True)),
                ("bolivianos_por_punto", models.DecimalField(decimal_places=2, default=Decimal("10.00"), max_digits=10)),
                ("puntos_minimos_canje", models.PositiveIntegerField(default=100)),
                ("dias_expiracion", models.PositiveIntegerField(default=0)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Configuracion de puntos",
                "verbose_name_plural": "Configuraciones de puntos",
            },
        ),
        migrations.AddConstraint(
            model_name="configuracionpuntos",
            constraint=models.UniqueConstraint(fields=["tenant"], name="uq_configuracion_puntos_tenant"),
        ),
        migrations.CreateModel(
            name="CuentaPuntos",
            fields=[
                (
                    "id",
                    models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                ),
                ("tenant", models.ForeignKey(blank=True, db_index=True, editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="puntos_cuentapuntos_set", to=settings.TENANT_MODEL)),
                ("puntos_disponibles", models.PositiveIntegerField(default=0)),
                ("puntos_acumulados", models.PositiveIntegerField(default=0)),
                ("puntos_canjeados", models.PositiveIntegerField(default=0)),
                ("puntos_expirados", models.PositiveIntegerField(default=0)),
                (
                    "nivel",
                    models.CharField(
                        choices=[
                            ("bronce", "Bronce"),
                            ("plata", "Plata"),
                            ("oro", "Oro"),
                            ("diamante", "Diamante"),
                        ],
                        default="bronce",
                        max_length=20,
                    ),
                ),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                (
                    "cliente",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cuenta_puntos",
                        to="clientes.cliente",
                    ),
                ),
            ],
            options={
                "verbose_name": "Cuenta de puntos",
                "verbose_name_plural": "Cuentas de puntos",
            },
        ),
        migrations.CreateModel(
            name="CatalogoCanje",
            fields=[
                (
                    "id",
                    models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                ),
                ("tenant", models.ForeignKey(blank=True, db_index=True, editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="puntos_catalogocanje_set", to=settings.TENANT_MODEL)),
                ("nombre", models.CharField(max_length=160)),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("descuento_compra", "Descuento en compra"),
                            ("producto_farmacia", "Producto de farmacia"),
                            ("cupon_externo", "Cupon externo"),
                        ],
                        max_length=40,
                    ),
                ),
                ("descripcion", models.TextField(blank=True)),
                ("imagen", models.ImageField(blank=True, null=True, upload_to="puntos/canje/")),
                ("puntos_requeridos", models.PositiveIntegerField()),
                ("valor_descuento_bs", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10)),
                ("codigo_cupon_externo", models.CharField(blank=True, max_length=120)),
                ("instrucciones_canje", models.TextField(blank=True)),
                ("url_externa", models.URLField(blank=True)),
                ("stock_disponible", models.IntegerField(default=-1, help_text="-1 significa ilimitado")),
                ("limite_por_cliente", models.PositiveIntegerField(default=1)),
                ("activo", models.BooleanField(default=True)),
                ("valido_hasta", models.DateField(blank=True, null=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                (
                    "producto",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="recompensas_puntos",
                        to="inventarios.producto",
                    ),
                ),
            ],
            options={
                "verbose_name": "Catalogo de canje",
                "verbose_name_plural": "Catalogo de canjes",
                "ordering": ["puntos_requeridos", "nombre"],
            },
        ),
        migrations.CreateModel(
            name="CanjePuntos",
            fields=[
                (
                    "id",
                    models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                ),
                ("tenant", models.ForeignKey(blank=True, db_index=True, editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="puntos_canjepuntos_set", to=settings.TENANT_MODEL)),
                ("codigo_voucher", models.CharField(max_length=40, unique=True)),
                ("puntos_usados", models.PositiveIntegerField()),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("pendiente", "Pendiente"),
                            ("aplicado", "Aplicado"),
                            ("cancelado", "Cancelado"),
                        ],
                        default="pendiente",
                        max_length=20,
                    ),
                ),
                ("observacion", models.TextField(blank=True)),
                ("aplicado_en", models.DateTimeField(blank=True, null=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                (
                    "catalogo",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="canjes", to="puntos.catalogocanje"),
                ),
                (
                    "cuenta",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="canjes", to="puntos.cuentapuntos"),
                ),
                (
                    "venta",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="canjes_puntos",
                        to="ventas.venta",
                    ),
                ),
            ],
            options={
                "verbose_name": "Canje de puntos",
                "verbose_name_plural": "Canjes de puntos",
                "ordering": ["-creado_en"],
            },
        ),
        migrations.CreateModel(
            name="TransaccionPuntos",
            fields=[
                (
                    "id",
                    models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                ),
                ("tenant", models.ForeignKey(blank=True, db_index=True, editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="puntos_transaccionpuntos_set", to=settings.TENANT_MODEL)),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("ganado", "Ganado"),
                            ("canjeado", "Canjeado"),
                            ("expirado", "Expirado"),
                            ("ajuste", "Ajuste"),
                            ("reverso", "Reverso"),
                        ],
                        max_length=20,
                    ),
                ),
                ("puntos", models.IntegerField()),
                ("saldo_resultante", models.PositiveIntegerField()),
                ("descripcion", models.TextField(blank=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "canje",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="transacciones",
                        to="puntos.canjepuntos",
                    ),
                ),
                (
                    "cuenta",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="transacciones", to="puntos.cuentapuntos"),
                ),
                (
                    "venta",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="transacciones_puntos",
                        to="ventas.venta",
                    ),
                ),
            ],
            options={
                "verbose_name": "Transaccion de puntos",
                "verbose_name_plural": "Transacciones de puntos",
                "ordering": ["-creado_en"],
            },
        ),
    ]