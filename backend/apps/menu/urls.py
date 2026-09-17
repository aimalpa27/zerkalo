from django.urls import path

from .views import (
    CategoryListView,
    MenuItemListView,
    MenuItemToggleAvailabilityView,
    CategoryDetailView,
    MenuItemDetailView,
    MenuItemImageUploadView,
    MenuItemMediaUploadView,
)


urlpatterns = [
    path(
        'restaurants/<uuid:rest_id>/categories/',
        CategoryListView.as_view(),
        name='category-list',
    ),
    path(
        'restaurants/<uuid:rest_id>/menu/',
        MenuItemListView.as_view(),
        name='menu-list',
    ),
    path(
    'restaurants/<uuid:rest_id>/menu/<uuid:item_id>/toggle-availability/',
    MenuItemToggleAvailabilityView.as_view(),
    name='menu-item-toggle-availability',
    ),
    path(
    'restaurants/<uuid:rest_id>/categories/<uuid:category_id>/',
    CategoryDetailView.as_view(),
    name='category-detail',
    ),
    path(
    'restaurants/<uuid:rest_id>/menu/<uuid:item_id>/',
    MenuItemDetailView.as_view(),
    name='menu-item-detail',
    ),
    path(
    'restaurants/<uuid:rest_id>/menu/<uuid:item_id>/upload-image/',
    MenuItemImageUploadView.as_view(),
    name='menu-item-upload-image',
    ),
    path(
    'restaurants/<uuid:rest_id>/menu/<uuid:item_id>/upload-media/',
    MenuItemMediaUploadView.as_view(),
    name='menu-item-upload-media',
    ),
]