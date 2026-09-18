from django.db import migrations, models
import django.db.models.deletion
import uuid

class Migration(migrations.Migration):
    dependencies = [('sessions','0006_sla_incidents'), ('restaurants','0001_initial'), ('users','0001_initial')]
    operations = [
        migrations.CreateModel(
            name='OperationalExceptionState',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('exception_key', models.CharField(max_length=100)), ('kind', models.CharField(max_length=20)),
                ('first_seen_at', models.DateTimeField()), ('acknowledged_at', models.DateTimeField(blank=True, null=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)), ('updated_at', models.DateTimeField(auto_now=True)),
                ('acknowledged_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='acknowledged_operational_exceptions', to='users.user')),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='operational_exception_states', to='restaurants.restaurant')),
            ],
            options={'db_table':'operational_exception_states'},
        ),
        migrations.AddConstraint(model_name='operationalexceptionstate', constraint=models.UniqueConstraint(fields=('restaurant','exception_key'), name='uniq_restaurant_exception_key')),
        migrations.AddIndex(model_name='operationalexceptionstate', index=models.Index(fields=['restaurant','resolved_at'], name='operationa_restaur_2a7438_idx')),
        migrations.AddIndex(model_name='operationalexceptionstate', index=models.Index(fields=['restaurant','kind'], name='operationa_restaur_42a17a_idx')),
    ]
