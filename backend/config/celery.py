import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

app = Celery('plait')

app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'cleanup-old-sessions': {
        'task': 'apps.sessions.tasks.cleanup_old_sessions',
        'schedule': crontab(hour=3, minute=0),  # каждый день в 3:00
    },
    'sync-iiko-menu': {
        'task': 'apps.integrations.tasks.sync_iiko_menu',
        'schedule': crontab(minute=0),  # каждый час импорт меню из iiko Cloud API
    },
}