from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('schedule', '0001_initial')]
    operations = [
        migrations.RenameIndex(model_name='shift', old_name='shifts_restaur_a1b2c3_idx', new_name='shifts_restaur_84d2a9_idx'),
        migrations.RenameIndex(model_name='shift', old_name='shifts_staff_d4e5f6_idx', new_name='shifts_staff_i_e7e225_idx'),
    ]
