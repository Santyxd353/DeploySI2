from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("carrito", "0002_carrito_invitado_token"),
        ("clientes", "0002_recetamedica"),
    ]

    operations = [
        migrations.AddField(
            model_name="carritoitem",
            name="receta",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="items_carrito",
                to="clientes.recetamedica",
            ),
        ),
    ]
