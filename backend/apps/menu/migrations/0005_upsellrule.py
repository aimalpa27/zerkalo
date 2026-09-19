import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('menu', '0004_menuitem_iiko_external_id'), ('restaurants', '0001_initial')]
    operations = [
        migrations.CreateModel(
            name='UpsellRule',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('priority', models.PositiveSmallIntegerField(default=100)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('recommended_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='upsell_recommendations', to='menu.menuitem')),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='upsell_rules', to='restaurants.restaurant')),
                ('trigger_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='upsell_triggers', to='menu.menuitem')),
            ],
            options={'db_table': 'upsell_rules', 'ordering': ['priority', 'created_at']},
        ),
        migrations.AddConstraint(
            model_name='upsellrule',
            constraint=models.UniqueConstraint(
                fields=('restaurant', 'trigger_item', 'recommended_item'),
                name='uniq_restaurant_upsell_pair',
            ),
        ),
        migrations.AddConstraint(
            model_name='upsellrule',
            constraint=models.CheckConstraint(
                check=~models.Q(trigger_item=models.F('recommended_item')),
                name='upsell_items_must_differ',
            ),
        ),
        migrations.AddIndex(
            model_name='upsellrule',
            index=models.Index(fields=['restaurant', 'is_active', 'priority'], name='upsell_rule_restaur_idx'),
        ),
    ]
