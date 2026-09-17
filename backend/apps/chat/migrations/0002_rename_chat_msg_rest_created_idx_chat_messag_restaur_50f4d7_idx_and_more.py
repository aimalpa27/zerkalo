from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0001_initial'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='chatmessage',
            old_name='chat_msg_rest_created_idx',
            new_name='chat_messag_restaur_50f4d7_idx',
        ),
        migrations.RenameIndex(
            model_name='chatmessage',
            old_name='chat_msg_rest_pinned_idx',
            new_name='chat_messag_restaur_f041f0_idx',
        ),
    ]
