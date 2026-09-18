from django.db.models import Avg, Count, Sum
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.restaurants.models import Restaurant
from apps.tables.models import Table
from apps.users.permissions import IsRestaurantAdmin
from .models import LoyaltyMember, LoyaltyProgram, LoyaltyRedemption
from .services import get_program


def program_payload(program):
    return {'is_enabled': program.is_enabled, 'points_per_1000': program.points_per_1000,
            'reward_points': program.reward_points, 'reward_discount_amount': program.reward_discount_amount}

class GuestLoyaltyStatusView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, table_token, member_token):
        table = get_object_or_404(Table, token=table_token, is_active=True)
        member = get_object_or_404(LoyaltyMember, restaurant=table.restaurant, token=member_token)
        program = get_program(table.restaurant)
        needed = max(0, program.reward_points - member.points)
        return Response({'visits_count': member.visits_count, 'lifetime_spend': member.lifetime_spend,
                         'points': member.points, 'program': program_payload(program),
                         'can_redeem': program.is_enabled and member.points >= program.reward_points,
                         'points_to_reward': needed})

class LoyaltyDashboardView(APIView):
    permission_classes = [IsRestaurantAdmin]
    def get(self, request, rest_id):
        qs = LoyaltyMember.objects.filter(restaurant_id=rest_id)
        agg = qs.aggregate(members=Count('id'), visits=Sum('visits_count'), spend=Sum('lifetime_spend'), avg_spend=Avg('lifetime_spend'))
        returning = qs.filter(visits_count__gte=2).count(); total = agg['members'] or 0
        red = LoyaltyRedemption.objects.filter(member__restaurant_id=rest_id).aggregate(count=Count('id'), discount=Sum('discount_amount'))
        members = list(qs.order_by('-lifetime_spend').values('id','visits_count','lifetime_spend','points','last_visit_at')[:50])
        return Response({'members_count': total, 'returning_members': returning,
            'repeat_rate': round(returning / total * 100, 1) if total else 0,
            'visits_count': agg['visits'] or 0, 'member_spend': agg['spend'] or 0,
            'avg_member_spend': round(agg['avg_spend'] or 0, 2), 'members': members,
            'redemptions_count': red['count'] or 0, 'discount_given': red['discount'] or 0,
            'program': program_payload(get_program(get_object_or_404(Restaurant, id=rest_id)))})

class LoyaltyProgramView(APIView):
    permission_classes = [IsRestaurantAdmin]
    def get(self, request, rest_id):
        restaurant = get_object_or_404(Restaurant, id=rest_id)
        return Response(program_payload(get_program(restaurant)))
    def patch(self, request, rest_id):
        restaurant = get_object_or_404(Restaurant, id=rest_id); program = get_program(restaurant)
        data = request.data
        if 'is_enabled' in data: program.is_enabled = bool(data['is_enabled'])
        for field, lo, hi in [('points_per_1000',1,100),('reward_points',1,100000)]:
            if field in data:
                try: value = int(data[field])
                except (TypeError, ValueError): return Response({field:'Введите целое число.'}, status=400)
                if value < lo or value > hi: return Response({field:f'Допустимо {lo}–{hi}.'}, status=400)
                setattr(program, field, value)
        if 'reward_discount_amount' in data:
            try: value = float(data['reward_discount_amount'])
            except (TypeError, ValueError): return Response({'reward_discount_amount':'Введите сумму.'}, status=400)
            if value <= 0 or value > 1000000: return Response({'reward_discount_amount':'Допустимо 1–1 000 000 ₸.'}, status=400)
            program.reward_discount_amount = value
        program.save(); return Response(program_payload(program))
