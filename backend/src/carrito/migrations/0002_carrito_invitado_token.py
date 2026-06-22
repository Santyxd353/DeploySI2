from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("carrito", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="carrito",
            name="invitado_token",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
    ]
