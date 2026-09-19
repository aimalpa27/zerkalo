from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("order_sessions", "0008_service_recovery_note")]
    operations = [
        migrations.AddField(
            model_name="servicerecoverynote",
            name="source_exception",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="service_recoveries",
                to="order_sessions.operationalexceptionstate",
            ),
        ),
        migrations.AddField(
            model_name="servicerecoverynote",
            name="source_sla_incident",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="service_recoveries",
                to="order_sessions.slaincident",
            ),
        ),
    ]
