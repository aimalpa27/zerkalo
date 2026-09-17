from rest_framework import generics

from apps.restaurants.models import Restaurant
from .models import SubscriptionPlan
from .permissions import IsSuperAdmin
from .serializers import SubscriptionPlanSerializer, SuperAdminRestaurantSerializer


class SubscriptionPlanListCreateView(generics.ListCreateAPIView):
    """GET — список тарифов, POST — создать новый тариф."""
    permission_classes = [IsSuperAdmin]
    serializer_class = SubscriptionPlanSerializer
    queryset = SubscriptionPlan.objects.all()


class SubscriptionPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = SubscriptionPlanSerializer
    queryset = SubscriptionPlan.objects.all()


class SuperAdminRestaurantListView(generics.ListCreateAPIView):
    """GET — полный список ресторанов (включая непубличные), POST — подключить новый ресторан."""
    permission_classes = [IsSuperAdmin]
    serializer_class = SuperAdminRestaurantSerializer
    queryset = Restaurant.objects.select_related('subscription_plan').order_by('name')


class SuperAdminRestaurantDetailView(generics.RetrieveUpdateAPIView):
    """Просмотр/назначение тарифа и статуса подписки конкретного ресторана."""
    permission_classes = [IsSuperAdmin]
    serializer_class = SuperAdminRestaurantSerializer
    queryset = Restaurant.objects.select_related('subscription_plan')
    lookup_url_kwarg = 'rest_id'
    lookup_field = 'pk'