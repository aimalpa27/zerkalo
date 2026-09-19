from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('loyalty', '0002_program_redemption')]
    operations = [
        migrations.RenameIndex(model_name='loyaltymember', old_name='loyalty_mem_restaur_idx', new_name='loyalty_mem_restaur_b56189_idx'),
        migrations.RenameIndex(model_name='loyaltyredemption', old_name='loyalty_red_member_idx', new_name='loyalty_red_member__f6ad33_idx'),
        migrations.RenameIndex(model_name='loyaltyvisit', old_name='loyalty_vis_member_idx', new_name='loyalty_vis_member__ab67cb_idx'),
    ]
