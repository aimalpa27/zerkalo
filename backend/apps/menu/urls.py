from django.urls import path

from .views import (
    CategoryListView,
    MenuItemListView,
    MenuItemToggleAvailabilityView,
    CategoryDetailView,
    MenuItemDetailView,
    MenuItemImageUploadView,
    MenuItemMediaUploadView,
    MenuImportView,
    UpsellRuleListView, UpsellRuleDetailView, NetworkMenuTemplateListView, NetworkMenuTemplateDetailView, NetworkMenuBranchOverrideView, NetworkMenuPublishView,
)


urlpatterns = [
    path('restaurants/networks/<uuid:network_id>/menu-template/', NetworkMenuTemplateListView.as_view()),
    path('restaurants/networks/<uuid:network_id>/menu-template/publish/', NetworkMenuPublishView.as_view()),
    path('restaurants/networks/<uuid:network_id>/menu-template/<uuid:item_id>/', NetworkMenuTemplateDetailView.as_view()),
    path('restaurants/networks/<uuid:network_id>/branches/<uuid:restaurant_id>/menu-overrides/', NetworkMenuBranchOverrideView.as_view()),
    path('restaurants/networks/<uuid:network_id>/branches/<uuid:restaurant_id>/menu-overrides/<uuid:item_id>/', NetworkMenuBranchOverrideView.as_view()),
    path('restaurants/<uuid:rest_id>/upsell-rules/', UpsellRuleListView.as_view(), name='upsell-rule-list'),
    path('restaurants/<uuid:rest_id>/upsell-rules/<uuid:rule_id>/', UpsellRuleDetailView.as_view(), name='upsell-rule-detail'),
    path('restaurants/<uuid:rest_id>/menu/import/', MenuImportView.as_view(), name='menu-import'),
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