from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('restaurants', '0010_restaurant_network')]
    operations = [
        migrations.AddField(model_name='restaurant', name='kitchen_sla_minutes', field=models.PositiveSmallIntegerField(default=20)),
        migrations.AddField(model_name='restaurant', name='bar_sla_minutes', field=models.PositiveSmallIntegerField(default=10)),
        migrations.AddField(model_name='restaurant', name='ready_to_served_sla_minutes', field=models.PositiveSmallIntegerField(default=5)),
    ]
