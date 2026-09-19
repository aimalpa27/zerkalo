import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('order_sessions', '0009_service_recovery_sources')]
    operations = [
        migrations.RenameIndex(model_name='operationalexceptionstate', old_name='operationa_restaur_2a7438_idx', new_name='operational_restaur_026fff_idx'),
        migrations.RenameIndex(model_name='operationalexceptionstate', old_name='operationa_restaur_42a17a_idx', new_name='operational_restaur_6d629f_idx'),
        migrations.RenameIndex(model_name='servicerecoverynote', old_name='service_rec_restaur_54ab_idx', new_name='service_rec_restaur_f802cc_idx'),
        migrations.RenameIndex(model_name='servicerecoverynote', old_name='service_rec_restaur_013e_idx', new_name='service_rec_restaur_6d98bc_idx'),
        migrations.RenameIndex(model_name='slaincident', old_name='sla_inc_rest_res_breach_idx', new_name='sla_inciden_restaur_01f991_idx'),
        migrations.RenameIndex(model_name='tablesession', old_name='table_sessi_restaur_a1b2c3_idx', new_name='table_sessi_restaur_bd77f1_idx'),
        migrations.AlterField(model_name='slaincident', name='id', field=models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
    ]
