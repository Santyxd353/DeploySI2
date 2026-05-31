from django.db import migrations

SEGMENTOS_DEFAULT = [
    ("todos", "Todos los clientes", "Clientes de todos los segmentos"),
    ("champions", "Campeones", "10+ compras y activos en los últimos 30 días"),
    ("frecuentes", "Frecuentes", "5 o más compras realizadas"),
    ("nuevos", "Nuevos", "Primera compra en los últimos 60 días"),
    ("en_riesgo", "En riesgo", "3+ compras pero inactivos más de 60 días"),
    ("inactivos", "Inactivos", "Sin compras o sin actividad en más de 90 días"),
]


def seed_segmentos(apps, schema_editor):
    SegmentoRFM = apps.get_model("publicidad", "SegmentoRFM")
    for codigo, nombre, descripcion in SEGMENTOS_DEFAULT:
        SegmentoRFM.objects.get_or_create(
            codigo=codigo,
            defaults={"nombre": nombre, "descripcion": descripcion},
        )


def remove_segmentos(apps, schema_editor):
    SegmentoRFM = apps.get_model("publicidad", "SegmentoRFM")
    SegmentoRFM.objects.filter(codigo__in=[s[0] for s in SEGMENTOS_DEFAULT]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("publicidad", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_segmentos, remove_segmentos),
    ]
