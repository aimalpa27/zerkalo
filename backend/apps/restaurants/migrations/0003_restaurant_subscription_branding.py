import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0001_initial'),
        ('restaurants', '0002_encrypt_iiko_credentials'),
    ]

    operations = [
        migrations.AddField(
            model_name='restaurant',
            name='logo_url',
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='theme',
            field=models.CharField(
                choices=[('dark', 'Тёмная'), ('light', 'Светлая')],
                default='dark',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='accent_color',
            field=models.CharField(default='#FF6B1A', max_length=7),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='subscription_status',
            field=models.CharField(
                choices=[
                    ('trial', 'Триал'),
                    ('active', 'Активна'),
                    ('past_due', 'Просрочена'),
                    ('suspended', 'Приостановлена'),
                ],
                default='trial',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='subscription_expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='restaurant',
            name='subscription_plan',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='restaurants',
                to='billing.subscriptionplan',
            ),
        ),
        migrations.AddIndex(
            model_name='restaurant',
            index=models.Index(fields=['subscription_status'], name='restaurants_subscri_idx'),
        ),
    ]