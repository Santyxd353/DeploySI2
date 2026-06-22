from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("clientes", "0005_medicoreceta"),
    ]

    operations = [
        migrations.AddField(
            model_name="recetamedica",
            name="firma_digital",
            field=models.ImageField(blank=True, null=True, upload_to="firmas_recetas/"),
        ),
        migrations.AddField(
            model_name="recetamedica",
            name="fecha_validez",
            field=models.DateField(blank=True, null=True),
        ),
    ]
