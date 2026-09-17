# Hand-written — no Django/Python environment was available in this sandbox to run
# `manage.py makemigrations`. Mirrors apps/users/models.py (User.assigned_zones).
# Please verify with `python manage.py makemigrations --check` in a real environment.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_alter_user_role'),
        ('zones', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='assigned_zones',
            field=models.ManyToManyField(blank=True, related_name='assigned_waiters', to='zones.zone'),
        ),
    ]
