from django.urls import path

from .views import (
    ActiveSessionListView,
    CloseSessionView,
    DeliveryOrderListView,
    GuestCancelItemView,
    PlaceDeliveryOrderView,
    PlaceOrderView,
    RejectPaymentView,
    RequestPaymentView,
    SessionByTableView,
    SessionDeliveryStatusUpdateView,
    SessionItemUpdateView,
    SessionStatusUpdateView,
    StaffAddItemsView,
    StaffPlaceOrderView,
)

urlpatterns = [
    # D-3: Guest — place order
    path('sessions/', PlaceOrderView.as_view(), name='session-place-order'),

    # Guest — place delivery / pickup order
    path('delivery-orders/', PlaceDeliveryOrderView.as_view(), name='delivery-place-order'),

    # D-4: Guest — get active session / request payment
    path('sessions/by-table/<str:table_token>/', SessionByTableView.as_view(), name='session-by-table'),
    path('sessions/by-table/<str:table_token>/request-payment/', RequestPaymentView.as_view(), name='session-request-payment'),
    # Guest — cancel own not-yet-confirmed item (order-confirmation flow)
    path('sessions/by-table/<str:table_token>/items/<uuid:item_id>/cancel/', GuestCancelItemView.as_view(), name='guest-cancel-item'),

    # D-8: Staff — active sessions + item status update
    path('restaurants/<uuid:rest_id>/sessions/active/', ActiveSessionListView.as_view(), name='session-active-list'),
    path('restaurants/<uuid:rest_id>/sessions/place-order/', StaffPlaceOrderView.as_view(), name='session-staff-place-order'),
    path('restaurants/<uuid:rest_id>/sessions/<uuid:session_id>/items/<uuid:item_id>/', SessionItemUpdateView.as_view(), name='session-item-update'),

    # Staff — delivery / pickup orders
    path('restaurants/<uuid:rest_id>/delivery-orders/', DeliveryOrderListView.as_view(), name='delivery-order-list'),
    path('restaurants/<uuid:rest_id>/sessions/<uuid:session_id>/delivery-status/', SessionDeliveryStatusUpdateView.as_view(), name='session-delivery-status-update'),

    # Staff — update session status (payment_requested, etc.)
    path('restaurants/<uuid:rest_id>/sessions/<uuid:session_id>/', SessionStatusUpdateView.as_view(), name='session-status-update'),

    # D-11: Staff — close session / reject payment
    path('restaurants/<uuid:rest_id>/sessions/<uuid:session_id>/close/', CloseSessionView.as_view(), name='session-close'),
    path('restaurants/<uuid:rest_id>/sessions/<uuid:session_id>/reject-payment/', RejectPaymentView.as_view(), name='session-reject-payment'),

    # Staff — add items to existing session
    path('restaurants/<uuid:rest_id>/sessions/<uuid:session_id>/items/', StaffAddItemsView.as_view(), name='session-staff-add-items'),
]
