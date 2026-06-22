from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0002_factura'),
    ]

    operations = [
        migrations.AddField(
            model_name='venta',
            name='stripe_payment_intent_id',
            field=models.CharField(blank=True, db_index=True, max_length=128, null=True, unique=True),
        ),
    ]
