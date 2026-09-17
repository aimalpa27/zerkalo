import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('restaurants', '0001_initial'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Shift',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('date', models.DateField()),
                ('start_time', models.TimeField()),
                ('end_time', models.TimeField()),
                ('note', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shifts', to='restaurants.restaurant')),
                ('staff', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shifts', to='users.user')),
            ],
            options={
                'db_table': 'shifts',
                'ordering': ['date', 'start_time'],
                'indexes': [
                    models.Index(fields=['restaurant', 'date'], name='shifts_restaur_a1b2c3_idx'),
                    models.Index(fields=['staff', 'date'], name='shifts_staff_d4e5f6_idx'),
                ],
            },
        ),
    ]
