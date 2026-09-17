import logging

from celery import shared_task

from apps.menu.models import Category, MenuItem
from apps.restaurants.models import Restaurant
from apps.integrations.iiko import client_for_restaurant, IikoError

logger = logging.getLogger('apps.integrations')


def _iiko_restaurants():
    """Рестораны с включённой и заполненной интеграцией iiko."""
    return Restaurant.objects.filter(iiko_enabled=True).exclude(iiko_api_key='')


def _category_for(restaurant, name: str, cache: dict):
    """Находит/создаёт категорию ресторана по имени (с кэшем в рамках синка)."""
    if not name:
        return None
    if name in cache:
        return cache[name]
    category, _ = Category.objects.get_or_create(restaurant=restaurant, name=name)
    cache[name] = category
    return category


def sync_restaurant_menu(restaurant) -> tuple[int, int]:
    """Импортирует/обновляет блюда одного ресторана из внешнего меню iiko Cloud API.

    Возвращает (создано, обновлено). Бросает IikoError при проблемах с API.
    """
    products = client_for_restaurant(restaurant).get_products()

    created = updated = 0
    cat_cache: dict = {}
    for product in products:
        external_id = product.get('id')
        if not external_id:
            continue
        hidden = product.get('is_hidden', False)
        defaults = {
            'name': product.get('name', '') or '',
            'price': product.get('price') or 0,
        }
        # FIX: раньше is_available/is_visible при КАЖДОМ синке перезаписывались
        # значением из iiko (not is_hidden). Администратор ставил блюду
        # "нет в наличии" в панели, а ближайший периодический синк возвращал
        # его гостям обратно. Теперь iiko может только скрыть блюдо (стоп-лист);
        # ручное отключение в панели синк не трогает.
        if hidden:
            defaults['is_available'] = False
            defaults['is_visible'] = False
        category = _category_for(restaurant, product.get('category', ''), cat_cache)
        if category is not None:
            defaults['category'] = category
        if product.get('description'):
            defaults['description'] = product['description']

        _, was_created = MenuItem.objects.update_or_create(
            restaurant=restaurant,
            iiko_external_id=external_id,
            defaults=defaults,
            create_defaults={
                **defaults,
                'is_available': not hidden,
                'is_visible': not hidden,
            },
        )
        created += was_created
        updated += not was_created
    return created, updated


@shared_task
def sync_iiko_menu():
    """Периодический импорт меню из iiko для всех включённых ресторанов.

    Каждый ресторан изолирован: ошибка одного не валит остальных.
    """
    total_created = total_updated = processed = 0
    for restaurant in _iiko_restaurants():
        try:
            created, updated = sync_restaurant_menu(restaurant)
        except IikoError as exc:
            logger.warning('iiko menu sync failed restaurant=%s: %s', restaurant.id, exc)
            continue
        except Exception:
            logger.exception('iiko menu sync crashed restaurant=%s', restaurant.id)
            continue
        processed += 1
        total_created += created
        total_updated += updated

    return f'iiko menu sync: restaurants={processed} created={total_created} updated={total_updated}'
