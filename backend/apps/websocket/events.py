from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _send(group: str, event_type: str, data: dict) -> None:
    """Send a group message. No-op if channel layer is not configured."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        group,
        {'type': event_type, 'data': data},
    )


def notify_staff(rest_id, event_type: str, data: dict) -> None:
    _send(f'staff_{rest_id}', event_type, data)


def notify_guest(table_token: str, event_type: str, data: dict) -> None:
    _send(f'guest_{table_token}', event_type, data)


def notify_session_status(session, status: str | None = None) -> None:
    """Broadcast a table-session status change to both sides of the workflow.

    Guest needs it to update checkout/order state immediately. Staff (admin,
    waiter, kitchen) needs the same event so a payment request, rejection or
    close disappears/changes on operational screens without waiting for polling.
    """
    new_status = status or session.status
    data = {
        'session_id': str(session.id),
        'status': new_status,
        'table_number': session.table_number,
        'table_id': str(session.table_id) if session.table_id else None,
        'table_token': session.table_token,
    }
    notify_staff(str(session.restaurant_id), 'session_status_changed', data)
    if session.table_token:
        notify_guest(session.table_token, 'session_status_changed', data)
