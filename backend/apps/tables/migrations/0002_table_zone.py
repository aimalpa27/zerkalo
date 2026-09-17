# Hand-written — no Django/Python environment was available in this sandbox to run
# `manage.py makemigrations`. Mirrors apps/tables/models.py (Table.zone). Please verify
# with `python manage.py makemigrations --check` in a real environment.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tables', '0001_initial'),
        ('zones', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='table',
            name='zone',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='tables',
                to='zones.zone',
            ),
        ),
    ]
