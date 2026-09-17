from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("users", "0004_user_assigned_zones")]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("admin", "Администратор"),
                    ("manager", "Менеджер"),
                    ("waiter", "Официант"),
                    ("cashier", "Кассир"),
                    ("kitchen", "Кухня"),
                    ("superadmin", "Тех-поддержка Plait"),
                ],
                default="waiter",
                max_length=10,
            ),
        ),
    ]
