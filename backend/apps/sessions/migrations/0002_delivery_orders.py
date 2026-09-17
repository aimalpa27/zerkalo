# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('order_sessions', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tablesession',
            name='table_number',
            field=models.PositiveIntegerField(null=True, blank=True),
        ),
        migrations.AlterField(
            model_name='tablesession',
            name='table_token',
            field=models.CharField(max_length=64, blank=True),
        ),
        migrations.AlterField(
            model_name='tablesession',
            name='table',
            field=models.ForeignKey(
                null=True, blank=True,
                on_delete=models.deletion.SET_NULL,
                related_name='sessions',
                to='tables.table',
            ),
        ),
        migrations.AddField(
            model_name='tablesession',
            name='order_type',
            field=models.CharField(
                choices=[('dine_in', 'В заведении'), ('delivery', 'Доставка'), ('pickup', 'Самовывоз')],
                default='dine_in',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='tablesession',
            name='delivery_fee',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='tablesession',
            name='customer_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='tablesession',
            name='customer_phone',
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name='tablesession',
            name='delivery_address',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='tablesession',
            name='delivery_comment',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='tablesession',
            name='delivery_status',
            field=models.CharField(
                blank=True,
                choices=[
                    ('new', 'Новый'),
                    ('confirmed', 'Подтверждён'),
                    ('preparing', 'Готовится'),
                    ('on_the_way', 'Курьер в пути'),
                    ('ready_for_pickup', 'Готов к выдаче'),
                    ('completed', 'Завершён'),
                    ('cancelled', 'Отменён'),
                ],
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name='tablesession',
            index=models.Index(fields=['restaurant', 'order_type', 'delivery_status'], name='table_sessi_restaur_a1b2c3_idx'),
        ),
    ]
