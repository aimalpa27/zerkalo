from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='subscriptionplan',
            name='schedule_enabled',
            field=models.BooleanField(default=False),
        ),
    ]
