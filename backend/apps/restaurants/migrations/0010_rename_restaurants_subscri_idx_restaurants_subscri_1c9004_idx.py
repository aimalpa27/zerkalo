from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0009_order_confirmation_fields'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='restaurant',
            old_name='restaurants_subscri_idx',
            new_name='restaurants_subscri_1c9004_idx',
        ),
    ]
