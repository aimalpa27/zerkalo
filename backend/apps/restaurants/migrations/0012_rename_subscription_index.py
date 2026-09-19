from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('restaurants', '0011_restaurant_sla_targets')]
    operations = [
        migrations.RenameIndex(
            model_name='restaurant',
            old_name='restaurants_subscri_idx',
            new_name='restaurants_subscri_1c9004_idx',
        )
    ]
