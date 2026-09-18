import datetime

from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.restaurants.models import Restaurant
from apps.sessions.models import SessionItem, TableSession, SLAIncident, OperationalExceptionState, ServiceRecoveryNote
from apps.tables.models import Table
from apps.schedule.models import Shift
from apps.sessions.serializers import TableSessionSerializer
from .models import UpsellEvent
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
        restaurant = get_object_or_404(Restaurant, id=rest_id)

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

        # Owner Dashboard v2 — all KPIs are derived from authoritative closed bills.
        # Comparison is available only for an explicit complete date range. The
        # previous window has the same inclusive number of calendar days.
        comparison = None
        if from_date and to_date and from_date <= to_date:
            days = (to_date - from_date).days + 1
            previous_to = from_date - datetime.timedelta(days=1)
            previous_from = previous_to - datetime.timedelta(days=days - 1)
            previous = TableSession.objects.filter(
                restaurant_id=rest_id, status='closed',
                closed_at__date__gte=previous_from, closed_at__date__lte=previous_to,
            ).aggregate(revenue=Sum('total_amount'), sessions_count=Count('id'), avg_check=Avg('total_amount'))

            def pct(current, old):
                current = float(current or 0); old = float(old or 0)
                if old == 0:
                    return None if current else 0.0
                return round((current - old) / old * 100, 1)

            comparison = {
                'from': previous_from.isoformat(), 'to': previous_to.isoformat(),
                'revenue': previous['revenue'] or 0,
                'sessions_count': previous['sessions_count'] or 0,
                'avg_check': round(previous['avg_check'] or 0, 2),
                'revenue_change_pct': pct(agg['revenue'], previous['revenue']),
                'sessions_change_pct': pct(agg['sessions_count'], previous['sessions_count']),
                'avg_check_change_pct': pct(agg['avg_check'], previous['avg_check']),
            }

        # Operational KPIs. We intentionally use closed dine-in sessions only:
        # delivery/pickup must not inflate table utilization.
        dine_in = sessions.filter(order_type='dine_in').exclude(closed_at=None)
        active_tables = Table.objects.filter(restaurant_id=rest_id, is_active=True).count()
        occupied_seconds = 0.0
        by_hour = {}
        by_weekday = {}
        duration_total = 0.0
        duration_count = 0
        for row in dine_in.only('created_at', 'closed_at', 'total_amount').iterator():
            if not row.closed_at:
                continue
            duration = max((row.closed_at - row.created_at).total_seconds(), 0)
            occupied_seconds += duration
            duration_total += duration
            duration_count += 1
            local_closed = timezone.localtime(row.closed_at)
            hour = local_closed.hour
            weekday = local_closed.weekday()  # Monday=0
            h = by_hour.setdefault(hour, {'sessions': 0, 'revenue': 0.0})
            h['sessions'] += 1; h['revenue'] += float(row.total_amount or 0)
            d = by_weekday.setdefault(weekday, {'sessions': 0, 'revenue': 0.0})
            d['sessions'] += 1; d['revenue'] += float(row.total_amount or 0)

        utilization = None
        if active_tables and from_date and to_date and from_date <= to_date:
            capacity_seconds = active_tables * ((to_date - from_date).days + 1) * 86400
            utilization = round(min(occupied_seconds / capacity_seconds * 100, 100), 1) if capacity_seconds else 0.0
        best_hour = max(by_hour.items(), key=lambda x: (x[1]['revenue'], x[1]['sessions']), default=None)
        best_day = max(by_weekday.items(), key=lambda x: (x[1]['revenue'], x[1]['sessions']), default=None)
        weekday_names = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']
        operations = {
            'active_tables': active_tables,
            'table_utilization_pct': utilization,
            'avg_session_minutes': round(duration_total / duration_count / 60, 1) if duration_count else 0,
            'best_hour': ({'hour': best_hour[0], **best_hour[1]} if best_hour else None),
            'best_day': ({'weekday': best_day[0], 'label': weekday_names[best_day[0]], **best_day[1]} if best_day else None),
        }

        # Kitchen SLA analytics — measured from authoritative item lifecycle timestamps.
        # Missing/out-of-order timestamps are excluded instead of fabricating zero durations.
        sla_thresholds = {
            'kitchen': float(restaurant.kitchen_sla_minutes),
            'bar': float(restaurant.bar_sla_minutes),
        }
        handoff_threshold = float(restaurant.ready_to_served_sla_minutes)
        sla_rows = SessionItem.objects.filter(
            session__in=sessions,
            confirmed_at__isnull=False,
        ).exclude(status__in=['cancelled', 'rejected', 'awaiting_confirmation']).only(
            'preparation_station', 'confirmed_at', 'ready_at', 'served_at'
        )
        station_data = {}
        overload_hours = {}
        all_prep = []
        all_handoff = []
        late_total = 0
        measured_total = 0
        handoff_late_total = 0
        handoff_measured_total = 0
        for item in sla_rows.iterator():
            station = item.preparation_station or 'kitchen'
            bucket = station_data.setdefault(station, {'prep': [], 'handoff': [], 'late': 0, 'measured': 0})
            if item.ready_at and item.ready_at >= item.confirmed_at:
                prep = (item.ready_at - item.confirmed_at).total_seconds() / 60
                bucket['prep'].append(prep); all_prep.append(prep)
                bucket['measured'] += 1; measured_total += 1
                threshold = sla_thresholds.get(station, 20.0)
                if prep > threshold:
                    bucket['late'] += 1; late_total += 1
                    hour = timezone.localtime(item.confirmed_at).hour
                    overload_hours[hour] = overload_hours.get(hour, 0) + 1
            if item.ready_at and item.served_at and item.served_at >= item.ready_at:
                handoff = (item.served_at - item.ready_at).total_seconds() / 60
                bucket['handoff'].append(handoff); all_handoff.append(handoff)
                handoff_measured_total += 1
                if handoff > handoff_threshold:
                    handoff_late_total += 1

        def _avg(values):
            return round(sum(values) / len(values), 1) if values else 0.0

        def _p95(values):
            if not values:
                return 0.0
            ordered = sorted(values)
            index = max(0, min(len(ordered) - 1, int((len(ordered) * 0.95 + 0.999999)) - 1))
            return round(ordered[index], 1)

        stations = []
        for station, data in sorted(station_data.items()):
            stations.append({
                'station': station,
                'avg_prep_minutes': _avg(data['prep']),
                'p95_prep_minutes': _p95(data['prep']),
                'avg_ready_to_served_minutes': _avg(data['handoff']),
                'measured_items': data['measured'],
                'late_items': data['late'],
                'sla_met_pct': round((data['measured'] - data['late']) / data['measured'] * 100, 1) if data['measured'] else None,
                'target_minutes': sla_thresholds.get(station, 20.0),
            })
        worst_hour = max(overload_hours.items(), key=lambda row: row[1], default=None)
        kitchen_sla = {
            'avg_prep_minutes': _avg(all_prep),
            'p95_prep_minutes': _p95(all_prep),
            'avg_ready_to_served_minutes': _avg(all_handoff),
            'ready_to_served_target_minutes': handoff_threshold,
            'handoff_measured_items': handoff_measured_total,
            'handoff_late_items': handoff_late_total,
            'handoff_sla_met_pct': round((handoff_measured_total - handoff_late_total) / handoff_measured_total * 100, 1) if handoff_measured_total else None,
            'measured_items': measured_total,
            'late_items': late_total,
            'sla_met_pct': round((measured_total - late_total) / measured_total * 100, 1) if measured_total else None,
            'overload_hour': ({'hour': worst_hour[0], 'late_items': worst_hour[1]} if worst_hour else None),
            'stations': stations,
        }

        # Staff efficiency — operational team metrics, not a punitive leaderboard.
        # Attribution is captured server-side when a waiter confirms/serves an item.
        # Historical rows without actor attribution remain excluded rather than guessed.
        staff_rows = SessionItem.objects.filter(session__in=sessions).exclude(
            status__in=['cancelled', 'rejected', 'awaiting_confirmation']
        ).select_related('confirmed_by', 'served_by').only(
            'created_at', 'confirmed_at', 'ready_at', 'served_at',
            'confirmed_by_id', 'confirmed_by__name', 'served_by_id', 'served_by__name'
        )
        response_minutes = []
        serve_minutes = []
        waiter_buckets = {}
        for item in staff_rows.iterator():
            if item.confirmed_by_id and item.confirmed_at and item.confirmed_at >= item.created_at:
                value = (item.confirmed_at - item.created_at).total_seconds() / 60
                response_minutes.append(value)
                bucket = waiter_buckets.setdefault(str(item.confirmed_by_id), {'name': item.confirmed_by.name, 'response': [], 'serve': [], 'actions': 0})
                bucket['response'].append(value); bucket['actions'] += 1
            if item.served_by_id and item.ready_at and item.served_at and item.served_at >= item.ready_at:
                value = (item.served_at - item.ready_at).total_seconds() / 60
                serve_minutes.append(value)
                bucket = waiter_buckets.setdefault(str(item.served_by_id), {'name': item.served_by.name, 'response': [], 'serve': [], 'actions': 0})
                bucket['serve'].append(value); bucket['actions'] += 1

        # Per-person rows require >=3 attributed actions to avoid presenting noise as performance.
        waiter_rows = []
        for user_id, data in waiter_buckets.items():
            if data['actions'] < 3:
                continue
            waiter_rows.append({
                'user_id': user_id, 'name': data['name'], 'actions': data['actions'],
                'avg_response_minutes': _avg(data['response']) if data['response'] else None,
                'avg_ready_to_served_minutes': _avg(data['serve']) if data['serve'] else None,
            })
        waiter_rows.sort(key=lambda row: (-row['actions'], row['name']))
        staff_efficiency = {
            'avg_response_minutes': _avg(response_minutes),
            'p95_response_minutes': _p95(response_minutes),
            'avg_ready_to_served_minutes': _avg(serve_minutes),
            'p95_ready_to_served_minutes': _p95(serve_minutes),
            'response_samples': len(response_minutes), 'serve_samples': len(serve_minutes),
            'waiters': waiter_rows[:20],
        }

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

        upsell_events = UpsellEvent.objects.filter(restaurant_id=rest_id)
        if from_date:
            upsell_events = upsell_events.filter(created_at__date__gte=from_date)
        if to_date:
            upsell_events = upsell_events.filter(created_at__date__lte=to_date)
        funnel = {row['event_type']: row for row in upsell_events.values('event_type').annotate(count=Count('id'), revenue=Sum('revenue'))}
        impressions = funnel.get('impression', {}).get('count', 0) or 0
        adds = funnel.get('add', {}).get('count', 0) or 0
        conversions = funnel.get('conversion', {}).get('count', 0) or 0
        upsell_revenue = funnel.get('conversion', {}).get('revenue', 0) or 0
        top_rules = list(upsell_events.filter(event_type='conversion').values('rule_id', 'rule__trigger_item__name', 'rule__recommended_item__name').annotate(conversions=Count('id'), revenue=Sum('revenue')).order_by('-revenue')[:5])

        # Durable SLA incident trends. Incidents are tenant-scoped and represent
        # actual breaches only (warnings are intentionally not counted as failures).
        incidents = SLAIncident.objects.filter(restaurant_id=rest_id)
        if from_date:
            incidents = incidents.filter(breached_at__date__gte=from_date)
        if to_date:
            incidents = incidents.filter(breached_at__date__lte=to_date)
        incident_rows = list(incidents.only('kind', 'station', 'breached_at', 'resolved_at'))
        by_day_incidents = {}
        by_hour_incidents = {}
        by_station_incidents = {}
        resolved_count = 0
        resolution_minutes = []
        for incident in incident_rows:
            local_breach = timezone.localtime(incident.breached_at)
            day = local_breach.date().isoformat()
            hour = local_breach.hour
            by_day_incidents[day] = by_day_incidents.get(day, 0) + 1
            by_hour_incidents[hour] = by_hour_incidents.get(hour, 0) + 1
            station = 'handoff' if incident.kind == 'handoff' else (incident.station or 'kitchen')
            by_station_incidents[station] = by_station_incidents.get(station, 0) + 1
            if incident.resolved_at and incident.resolved_at >= incident.breached_at:
                resolved_count += 1
                resolution_minutes.append((incident.resolved_at - incident.breached_at).total_seconds() / 60)

        previous_incident_count = None
        incident_change_pct = None
        if from_date and to_date and from_date <= to_date:
            days = (to_date - from_date).days + 1
            prev_to = from_date - datetime.timedelta(days=1)
            prev_from = prev_to - datetime.timedelta(days=days - 1)
            previous_incident_count = SLAIncident.objects.filter(
                restaurant_id=rest_id, breached_at__date__gte=prev_from, breached_at__date__lte=prev_to
            ).count()
            current_count = len(incident_rows)
            if previous_incident_count == 0:
                incident_change_pct = None if current_count else 0.0
            else:
                incident_change_pct = round((current_count - previous_incident_count) / previous_incident_count * 100, 1)

        peak_incident_hour = max(by_hour_incidents.items(), key=lambda row: row[1], default=None)
        sla_incident_trends = {
            'breaches': len(incident_rows),
            'resolved': resolved_count,
            'active': len(incident_rows) - resolved_count,
            'resolution_rate_pct': round(resolved_count / len(incident_rows) * 100, 1) if incident_rows else None,
            'avg_resolution_minutes': _avg(resolution_minutes),
            'previous_breaches': previous_incident_count,
            'breach_change_pct': incident_change_pct,
            'peak_hour': ({'hour': peak_incident_hour[0], 'breaches': peak_incident_hour[1]} if peak_incident_hour else None),
            'by_day': [{'date': key, 'breaches': value} for key, value in sorted(by_day_incidents.items())],
            'by_station': [{'station': key, 'breaches': value} for key, value in sorted(by_station_incidents.items(), key=lambda row: (-row[1], row[0]))],
        }

        # Shift/zone operational analytics. A "shift window" is a unique scheduled
        # date + start/end interval, not a staff leaderboard. Overlapping staff on
        # the same interval are collapsed so restaurant revenue/SLA is never double-counted.
        shift_qs = Shift.objects.filter(restaurant_id=rest_id).select_related('staff')
        if from_date:
            shift_qs = shift_qs.filter(date__gte=from_date - datetime.timedelta(days=1))
        if to_date:
            shift_qs = shift_qs.filter(date__lte=to_date)
        shift_groups = {}
        for shift in shift_qs.order_by('date', 'start_time', 'end_time').iterator():
            key = (shift.date, shift.start_time, shift.end_time)
            group = shift_groups.setdefault(key, {'staff': set()})
            group['staff'].add(str(shift.staff_id))

        closed_rows = list(sessions.select_related('table__zone').only(
            'closed_at', 'total_amount', 'table__zone_id', 'table__zone__name'
        ))
        incident_zone_rows = list(incidents.select_related('item__session__table__zone').only(
            'breached_at', 'item__session__table__zone_id', 'item__session__table__zone__name'
        ))

        def _in_shift(local_dt, shift_date, start, end):
            # Same-day interval: [start,end). Overnight interval belongs to the
            # shift's start date and continues into the following calendar day.
            t = local_dt.time().replace(tzinfo=None)
            d = local_dt.date()
            if start < end:
                return d == shift_date and start <= t < end
            return (d == shift_date and t >= start) or (d == shift_date + datetime.timedelta(days=1) and t < end)

        shift_windows = []
        for (shift_date, start, end), group in shift_groups.items():
            matched_sessions = [row for row in closed_rows if row.closed_at and _in_shift(timezone.localtime(row.closed_at), shift_date, start, end)]
            matched_incidents = [row for row in incident_zone_rows if _in_shift(timezone.localtime(row.breached_at), shift_date, start, end)]
            shift_windows.append({
                'date': shift_date.isoformat(),
                'start': start.strftime('%H:%M'),
                'end': end.strftime('%H:%M'),
                'staff_count': len(group['staff']),
                'sessions': len(matched_sessions),
                'revenue': round(sum(float(row.total_amount or 0) for row in matched_sessions), 2),
                'sla_breaches': len(matched_incidents),
            })
        shift_windows.sort(key=lambda row: (row['date'], row['start']), reverse=True)

        zone_buckets = {}
        for row in closed_rows:
            zone_id = str(row.table.zone_id) if row.table_id and row.table and row.table.zone_id else 'unassigned'
            zone_name = row.table.zone.name if row.table_id and row.table and row.table.zone_id else 'Без зоны'
            bucket = zone_buckets.setdefault(zone_id, {'zone_id': zone_id, 'name': zone_name, 'sessions': 0, 'revenue': 0.0, 'sla_breaches': 0})
            bucket['sessions'] += 1
            bucket['revenue'] += float(row.total_amount or 0)
        for row in incident_zone_rows:
            table = row.item.session.table
            zone_id = str(table.zone_id) if table and table.zone_id else 'unassigned'
            zone_name = table.zone.name if table and table.zone_id else 'Без зоны'
            bucket = zone_buckets.setdefault(zone_id, {'zone_id': zone_id, 'name': zone_name, 'sessions': 0, 'revenue': 0.0, 'sla_breaches': 0})
            bucket['sla_breaches'] += 1
        zones = []
        for bucket in zone_buckets.values():
            bucket['revenue'] = round(bucket['revenue'], 2)
            bucket['avg_check'] = round(bucket['revenue'] / bucket['sessions'], 2) if bucket['sessions'] else 0.0
            zones.append(bucket)
        zones.sort(key=lambda row: (-row['revenue'], row['name']))
        shift_zone_operations = {'shifts': shift_windows[:30], 'zones': zones}

        # Deterministic manager daily digest. This intentionally uses today's local
        # operational data regardless of the analytics date picker so a manager can
        # always open Analytics and immediately understand the current day. No AI is
        # involved: every sentence/KPI is derived from authoritative DB state.
        today = timezone.localdate()
        today_sessions = TableSession.objects.filter(
            restaurant_id=rest_id, status='closed', closed_at__date=today,
        )
        today_agg = today_sessions.aggregate(
            revenue=Sum('total_amount'), sessions_count=Count('id'), avg_check=Avg('total_amount'),
        )
        active_incidents_qs = SLAIncident.objects.filter(restaurant_id=rest_id, resolved_at__isnull=True)
        active_incidents = active_incidents_qs.count()
        today_breaches = SLAIncident.objects.filter(restaurant_id=rest_id, breached_at__date=today).count()

        today_shifts = Shift.objects.filter(restaurant_id=rest_id, date=today).select_related('staff')
        scheduled_staff_ids = set()
        current_staff_ids = set()
        now_local = timezone.localtime(timezone.now())
        for shift in today_shifts.iterator():
            scheduled_staff_ids.add(str(shift.staff_id))
            # Overnight shifts are considered active after start on their start date;
            # yesterday's overnight coverage is handled separately below.
            if shift.start_time <= shift.end_time:
                active_now = shift.start_time <= now_local.time().replace(tzinfo=None) < shift.end_time
            else:
                active_now = now_local.time().replace(tzinfo=None) >= shift.start_time
            if active_now:
                current_staff_ids.add(str(shift.staff_id))
        yesterday_overnight = Shift.objects.filter(
            restaurant_id=rest_id, date=today - datetime.timedelta(days=1), start_time__gt=F('end_time')
        ).select_related('staff')
        for shift in yesterday_overnight.iterator():
            if now_local.time().replace(tzinfo=None) < shift.end_time:
                current_staff_ids.add(str(shift.staff_id))

        # Today's problem zone is based on actual breached incidents, not warnings.
        today_zone_breaches = {}
        incident_rows = SLAIncident.objects.filter(
            restaurant_id=rest_id, breached_at__date=today
        ).select_related('item__session__table__zone')
        for incident in incident_rows.iterator():
            table = incident.item.session.table if incident.item_id else None
            zone = getattr(table, 'zone', None) if table else None
            key = str(zone.id) if zone else 'unassigned'
            name = zone.name if zone else 'Без зоны'
            bucket = today_zone_breaches.setdefault(key, {'zone_id': key, 'name': name, 'breaches': 0})
            bucket['breaches'] += 1
        problem_zone = max(today_zone_breaches.values(), key=lambda row: row['breaches'], default=None)

        # Compact action flags are ordered by operational urgency for the manager UI.
        attention = []
        if active_incidents:
            first_active = SLAIncident.objects.filter(restaurant_id=rest_id, resolved_at__isnull=True).select_related('item__session').order_by('breached_at').first()
            attention.append({
                'severity': 'critical', 'code': 'active_sla',
                'text': f'Активных SLA-просрочек: {active_incidents}',
                'action': {'kind': 'session', 'session_id': str(first_active.item.session_id)} if first_active else {'kind': 'sla_log'},
            })
        if problem_zone:
            attention.append({'severity': 'warning', 'code': 'problem_zone', 'text': f"Больше всего SLA-просрочек: {problem_zone['name']} ({problem_zone['breaches']})", 'action': {'kind': 'zone', 'zone_id': problem_zone['zone_id']}})
        if not current_staff_ids and today_shifts.exists():
            attention.append({'severity': 'warning', 'code': 'no_current_shift', 'text': 'По графику сейчас нет активной смены', 'action': {'kind': 'schedule'}})
        if not attention:
            attention.append({'severity': 'ok', 'code': 'stable', 'text': 'Критичных операционных отклонений не зафиксировано', 'action': None})

        exception_states = OperationalExceptionState.objects.filter(restaurant_id=rest_id)
        if from_date:
            exception_states = exception_states.filter(first_seen_at__date__gte=from_date)
        if to_date:
            exception_states = exception_states.filter(first_seen_at__date__lte=to_date)
        response_samples, resolution_samples = [], []
        for exc in exception_states.iterator():
            if exc.acknowledged_at:
                response_samples.append(max(0, (exc.acknowledged_at-exc.first_seen_at).total_seconds()/60))
            if exc.resolved_at:
                resolution_samples.append(max(0, (exc.resolved_at-exc.first_seen_at).total_seconds()/60))
        operations_exception_kpi = {
            'total': exception_states.count(),
            'acknowledged': exception_states.filter(acknowledged_at__isnull=False).count(),
            'resolved': exception_states.filter(resolved_at__isnull=False).count(),
            'avg_response_minutes': round(sum(response_samples)/len(response_samples), 1) if response_samples else None,
            'avg_resolution_minutes': round(sum(resolution_samples)/len(resolution_samples), 1) if resolution_samples else None,
        }

        daily_digest = {
            'date': today.isoformat(),
            'revenue': today_agg['revenue'] or 0,
            'sessions_count': today_agg['sessions_count'] or 0,
            'avg_check': round(today_agg['avg_check'] or 0, 2),
            'sla_breaches': today_breaches,
            'active_incidents': active_incidents,
            'scheduled_staff': len(scheduled_staff_ids),
            'staff_on_shift_now': len(current_staff_ids),
            'problem_zone': problem_zone,
            'attention': attention,
        }

        recovery_qs = ServiceRecoveryNote.objects.filter(restaurant_id=rest_id, created_at__gte=start, created_at__lte=end)
        recovery_total = recovery_qs.count()
        recovery_cost = recovery_qs.aggregate(v=Sum('compensation_amount'))['v'] or 0
        recovery_reasons = list(recovery_qs.values('reason').annotate(count=Count('id'), cost=Sum('compensation_amount')).order_by('-count', '-cost'))

        # Service recovery analytics: compare the exact selected calendar window and
        # expose a small tenant-safe drill-down. This is factual ledger data only.
        previous_total = previous_cost = None
        total_change_pct = cost_change_pct = None
        if from_date and to_date and from_date <= to_date:
            recovery_days = (to_date - from_date).days + 1
            recovery_previous_to = from_date - datetime.timedelta(days=1)
            recovery_previous_from = recovery_previous_to - datetime.timedelta(days=recovery_days - 1)
            previous_recovery_qs = ServiceRecoveryNote.objects.filter(
                restaurant_id=rest_id,
                created_at__date__gte=recovery_previous_from,
                created_at__date__lte=recovery_previous_to,
            )
            previous_total = previous_recovery_qs.count()
            previous_cost = previous_recovery_qs.aggregate(v=Sum('compensation_amount'))['v'] or 0

            def recovery_pct(current, old):
                current = float(current or 0); old = float(old or 0)
                if old == 0:
                    return None if current else 0.0
                return round((current - old) / old * 100, 1)

            total_change_pct = recovery_pct(recovery_total, previous_total)
            cost_change_pct = recovery_pct(recovery_cost, previous_cost)

        recent_recoveries = [{
            'id': str(note.id),
            'session_id': str(note.session_id),
            'table_number': note.session.table_number,
            'reason': note.reason,
            'note': note.note,
            'compensation_type': note.compensation_type,
            'compensation_amount': note.compensation_amount,
            'created_at': note.created_at,
        } for note in recovery_qs.select_related('session').order_by('-created_at')[:8]]

        # Action tracking: serious operational problems are authoritative SLA
        # breaches + persisted exception lifecycles in the selected period. A
        # problem is covered only by an explicitly linked recovery note.
        serious_sla = SLAIncident.objects.filter(restaurant_id=rest_id, breached_at__gte=start, breached_at__lte=end).count()
        serious_exceptions = OperationalExceptionState.objects.filter(restaurant_id=rest_id, first_seen_at__gte=start, first_seen_at__lte=end).count()
        serious_total = serious_sla + serious_exceptions
        linked_sla = recovery_qs.exclude(source_sla_incident_id=None).values('source_sla_incident_id').distinct().count()
        linked_exceptions = recovery_qs.exclude(source_exception_id=None).values('source_exception_id').distinct().count()
        linked_total = linked_sla + linked_exceptions
        recovery_coverage_pct = round(linked_total / serious_total * 100, 1) if serious_total else None

        service_recovery = {
            'total': recovery_total,
            'compensation_cost': recovery_cost,
            'serious_problems': serious_total,
            'linked_problems': linked_total,
            'coverage_pct': recovery_coverage_pct,
            'reasons': recovery_reasons,
            'previous_total': previous_total,
            'previous_compensation_cost': previous_cost,
            'total_change_pct': total_change_pct,
            'cost_change_pct': cost_change_pct,
            'recent': recent_recoveries,
        }

        return Response({
            'revenue': agg['revenue'] or 0,
            'sessions_count': agg['sessions_count'] or 0,
            'avg_check': round(agg['avg_check'] or 0, 2),
            'top_items': top_items,
            'comparison': comparison,
            'operations': operations,
            'kitchen_sla': kitchen_sla,
            'staff_efficiency': staff_efficiency,
            'sla_incident_trends': sla_incident_trends,
            'shift_zone_operations': shift_zone_operations,
            'daily_digest': daily_digest,
            'operations_exception_kpi': operations_exception_kpi,
            'service_recovery': service_recovery,
            'upsell': {
                'impressions': impressions, 'adds': adds, 'conversions': conversions,
                'conversion_rate': round((conversions / impressions * 100) if impressions else 0, 1),
                'add_rate': round((adds / impressions * 100) if impressions else 0, 1),
                'revenue': upsell_revenue, 'top_rules': top_rules,
            },
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
class NetworkAnalyticsView(APIView):
    """Consolidated owner dashboard. Only admin of the network owner branch or superadmin."""
    def _network(self, request, network_id):
        from apps.restaurants.models import RestaurantNetwork
        network = get_object_or_404(RestaurantNetwork.objects.prefetch_related('restaurants'), id=network_id)
        user = request.user
        if not user or not user.is_authenticated:
            from rest_framework.exceptions import NotAuthenticated
            raise NotAuthenticated()
        if user.role == 'superadmin':
            return network
        if user.role != 'admin' or str(user.restaurant_id) != str(network.owner_restaurant_id):
            raise PermissionDenied('Сводная аналитика сети доступна только владельцу сети.')
        return network

    def get(self, request, network_id):
        network = self._network(request, network_id)
        from_date = _parse_date(request.query_params.get('from'), 'from')
        to_date = _parse_date(request.query_params.get('to'), 'to')
        branches = list(network.restaurants.all())
        if not any(r.id == network.owner_restaurant_id for r in branches):
            branches.append(network.owner_restaurant)
        branch_ids = [r.id for r in branches]
        qs = TableSession.objects.filter(restaurant_id__in=branch_ids, status='closed')
        if from_date: qs = qs.filter(closed_at__date__gte=from_date)
        if to_date: qs = qs.filter(closed_at__date__lte=to_date)
        rows = qs.values('restaurant_id').annotate(revenue=Sum('total_amount'), sessions_count=Count('id'), avg_check=Avg('total_amount'))
        metrics = {str(x['restaurant_id']): x for x in rows}
        upsells = UpsellEvent.objects.filter(restaurant_id__in=branch_ids, event_type='conversion')
        if from_date: upsells = upsells.filter(created_at__date__gte=from_date)
        if to_date: upsells = upsells.filter(created_at__date__lte=to_date)
        upsell_map = {str(x['restaurant_id']): x['revenue'] or 0 for x in upsells.values('restaurant_id').annotate(revenue=Sum('revenue'))}
        result = []
        for r in branches:
            m = metrics.get(str(r.id), {})
            result.append({'id': str(r.id), 'name': r.name, 'is_owner_branch': r.id == network.owner_restaurant_id,
                'revenue': m.get('revenue') or 0, 'sessions_count': m.get('sessions_count') or 0,
                'avg_check': round(m.get('avg_check') or 0, 2), 'upsell_revenue': upsell_map.get(str(r.id), 0)})
        result.sort(key=lambda x: float(x['revenue']), reverse=True)
        total_revenue = sum(float(x['revenue']) for x in result)
        total_sessions = sum(x['sessions_count'] for x in result)
        return Response({'network': {'id': str(network.id), 'name': network.name}, 'branches': result,
            'totals': {'revenue': total_revenue, 'sessions_count': total_sessions,
                       'avg_check': round(total_revenue / total_sessions, 2) if total_sessions else 0,
                       'upsell_revenue': sum(float(x['upsell_revenue']) for x in result)}})


class NetworkListCreateView(APIView):
    """Owner creates its network; membership mutation remains superadmin-only."""
    def get(self, request):
        from apps.restaurants.models import RestaurantNetwork
        if not request.user or not request.user.is_authenticated or request.user.role not in ('admin', 'superadmin'):
            raise PermissionDenied()
        qs = RestaurantNetwork.objects.all() if request.user.role == 'superadmin' else RestaurantNetwork.objects.filter(owner_restaurant_id=request.user.restaurant_id)
        return Response([{'id': str(n.id), 'name': n.name, 'owner_restaurant_id': str(n.owner_restaurant_id)} for n in qs])

    def post(self, request):
        from apps.restaurants.models import RestaurantNetwork
        if not request.user or not request.user.is_authenticated or request.user.role != 'admin' or not request.user.restaurant_id:
            raise PermissionDenied('Только администратор ресторана может создать сеть.')
        if RestaurantNetwork.objects.filter(owner_restaurant_id=request.user.restaurant_id).exists():
            return Response({'detail': 'Сеть для этого ресторана уже создана.'}, status=409)
        name = str(request.data.get('name', '')).strip()
        if not name:
            return Response({'name': ['Укажите название сети.']}, status=400)
        network = RestaurantNetwork.objects.create(name=name[:255], owner_restaurant_id=request.user.restaurant_id)
        network.restaurants.add(request.user.restaurant_id)
        return Response({'id': str(network.id), 'name': network.name, 'owner_restaurant_id': str(network.owner_restaurant_id)}, status=201)


class NetworkMembershipView(APIView):
    """Support-only branch linking prevents an owner from claiming unrelated tenants."""
    def post(self, request, network_id):
        from apps.restaurants.models import RestaurantNetwork
        if not request.user or not request.user.is_authenticated or request.user.role != 'superadmin':
            raise PermissionDenied('Филиалы подключает поддержка Plait после проверки владения.')
        network = get_object_or_404(RestaurantNetwork, id=network_id)
        restaurant = get_object_or_404(Restaurant, id=request.data.get('restaurant_id'))
        network.restaurants.add(restaurant)
        return Response({'ok': True}, status=200)

    def delete(self, request, network_id):
        from apps.restaurants.models import RestaurantNetwork
        if not request.user or not request.user.is_authenticated or request.user.role != 'superadmin':
            raise PermissionDenied()
        network = get_object_or_404(RestaurantNetwork, id=network_id)
        restaurant = get_object_or_404(Restaurant, id=request.data.get('restaurant_id'))
        if restaurant.id == network.owner_restaurant_id:
            return Response({'detail': 'Нельзя удалить основной ресторан сети.'}, status=400)
        network.restaurants.remove(restaurant)
        return Response(status=204)
