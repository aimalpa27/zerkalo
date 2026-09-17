from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import TableSession


@shared_task
def cleanup_old_sessions():
    """Удаляет закрытые столовые сессии старше 90 дней."""
    cutoff = timezone.now() - timedelta(days=90)
    deleted_count, _ = TableSession.objects.filter(
        status='closed',
        closed_at__lt=cutoff,
    ).delete()
    return f'Удалено старых сессий: {deleted_count}'