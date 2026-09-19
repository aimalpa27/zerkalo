from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('menu', '0006_network_menu_templates')]
    operations = [
        migrations.RenameIndex(
            model_name='upsellrule',
            old_name='upsell_rule_restaur_idx',
            new_name='upsell_rule_restaur_b6351e_idx',
        )
    ]
