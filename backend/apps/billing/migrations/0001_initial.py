import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='SubscriptionPlan',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.SlugField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('price', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('billing_period_days', models.PositiveIntegerField(default=30)),
                ('max_tables', models.PositiveIntegerField(blank=True, null=True)),
                ('max_staff', models.PositiveIntegerField(blank=True, null=True)),
                ('delivery_enabled', models.BooleanField(default=False)),
                ('online_orders_enabled', models.BooleanField(default=True)),
                ('waiter_calls_enabled', models.BooleanField(default=True)),
                ('analytics_enabled', models.BooleanField(default=False)),
                ('iiko_integration_enabled', models.BooleanField(default=False)),
                ('kaspi_pay_enabled', models.BooleanField(default=False)),
                ('priority_support', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'subscription_plans',
                'ordering': ['sort_order', 'price'],
            },
        ),
    ]