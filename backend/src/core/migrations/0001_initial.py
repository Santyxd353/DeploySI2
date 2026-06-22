from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BitacoraSistema",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("fecha_hora", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("accion", models.CharField(db_index=True, max_length=50)),
                ("modulo", models.CharField(db_index=True, max_length=80)),
                ("entidad", models.CharField(blank=True, default="", max_length=80)),
                ("entidad_id", models.CharField(blank=True, default="", max_length=64)),
                ("resultado", models.CharField(db_index=True, max_length=20)),
                ("mensaje", models.CharField(blank=True, default="", max_length=255)),
                ("ip_origen", models.GenericIPAddressField(blank=True, null=True)),
                ("ruta", models.CharField(blank=True, default="", max_length=255)),
                ("metodo_http", models.CharField(blank=True, default="", max_length=10)),
                (
                    "usuario",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="eventos_bitacora",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "core_bitacora_sistema",
                "ordering": ["-fecha_hora"],
            },
        ),
    ]
