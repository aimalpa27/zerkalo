from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0002_subscriptionplan_schedule_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscriptionplan',
            name='chat_enabled',
            field=models.BooleanField(default=False),
        ),
    ]
