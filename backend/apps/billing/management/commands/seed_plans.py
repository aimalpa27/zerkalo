from django.core.management.base import BaseCommand

from apps.billing.models import SubscriptionPlan

PLANS = [
    dict(
        code='trial', name='Тест', sort_order=0,
        description='14 дней бесплатно — попробовать перед покупкой',
        price=0, billing_period_days=14, max_tables=3, max_staff=2,
        delivery_enabled=False, online_orders_enabled=True, waiter_calls_enabled=True,
        analytics_enabled=False, kaspi_pay_enabled=False,
        priority_support=False, schedule_enabled=False, chat_enabled=False,
    ),
    dict(
        code='start', name='Старт', sort_order=1,
        description='QR-меню, админка, заказы, вызов официанта и чат команды',
        price=15000, billing_period_days=30, max_tables=10, max_staff=5,
        delivery_enabled=False, online_orders_enabled=True, waiter_calls_enabled=True,
        analytics_enabled=False, kaspi_pay_enabled=False,
        priority_support=False, schedule_enabled=False, chat_enabled=True,
    ),
    dict(
        code='pro', name='Pro', sort_order=2,
        description='Без ограничений + аналитика, доставка, Kaspi Pay, график смен и чат команды',
        price=25000, billing_period_days=30, max_tables=None, max_staff=None,
        delivery_enabled=True, online_orders_enabled=True, waiter_calls_enabled=True,
        analytics_enabled=True, kaspi_pay_enabled=True,
        priority_support=True, schedule_enabled=True, chat_enabled=True,
    ),
]


class Command(BaseCommand):
    help = 'Создаёт/обновляет базовые тарифные планы Plait (Тест, Старт, Pro)'

    def handle(self, *args, **options):
        for data in PLANS:
            plan, created = SubscriptionPlan.objects.update_or_create(
                code=data['code'], defaults=data,
            )
            action = 'создан' if created else 'обновлён'
            self.stdout.write(self.style.SUCCESS(f'Тариф "{plan.name}" {action}'))