import uuid
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [('sessions', '0005_staff_lifecycle_attribution'), ('restaurants', '0011_restaurant_sla_targets')]
    operations = [
        migrations.CreateModel(
            name='SLAIncident',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)),
                ('kind', models.CharField(max_length=20, choices=[('preparation','Preparation'),('handoff','Ready to served')])),
                ('station', models.CharField(max_length=10, blank=True, default='')),
                ('target_minutes', models.PositiveSmallIntegerField()),
                ('breached_at', models.DateTimeField()),
                ('resolved_at', models.DateTimeField(null=True, blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sla_incidents', to='sessions.sessionitem')),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sla_incidents', to='restaurants.restaurant')),
            ], options={'db_table':'sla_incidents'},
        ),
        migrations.AddConstraint(model_name='slaincident', constraint=models.UniqueConstraint(fields=('item','kind'), name='unique_sla_incident_item_kind')),
        migrations.AddIndex(model_name='slaincident', index=models.Index(fields=['restaurant','resolved_at','breached_at'], name='sla_inc_rest_res_breach_idx')),
    ]
