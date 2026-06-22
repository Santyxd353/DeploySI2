from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tratamientos", "0008_rename_tratamientoc_cliente_1e2d0f_idx_tratamiento_cliente_6a4f3e_idx_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="tratamientoactivo",
            name="estado",
            field=models.CharField(
                choices=[
                    ("activo", "Activo"),
                    ("completado", "Completado"),
                    ("cancelado", "Cancelado"),
                    ("abandonado", "Abandonado"),
                    ("pausado", "Pausado"),
                ],
                default="activo",
                max_length=20,
            ),
        ),
    ]