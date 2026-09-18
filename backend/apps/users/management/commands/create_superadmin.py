from django.core.management.base import BaseCommand, CommandError

from apps.users.models import User


class Command(BaseCommand):
    help = 'Создаёт пользователя с ролью superadmin (тех-команда Plait)'

    def add_arguments(self, parser):
        parser.add_argument('email')
        parser.add_argument('password')
        parser.add_argument('--name', default='Plait Tech')

    def handle(self, *args, **options):
        email = options['email']
        if User.objects.filter(email=email).exists():
            raise CommandError(f'Пользователь {email} уже существует')

        user = User.objects.create_user(
            email=email,
            password=options['password'],
            name=options['name'],
            role='superadmin',
            is_staff=True,
        )
        self.stdout.write(self.style.SUCCESS(f'Superadmin {user.email} создан'))