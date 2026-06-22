from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("carrito", "0003_carritoitem_receta"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="carritoitem",
            name="receta",
        ),
    ]
