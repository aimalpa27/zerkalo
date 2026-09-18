from django.db import migrations, models
import django.db.models.deletion
import uuid

class Migration(migrations.Migration):
    dependencies = [('menu','0005_upsellrule'), ('restaurants','0010_restaurant_network')]
    operations = [
        migrations.CreateModel(name='NetworkMenuTemplateItem', fields=[
            ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ('name', models.CharField(max_length=255)), ('category_name', models.CharField(blank=True,max_length=255)),
            ('description', models.TextField(blank=True)), ('price', models.DecimalField(decimal_places=2,max_digits=10)),
            ('image_url', models.URLField(blank=True)), ('emoji', models.CharField(blank=True,max_length=10)), ('weight', models.CharField(blank=True,max_length=50)),
            ('preparation_station', models.CharField(choices=[('kitchen','Кухня'),('bar','Бар')],default='kitchen',max_length=10)),
            ('is_available',models.BooleanField(default=True)), ('is_visible',models.BooleanField(default=True)), ('sort_order',models.PositiveIntegerField(default=0)),
            ('created_at',models.DateTimeField(auto_now_add=True)), ('updated_at',models.DateTimeField(auto_now=True)),
            ('network',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='menu_template_items',to='restaurants.restaurantnetwork')),
        ], options={'db_table':'network_menu_template_items','ordering':['sort_order','created_at']}),
        migrations.AddConstraint(model_name='networkmenutemplateitem', constraint=models.UniqueConstraint(fields=('network','name'),name='uniq_network_template_item_name')),
        migrations.CreateModel(name='NetworkMenuBranchOverride', fields=[
            ('id',models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)), ('price',models.DecimalField(blank=True,decimal_places=2,max_digits=10,null=True)),
            ('is_available',models.BooleanField(blank=True,null=True)), ('is_visible',models.BooleanField(blank=True,null=True)), ('updated_at',models.DateTimeField(auto_now=True)),
            ('restaurant',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='network_menu_overrides',to='restaurants.restaurant')),
            ('template_item',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='branch_overrides',to='menu.networkmenutemplateitem')),
        ], options={'db_table':'network_menu_branch_overrides'}),
        migrations.AddConstraint(model_name='networkmenubranchoverride', constraint=models.UniqueConstraint(fields=('template_item','restaurant'),name='uniq_template_branch_override')),
        migrations.AddField(model_name='menuitem',name='network_template_item',field=models.ForeignKey(blank=True,null=True,on_delete=django.db.models.deletion.SET_NULL,related_name='published_items',to='menu.networkmenutemplateitem')),
    ]
