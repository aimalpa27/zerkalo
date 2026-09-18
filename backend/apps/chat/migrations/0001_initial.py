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
            name='ChatMessage',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('sender_name', models.CharField(max_length=255)),
                ('sender_role', models.CharField(blank=True, max_length=20)),
                ('text', models.TextField()),
                ('is_pinned', models.BooleanField(default=False)),
                ('pinned_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chat_messages', to='restaurants.restaurant')),
                ('sender', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='chat_messages', to='users.user')),
            ],
            options={
                'db_table': 'chat_messages',
                'ordering': ['created_at'],
                'indexes': [
                    models.Index(fields=['restaurant', 'created_at'], name='chat_msg_rest_created_idx'),
                    models.Index(fields=['restaurant', 'is_pinned'], name='chat_msg_rest_pinned_idx'),
                ],
            },
        ),
    ]
