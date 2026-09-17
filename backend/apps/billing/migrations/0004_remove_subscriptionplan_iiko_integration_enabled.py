from django.db import migrations


class Migration(migrations.Migration):
    """Drops SubscriptionPlan.iiko_integration_enabled (iiko integration removed)."""

    dependencies = [
        ('billing', '0003_subscriptionplan_chat_enabled'),
    ]

    operations = [
        migrations.RemoveField(model_name='subscriptionplan', name='iiko_integration_enabled'),
    ]
