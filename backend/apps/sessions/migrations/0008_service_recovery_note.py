import uuid
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [('order_sessions','0007_operational_exception_state'),('users','0001_initial')]
    operations = [migrations.CreateModel(name='ServiceRecoveryNote', fields=[
        ('id',models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),
        ('reason',models.CharField(choices=[('delay','Delay'),('quality','Quality'),('wrong_order','Wrong order'),('service','Service'),('payment','Payment'),('other','Other')],max_length=20)),
        ('note',models.TextField(max_length=1000)),('compensation_type',models.CharField(blank=True,default='',max_length=50)),
        ('compensation_amount',models.DecimalField(decimal_places=2,default=Decimal('0'),max_digits=12)),
        ('created_at',models.DateTimeField(auto_now_add=True)),('updated_at',models.DateTimeField(auto_now=True)),
        ('created_by',models.ForeignKey(null=True,on_delete=django.db.models.deletion.SET_NULL,related_name='service_recoveries_created',to=settings.AUTH_USER_MODEL)),
        ('restaurant',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='service_recoveries',to='restaurants.restaurant')),
        ('session',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='service_recoveries',to='order_sessions.tablesession')),
    ], options={'db_table':'service_recovery_notes','indexes':[models.Index(fields=['restaurant','created_at'],name='service_rec_restaur_54ab_idx'),models.Index(fields=['restaurant','reason'],name='service_rec_restaur_013e_idx')]})]
