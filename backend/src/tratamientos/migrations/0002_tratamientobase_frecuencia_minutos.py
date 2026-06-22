from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tratamientos", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="tratamientobase",
            name="frecuencia_minutos",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
