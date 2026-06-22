import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clientes", "0004_add_campos_clinicos_cliente"),
    ]

    operations = [
        migrations.CreateModel(
            name="MedicoReceta",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=200)),
                ("licencia", models.CharField(blank=True, max_length=100)),
                ("especialidad", models.CharField(blank=True, max_length=100)),
                ("firma_imagen", models.ImageField(blank=True, null=True, upload_to="firmas_medicos/")),
                (
                    "receta",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="medico",
                        to="clientes.recetamedica",
                    ),
                ),
            ],
            options={
                "verbose_name": "Médico de receta",
                "verbose_name_plural": "Médicos de recetas",
            },
        ),
    ]
