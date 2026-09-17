# Hand-written to mirror apps/restaurants/models.py (Restaurant.order_confirmation_*).
# No Python/Django environment was available in this sandbox to run
# `manage.py makemigrations` — please verify with
# `python manage.py makemigrations --check` in a real environment.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0008_iiko_cloud_api'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='order_confirmation_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='order_reminder_after_sec',
            field=models.PositiveIntegerField(default=60),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='order_escalate_after_sec',
            field=models.PositiveIntegerField(default=180),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='order_auto_action',
            field=models.CharField(
                choices=[
                    ('none', 'Ничего'),
                    ('auto_confirm', 'Автоматически принимать'),
                    ('auto_reject', 'Автоматически отклонять'),
                ],
                default='none',
                max_length=20,
            ),
        ),
    ]
