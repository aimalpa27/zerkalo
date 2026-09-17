from django.db import migrations, models


class Migration(migrations.Migration):
    """Возвращает интеграцию iiko (Public API): флаг включения и api_key ресторана.

    app_id / client_secret общие и живут в settings/.env, поэтому в модель не
    попадают — здесь только то, что своё у каждого ресторана.
    """

    dependencies = [
        ('restaurants', '0006_remove_iiko_integration'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='iiko_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='iiko_api_key',
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
