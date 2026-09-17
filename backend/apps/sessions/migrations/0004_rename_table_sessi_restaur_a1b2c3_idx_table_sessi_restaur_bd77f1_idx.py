from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('order_sessions', '0003_order_confirmation_status_model'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='tablesession',
            old_name='table_sessi_restaur_a1b2c3_idx',
            new_name='table_sessi_restaur_bd77f1_idx',
        ),
    ]
