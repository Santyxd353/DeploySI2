from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tratamientos", "0004_tomamedicamento_recordatorios"),
    ]

    operations = [
        migrations.AddField(
            model_name="tratamientoactivo",
            name="activado_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="tratamientoactivo",
            name="pausa_desde",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
