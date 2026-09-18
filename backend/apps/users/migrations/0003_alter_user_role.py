from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_user_groups_user_is_staff_user_is_superuser_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('admin', 'Администратор'),
                    ('manager', 'Менеджер'),
                    ('waiter', 'Официант'),
                    ('cashier', 'Кассир'),
                    ('superadmin', 'Тех-поддержка Plait'),
                ],
                default='waiter',
                max_length=10,
            ),
        ),
    ]