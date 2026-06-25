from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("prescripciones", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="capturareceta",
            name="carrito_enviado",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="capturareceta",
            name="carrito_enviado_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
