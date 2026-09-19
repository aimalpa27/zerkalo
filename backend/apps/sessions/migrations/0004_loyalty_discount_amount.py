from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('order_sessions', '0003_order_confirmation_status_model'),
        ('loyalty', '0002_program_redemption'),
    ]
    operations = [
        migrations.AddField(
            model_name='tablesession',
            name='loyalty_discount_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        )
    ]
