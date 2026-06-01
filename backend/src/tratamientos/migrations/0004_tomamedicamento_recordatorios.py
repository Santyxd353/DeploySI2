from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tratamientos", "0003_tratamientobase_duracion_minutos_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="tomamedicamento",
            name="recordatorio_enviado_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="tomamedicamento",
            name="recordatorio_retraso_enviado_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
