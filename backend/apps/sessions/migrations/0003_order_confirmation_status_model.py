# Hand-written to mirror apps/sessions/models.py (SessionItem status model:
# awaiting_confirmation/confirmed/ready/served/rejected/cancelled + confirmed_at/rejected_at).
# No Python/Django environment was available in this sandbox to run
# `manage.py makemigrations` — please verify with
# `python manage.py makemigrations --check` in a real environment.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('order_sessions', '0002_delivery_orders'),
    ]

    operations = [
        migrations.AlterField(
            model_name='sessionitem',
            name='status',
            field=models.CharField(
                choices=[
                    ('awaiting_confirmation', 'Ожидает подтверждения'),
                    ('confirmed', 'Принят'),
                    ('ready', 'Готово'),
                    ('served', 'Подано'),
                    ('rejected', 'Отклонён'),
                    ('cancelled', 'Отменён'),
                ],
                default='confirmed',
                max_length=25,
            ),
        ),
        migrations.AddField(
            model_name='sessionitem',
            name='confirmed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='sessionitem',
            name='rejected_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
