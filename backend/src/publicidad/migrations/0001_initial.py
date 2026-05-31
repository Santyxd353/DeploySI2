import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SegmentoRFM",
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
                        related_name="publicidad_segmentorfm_set",
                        to="tenants.tenant",
                    ),
                ),
                (
                    "codigo",
                    models.CharField(
                        choices=[
                            ("todos", "Todos los clientes"),
                            ("champions", "Campeones"),
                            ("frecuentes", "Frecuentes"),
                            ("nuevos", "Nuevos"),
                            ("en_riesgo", "En riesgo"),
                            ("inactivos", "Inactivos"),
                        ],
                        max_length=20,
                    ),
                ),
                ("nombre", models.CharField(max_length=60)),
                ("descripcion", models.CharField(blank=True, max_length=200)),
            ],
            options={
                "ordering": ["codigo"],
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="CampanaPublicitaria",
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
                        related_name="publicidad_campanapublicitaria_set",
                        to="tenants.tenant",
                    ),
                ),
                ("titulo", models.CharField(max_length=120)),
                ("descripcion", models.TextField(blank=True)),
                ("imagen", models.ImageField(blank=True, null=True, upload_to="publicidad/")),
                ("descuento", models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                (
                    "segmentos",
                    models.ManyToManyField(
                        blank=True,
                        related_name="campanas",
                        to="publicidad.segmentorfm",
                        verbose_name="Segmentos RFM",
                    ),
                ),
                ("fecha_inicio", models.DateField()),
                ("fecha_fin", models.DateField()),
                ("activa", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
    ]
