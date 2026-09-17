# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0003_restaurant_subscription_branding'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='delivery_fee',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='delivery_min_order',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
