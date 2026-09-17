from celery import shared_task
from django.core.cache import cache

from .models import MenuItem


@shared_task
def optimize_menu_image(menu_item_id):
    """Доп. оптимизация изображения блюда через Cloudinary URL-трансформации
    и сброс кэша меню, чтобы клиенты получили обновлённую ссылку."""
    try:
        menu_item = MenuItem.objects.get(id=menu_item_id)
    except MenuItem.DoesNotExist:
        return f'MenuItem {menu_item_id} не найден'

    if not menu_item.image_url:
        return f'У блюда {menu_item_id} нет изображения'

    optimized_url = menu_item.image_url.replace(
        '/upload/',
        '/upload/f_auto,q_auto,w_800,h_600,c_fill/',
    )

    if optimized_url != menu_item.image_url:
        menu_item.image_url = optimized_url
        menu_item.save(update_fields=['image_url', 'updated_at'])

    cache.delete(f'menu:{menu_item.restaurant_id}')

    return f'Изображение блюда {menu_item_id} оптимизировано, кэш меню сброшен'