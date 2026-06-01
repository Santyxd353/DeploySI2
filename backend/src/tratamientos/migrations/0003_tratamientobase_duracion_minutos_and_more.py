from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tratamientos", "0002_tratamientobase_frecuencia_minutos"),
    ]

    operations = [
        migrations.AddField(
            model_name="tratamientobase",
            name="duracion_minutos",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="tratamientoactivo",
            name="fecha_fin_programada",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
