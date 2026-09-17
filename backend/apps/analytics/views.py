import datetime

from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F, Sum
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.restaurants.models import Restaurant
from apps.sessions.models import SessionItem, TableSession
from apps.sessions.serializers import TableSessionSerializer
from apps.users.permissions import IsRestaurantAdmin


def _parse_date(value: str | None, param_name: str):
    """
    FIX: date params were passed directly to the ORM without validation.
    Django raises ValueError for invalid dates, which becomes an unhandled
    500 error instead of a proper 400.  This helper validates the format and
    returns a date object or raises a 400 Response via ValidationError.
    """
    if not value:
        return None
    try:
        return datetime.date.fromisoformat(value)  # expects YYYY-MM-DD
    except ValueError:
        from rest_framework.exceptions import ValidationError
        raise ValidationError(
            {param_name: f'Неверный формат даты "{value}". Ожидается YYYY-MM-DD.'}
        )


def _check_analytics_access(rest_id):
    restaurant = get_object_or_404(Restaurant, id=rest_id)
    if not restaurant.has_feature('analytics'):
        raise PermissionDenied('Аналитика недоступна на текущем тарифе.')


class AnalyticsSummaryView(APIView):
    """D-9: Revenue summary + top-10 dishes for a given date range."""
    permission_classes = [IsRestaurantAdmin]

    def get(self, request, rest_id):
        _check_analytics_access(rest_id)

        # FIX: validate date query-params before passing to ORM
        from_date = _parse_date(request.query_params.get('from'), 'from')
        to_date = _parse_date(request.query_params.get('to'), 'to')

        sessions = TableSession.objects.filter(
            restaurant_id=rest_id,
            status='closed',
        )
        if from_date:
            sessions = sessions.filter(closed_at__date__gte=from_date)
        if to_date:
            sessions = sessions.filter(closed_at__date__lte=to_date)

        agg = sessions.aggregate(
            revenue=Sum('total_amount'),
            sessions_count=Count('id'),
            avg_check=Avg('total_amount'),
        )

        top_items = list(
            SessionItem.objects
            .filter(session__in=sessions)
            .exclude(status__in=['cancelled', 'rejected', 'awaiting_confirmation'])
            .values('item_name')
            .annotate(
                total_qty=Sum('quantity'),
                total_revenue=Sum(
                    ExpressionWrapper(
                        F('price') * F('quantity'),
                        output_field=DecimalField(max_digits=14, decimal_places=2),
                    )
                ),
            )
            .order_by('-total_qty')[:10]
        )

        return Response({
            'revenue': agg['revenue'] or 0,
            'sessions_count': agg['sessions_count'] or 0,
            'avg_check': round(agg['avg_check'] or 0, 2),
            'top_items': top_items,
        })


class AnalyticsSessionsView(generics.ListAPIView):
    """D-9: Closed sessions history with date filter and pagination."""
    permission_classes = [IsRestaurantAdmin]
    serializer_class = TableSessionSerializer

    def get_queryset(self):
        _check_analytics_access(self.kwargs['rest_id'])

        # FIX: same date validation as SummaryView
        from_date = _parse_date(self.request.query_params.get('from'), 'from')
        to_date = _parse_date(self.request.query_params.get('to'), 'to')

        qs = (
            TableSession.objects
            .filter(restaurant_id=self.kwargs['rest_id'], status='closed')
            .prefetch_related('items')
            .order_by('-closed_at')
        )
        if from_date:
            qs = qs.filter(closed_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(closed_at__date__lte=to_date)

        # FIX: this view is unpaginated (pagination is disabled globally so
        # the frontend can rely on plain array responses). Without a cap, a
        # restaurant with years of history could return tens of thousands of
        # rows (each with prefetched items) in a single request — a heavy,
        # slow, easily-triggered response. Cap to the 500 most recent
        # closed sessions, same pattern as DeliveryOrderListView's [:200].
        return qs[:500]