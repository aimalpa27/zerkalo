from django.db import migrations, models


class Migration(migrations.Migration):
    """Переход iiko на Cloud API: добавляет organizationId и externalMenuId ресторана.

    apiKey / enabled уже есть (0007). appId / clientSecret общие и живут в settings.
    """

    dependencies = [
        ('restaurants', '0007_iiko_integration'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='iiko_organization_id',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='iiko_external_menu_id',
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
