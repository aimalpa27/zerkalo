import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email обязателен')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLES = [
        ('admin', 'Администратор'),
        ('manager', 'Менеджер'),
        ('waiter', 'Официант'),
        ('cashier', 'Кассир'),
        ('kitchen', 'Кухня'),
        ('superadmin', 'Тех-поддержка Plait'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=10, choices=ROLES, default='waiter')
    restaurant = models.ForeignKey(
        'restaurants.Restaurant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff',
    )
    assigned_tables = models.ManyToManyField(
        'tables.Table',
        blank=True,
        related_name='assigned_waiters',
    )
    assigned_zones = models.ManyToManyField(
        'zones.Zone',
        blank=True,
        related_name='assigned_waiters',
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    objects = UserManager()

    class Meta:
        db_table = 'users'
        indexes = [models.Index(fields=['restaurant', 'role'])]

    def __str__(self):
        return f'{self.name} ({self.email})'

    @property
    def is_admin_or_manager(self):
        return self.role in ('admin', 'manager')

    @property
    def is_superadmin(self):
        return self.role == 'superadmin'

    @property
    def effective_table_ids(self):
        """Гибридное назначение: столы назначенных зон ∪ отдельно назначенные столы."""
        from apps.tables.models import Table

        zone_ids = self.assigned_zones.values_list('id', flat=True)
        table_ids = set(Table.objects.filter(zone_id__in=list(zone_ids)).values_list('id', flat=True))
        table_ids |= set(self.assigned_tables.values_list('id', flat=True))
        return table_ids
