from django.db import migrations, models
import django.db.models.deletion
import uuid

class Migration(migrations.Migration):
    dependencies = [('restaurants', '0009_order_confirmation_fields')]
    operations = [
        migrations.CreateModel(
            name='RestaurantNetwork',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner_restaurant', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='owned_network', to='restaurants.restaurant')),
                ('restaurants', models.ManyToManyField(blank=True, related_name='networks', to='restaurants.restaurant')),
            ],
            options={'db_table': 'restaurant_networks'},
        ),
    ]
