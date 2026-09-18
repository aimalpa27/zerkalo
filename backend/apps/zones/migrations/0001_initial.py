# Hand-written — no Django/Python environment was available in this sandbox to run
# `manage.py makemigrations`. Mirrors apps/zones/models.py (Zone). Please verify with
# `python manage.py makemigrations --check` in a real environment (in particular the
# auto-generated index name below is a best-effort guess, not a computed hash).

import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('restaurants', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Zone',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
                ('color', models.CharField(blank=True, max_length=9)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='zones', to='restaurants.restaurant')),
            ],
            options={
                'db_table': 'zones',
                'ordering': ['sort_order'],
                'indexes': [models.Index(fields=['restaurant', 'sort_order'], name='zones_restaur_d4e49d_idx')],
                'unique_together': {('restaurant', 'name')},
            },
        ),
    ]
