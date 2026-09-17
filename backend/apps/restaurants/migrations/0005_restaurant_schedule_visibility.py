from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurants', '0004_restaurant_delivery_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='schedule_visibility',
            field=models.CharField(
                choices=[('own', 'Только свои смены'), ('all', 'Смены всех сотрудников')],
                default='own',
                max_length=10,
            ),
        ),
    ]
