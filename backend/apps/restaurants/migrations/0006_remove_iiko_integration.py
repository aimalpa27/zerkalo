from django.db import migrations


class Migration(migrations.Migration):
    """Drops the iiko integration fields from Restaurant (integration removed)."""

    dependencies = [
        ('restaurants', '0005_restaurant_schedule_visibility'),
    ]

    operations = [
        migrations.RemoveField(model_name='restaurant', name='iiko_enabled'),
        migrations.RemoveField(model_name='restaurant', name='iiko_url'),
        migrations.RemoveField(model_name='restaurant', name='iiko_login'),
        migrations.RemoveField(model_name='restaurant', name='iiko_password'),
        migrations.RemoveField(model_name='restaurant', name='iiko_org_id'),
    ]
