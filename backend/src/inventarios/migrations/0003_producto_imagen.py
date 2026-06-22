from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventarios", "0002_entradastock"),
    ]

    operations = [
        migrations.AddField(
            model_name="producto",
            name="imagen",
            field=models.ImageField(blank=True, null=True, upload_to="productos/"),
        ),
    ]
