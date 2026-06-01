from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tratamientos", "0005_tratamientoactivo_tiempos_control"),
    ]

    operations = [
        migrations.AddField(
            model_name="tratamientoactivo",
            name="dosis_objetivo",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="tratamientoactivo",
            name="dosis_tomadas",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="tratamientoactivo",
            name="ultima_toma_real_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
