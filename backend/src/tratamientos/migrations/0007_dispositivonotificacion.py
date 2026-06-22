from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("clientes", "0001_initial"),
        ("tratamientos", "0006_tratamientoactivo_dosis_tracking"),
    ]

    operations = [
        migrations.CreateModel(
            name="DispositivoNotificacion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(max_length=512)),
                (
                    "plataforma",
                    models.CharField(
                        choices=[("android", "Android"), ("ios", "iOS"), ("web", "Web"), ("unknown", "Unknown")],
                        default="unknown",
                        max_length=20,
                    ),
                ),
                ("activo", models.BooleanField(default=True)),
                ("ultimo_registro_at", models.DateTimeField(auto_now=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tratamientos_dispositivonotificacion_set", to="tenants.tenant")),
                (
                    "cliente",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dispositivos_notificacion",
                        to="clientes.cliente",
                    ),
                ),
            ],
            options={
                "verbose_name": "Dispositivo de notificación",
                "verbose_name_plural": "Dispositivos de notificación",
                "ordering": ["-ultimo_registro_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="dispositivonotificacion",
            constraint=models.UniqueConstraint(fields=("tenant", "token"), name="uq_dispositivo_notif_tenant_token"),
        ),
        migrations.AddIndex(
            model_name="dispositivonotificacion",
            index=models.Index(fields=["cliente", "activo"], name="tratamientoc_cliente_1e2d0f_idx"),
        ),
        migrations.AddIndex(
            model_name="dispositivonotificacion",
            index=models.Index(fields=["plataforma", "activo"], name="tratamientoc_platafo_a95d58_idx"),
        ),
    ]
