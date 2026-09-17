from django.db import migrations, models


class Migration(migrations.Migration):
    """ID блюда в номенклатуре iiko — для синхронизации меню."""

    dependencies = [
        ('menu', '0003_remove_menuitem_iiko_product_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='menuitem',
            name='iiko_external_id',
            field=models.CharField(blank=True, db_index=True, max_length=64),
        ),
    ]
