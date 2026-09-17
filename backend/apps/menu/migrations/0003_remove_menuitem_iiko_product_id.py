from django.db import migrations


class Migration(migrations.Migration):
    """Drops MenuItem.iiko_product_id (iiko integration removed)."""

    dependencies = [
        ('menu', '0002_menuitem_video_url'),
    ]

    operations = [
        migrations.RemoveField(model_name='menuitem', name='iiko_product_id'),
    ]
