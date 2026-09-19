from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [('loyalty','0001_initial')]
    operations = [
        migrations.CreateModel(name='LoyaltyProgram', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('is_enabled', models.BooleanField(default=True)), ('points_per_1000', models.PositiveIntegerField(default=1)),
            ('reward_points', models.PositiveIntegerField(default=10)), ('reward_discount_amount', models.DecimalField(decimal_places=2, default=1000, max_digits=10)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('restaurant', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='loyalty_program', to='restaurants.restaurant'))],
            options={'db_table':'loyalty_programs'}),
        migrations.CreateModel(name='LoyaltyRedemption', fields=[
            ('id', models.UUIDField(default=__import__('uuid').uuid4, editable=False, primary_key=True, serialize=False)),
            ('points_spent', models.PositiveIntegerField()), ('discount_amount', models.DecimalField(decimal_places=2, max_digits=10)), ('created_at', models.DateTimeField(auto_now_add=True)),
            ('member', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='redemptions', to='loyalty.loyaltymember')),
            ('session', models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name='loyalty_redemption', to='order_sessions.tablesession'))], options={'db_table':'loyalty_redemptions'}),
        migrations.AddIndex(model_name='loyaltyredemption', index=models.Index(fields=['member','created_at'], name='loyalty_red_member_idx')),
    ]
