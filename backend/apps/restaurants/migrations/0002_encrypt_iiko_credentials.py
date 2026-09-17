from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Replaces the previous django-cryptography encrypt() fields with plain
    CharField. django-cryptography 1.1 is incompatible with Django 5.0+
    (uses removed django.utils.baseconv). iiko credentials are admin-only
    and protected by DB-level access controls.
    """

    dependencies = [
        ('restaurants', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='restaurant',
            name='iiko_login',
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AlterField(
            model_name='restaurant',
            name='iiko_password',
            field=models.CharField(blank=True, max_length=500),
        ),
    ]
