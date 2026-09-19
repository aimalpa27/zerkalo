import django.db.models.deletion
import uuid
from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = [('menu', '0005_upsellrule'), ('restaurants', '0001_initial'), ('order_sessions', '0001_initial'), ('tables', '0001_initial')]
    operations = [migrations.CreateModel(name='UpsellEvent', fields=[
        ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
        ('event_type', models.CharField(choices=[('impression','Impression'),('add','Add'),('conversion','Conversion')], max_length=16)),
        ('revenue', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
        ('created_at', models.DateTimeField(auto_now_add=True)),
        ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='upsell_events', to='restaurants.restaurant')),
        ('rule', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='menu.upsellrule')),
        ('session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='upsell_events', to='order_sessions.tablesession')),
        ('table', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='upsell_events', to='tables.table')),
    ], options={'db_table':'upsell_events'}),
    migrations.AddIndex(model_name='upsellevent', index=models.Index(fields=['restaurant','created_at'], name='upsell_even_restaur_idx')),
    migrations.AddIndex(model_name='upsellevent', index=models.Index(fields=['rule','event_type','created_at'], name='upsell_even_rule_ev_idx')),
    ]
