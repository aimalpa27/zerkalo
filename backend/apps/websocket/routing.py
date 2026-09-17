from django.urls import re_path

from .consumers import GuestConsumer, StaffConsumer

websocket_urlpatterns = [
    re_path(r'^ws/staff/(?P<rest_id>[0-9a-f-]+)/$', StaffConsumer.as_asgi()),
    re_path(r'^ws/guest/(?P<table_token>[\w-]+)/$', GuestConsumer.as_asgi()),
]
