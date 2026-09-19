from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("order_sessions", "0004_loyalty_discount_amount"), ("users", "0004_user_assigned_zones")]
    operations = [
        migrations.AddField(model_name="sessionitem", name="confirmed_by", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="confirmed_session_items", to="users.user")),
        migrations.AddField(model_name="sessionitem", name="served_by", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="served_session_items", to="users.user")),
    ]
