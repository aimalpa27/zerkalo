import uuid
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    initial = True
    dependencies = [('restaurants','0010_restaurant_network'), ('order_sessions','0003_order_confirmation_status_model')]
    operations = [
        migrations.CreateModel(name='LoyaltyMember', fields=[
            ('id',models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),
            ('token',models.UUIDField(default=uuid.uuid4,editable=False)),('visits_count',models.PositiveIntegerField(default=0)),
            ('lifetime_spend',models.DecimalField(decimal_places=2,default=0,max_digits=14)),('points',models.PositiveIntegerField(default=0)),
            ('first_seen_at',models.DateTimeField(auto_now_add=True)),('last_visit_at',models.DateTimeField(blank=True,null=True)),
            ('restaurant',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='loyalty_members',to='restaurants.restaurant'))],
            options={'db_table':'loyalty_members'}),
        migrations.AddConstraint(model_name='loyaltymember',constraint=models.UniqueConstraint(fields=('restaurant','token'),name='uniq_loyalty_restaurant_token')),
        migrations.AddIndex(model_name='loyaltymember',index=models.Index(fields=['restaurant','last_visit_at'],name='loyalty_mem_restaur_idx')),
        migrations.CreateModel(name='LoyaltyVisit',fields=[
            ('id',models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),('spend',models.DecimalField(decimal_places=2,max_digits=12)),('points_earned',models.PositiveIntegerField(default=0)),('created_at',models.DateTimeField(auto_now_add=True)),
            ('member',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='visits',to='loyalty.loyaltymember')),
            ('session',models.OneToOneField(on_delete=django.db.models.deletion.CASCADE,related_name='loyalty_visit',to='order_sessions.tablesession'))],options={'db_table':'loyalty_visits'}),
        migrations.AddIndex(model_name='loyaltyvisit',index=models.Index(fields=['member','created_at'],name='loyalty_vis_member_idx')),
    ]
