from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('analytics', '0001_upsellevent')]
    operations = [
        migrations.RenameIndex(model_name='upsellevent', old_name='upsell_even_restaur_idx', new_name='upsell_even_restaur_e6976e_idx'),
        migrations.RenameIndex(model_name='upsellevent', old_name='upsell_even_rule_ev_idx', new_name='upsell_even_rule_id_54f05d_idx'),
    ]
