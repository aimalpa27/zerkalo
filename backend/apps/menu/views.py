import cloudinary.uploader

from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction

from apps.users.permissions import IsRestaurantAdmin

from .models import Category, MenuItem
from .serializers import CategorySerializer, MenuItemSerializer
from .importer import parse_menu_file


class CategoryListView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsRestaurantAdmin()]

    def get_queryset(self):
        rest_id = self.kwargs['rest_id']
        return Category.objects.filter(restaurant_id=rest_id).order_by('sort_order')

    def perform_create(self, serializer):
        serializer.save(restaurant_id=self.kwargs['rest_id'])


class MenuItemListView(generics.ListCreateAPIView):
    serializer_class = MenuItemSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsRestaurantAdmin()]

    def get_queryset(self):
        rest_id = self.kwargs['rest_id']
        qs = MenuItem.objects.filter(restaurant_id=rest_id).select_related('category').order_by('sort_order')
        user = self.request.user
        is_manager = (
            user.is_authenticated
            and (
                user.is_superadmin
                or (user.is_admin_or_manager and str(getattr(user, 'restaurant_id', None)) == str(rest_id))
            )
        )
        if not is_manager:
            qs = qs.filter(is_available=True, is_visible=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(restaurant_id=self.kwargs['rest_id'])

class MenuItemToggleAvailabilityView(APIView):
    permission_classes = [IsRestaurantAdmin]

    def patch(self, request, rest_id, item_id):
        menu_item = generics.get_object_or_404(
            MenuItem,
            id=item_id,
            restaurant_id=rest_id,
        )

        menu_item.is_available = not menu_item.is_available
        menu_item.save(update_fields=['is_available', 'updated_at'])

        serializer = MenuItemSerializer(menu_item)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsRestaurantAdmin]
    serializer_class = CategorySerializer
    lookup_url_kwarg = 'category_id'

    def get_queryset(self):
        return Category.objects.filter(
            restaurant_id=self.kwargs['rest_id'],
        )

class MenuItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsRestaurantAdmin]
    serializer_class = MenuItemSerializer
    lookup_url_kwarg = 'item_id'

    def get_queryset(self):
        return MenuItem.objects.filter(
            restaurant_id=self.kwargs['rest_id'],
        ).select_related('category')
        
class MenuItemImageUploadView(APIView):
    """Загрузка изображения блюда в Cloudinary и сохранение ссылки в image_url."""

    permission_classes = [IsRestaurantAdmin]

    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
    ALLOWED_CONTENT_TYPES = {'image/jpeg', 'image/png', 'image/webp'}

    def post(self, request, rest_id, item_id):
        menu_item = generics.get_object_or_404(
            MenuItem,
            id=item_id,
            restaurant_id=rest_id,
        )

        uploaded_file = request.FILES.get('image')
        if uploaded_file is None:
            return Response(
                {'detail': 'Файл изображения не передан (поле "image").'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if uploaded_file.content_type not in self.ALLOWED_CONTENT_TYPES:
            return Response(
                {'detail': 'Недопустимый тип файла. Разрешены: JPEG, PNG, WEBP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if uploaded_file.size > self.MAX_FILE_SIZE:
            return Response(
                {'detail': 'Файл слишком большой. Максимальный размер — 10MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upload_result = cloudinary.uploader.upload(
            uploaded_file,
            folder=f'plait/menu/{rest_id}',
            transformation=[
                {
                    'width': 800,
                    'height': 600,
                    'crop': 'fill',
                    'quality': 'auto',
                    'fetch_format': 'auto',
                },
            ],
        )

        menu_item.image_url = upload_result['secure_url']
        menu_item.save(update_fields=['image_url', 'updated_at'])

        serializer = MenuItemSerializer(menu_item)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MenuItemMediaUploadView(APIView):
    """Загрузка фото ИЛИ видео блюда в Cloudinary (image_url / video_url)."""

    permission_classes = [IsRestaurantAdmin]

    MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10 MB
    MAX_VIDEO_SIZE = 50 * 1024 * 1024   # 50 MB
    ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
    ALLOWED_VIDEO_TYPES = {'video/mp4', 'video/webm', 'video/quicktime'}

    def post(self, request, rest_id, item_id):
        menu_item = generics.get_object_or_404(
            MenuItem,
            id=item_id,
            restaurant_id=rest_id,
        )

        uploaded_file = request.FILES.get('file')
        if uploaded_file is None:
            return Response(
                {'detail': 'Файл не передан (поле "file").'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = uploaded_file.content_type

        if content_type in self.ALLOWED_IMAGE_TYPES:
            if uploaded_file.size > self.MAX_IMAGE_SIZE:
                return Response(
                    {'detail': 'Файл слишком большой. Максимальный размер изображения — 10MB.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            upload_result = cloudinary.uploader.upload(
                uploaded_file,
                folder=f'plait/menu/{rest_id}',
                transformation=[
                    {
                        'width': 800,
                        'height': 600,
                        'crop': 'fill',
                        'quality': 'auto',
                        'fetch_format': 'auto',
                    },
                ],
            )

            menu_item.image_url = upload_result['secure_url']
            menu_item.save(update_fields=['image_url', 'updated_at'])

        elif content_type in self.ALLOWED_VIDEO_TYPES:
            if uploaded_file.size > self.MAX_VIDEO_SIZE:
                return Response(
                    {'detail': 'Файл слишком большой. Максимальный размер видео — 50MB.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            upload_result = cloudinary.uploader.upload(
                uploaded_file,
                resource_type='video',
                folder=f'plait/menu/{rest_id}/video',
                transformation=[
                    {
                        'width': 800,
                        'height': 600,
                        'crop': 'limit',
                        'quality': 'auto',
                    },
                ],
            )

            menu_item.video_url = upload_result['secure_url']
            menu_item.save(update_fields=['video_url', 'updated_at'])

        else:
            return Response(
                {'detail': 'Недопустимый тип файла. Разрешены изображения (JPEG/PNG/WEBP) или видео (MP4/WEBM/MOV).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MenuItemSerializer(menu_item)
        return Response(serializer.data, status=status.HTTP_200_OK)

class MenuImportView(APIView):
    """Preview/import CSV/XLSX. Any validation error aborts the whole write."""
    permission_classes = [IsRestaurantAdmin]

    def post(self, request, rest_id):
        uploaded = request.FILES.get('file')
        if uploaded is None:
            return Response({'detail': 'Выберите CSV или XLSX файл.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rows, errors = parse_menu_file(uploaded.name, uploaded.read())
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        existing_names = {n.casefold() for n in MenuItem.objects.filter(restaurant_id=rest_id).values_list('name', flat=True)}
        skipped = [r for r in rows if r['name'].casefold() in existing_names]
        create_rows = [r for r in rows if r['name'].casefold() not in existing_names]
        result = {
            'valid': not errors, 'total': len(rows) + len(errors),
            'will_create': len(create_rows), 'will_skip': len(skipped),
            'errors': errors,
            'preview': [{**r, 'price': str(r['price'])} for r in rows[:50]],
            'skipped': [{'row': r['row'], 'name': r['name'], 'reason': 'Блюдо уже существует'} for r in skipped[:50]],
        }
        dry_run = str(request.data.get('dry_run', 'true')).lower() not in {'0', 'false', 'no'}
        if dry_run or errors:
            return Response(result, status=status.HTTP_200_OK if not errors else status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            category_names = {r['category'] for r in create_rows if r['category']}
            existing_categories = {c.name.casefold(): c for c in Category.objects.filter(restaurant_id=rest_id)}
            next_sort = Category.objects.filter(restaurant_id=rest_id).count()
            for name in sorted(category_names, key=str.casefold):
                if name.casefold() not in existing_categories:
                    cat = Category.objects.create(restaurant_id=rest_id, name=name, sort_order=next_sort)
                    existing_categories[name.casefold()] = cat
                    next_sort += 1
            item_sort = MenuItem.objects.filter(restaurant_id=rest_id).count()
            created = []
            for r in create_rows:
                item = MenuItem.objects.create(
                    restaurant_id=rest_id, name=r['name'], description=r['description'], price=r['price'],
                    weight=r['weight'], preparation_station=r['preparation_station'],
                    is_available=r['is_available'], is_visible=r['is_visible'], sort_order=item_sort,
                    category=existing_categories.get(r['category'].casefold()) if r['category'] else None,
                )
                created.append(item); item_sort += 1
        result.update({'created': len(created), 'items': MenuItemSerializer(created, many=True).data})
        return Response(result, status=status.HTTP_201_CREATED)

from .models import UpsellRule
from .serializers import UpsellRuleSerializer

class UpsellRuleListView(generics.ListCreateAPIView):
    permission_classes = [IsRestaurantAdmin]
    serializer_class = UpsellRuleSerializer
    def get_queryset(self):
        return UpsellRule.objects.filter(restaurant_id=self.kwargs['rest_id']).select_related('trigger_item','recommended_item')
    def perform_create(self, serializer):
        serializer.save(restaurant_id=self.kwargs['rest_id'])

class UpsellRuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsRestaurantAdmin]
    serializer_class = UpsellRuleSerializer
    lookup_url_kwarg = 'rule_id'
    def get_queryset(self):
        return UpsellRule.objects.filter(restaurant_id=self.kwargs['rest_id']).select_related('trigger_item','recommended_item')

from rest_framework.exceptions import PermissionDenied
from apps.restaurants.models import RestaurantNetwork
from .models import NetworkMenuTemplateItem, NetworkMenuBranchOverride
from .serializers import NetworkMenuTemplateItemSerializer, NetworkMenuBranchOverrideSerializer


def _network_owner(request, network_id):
    network = generics.get_object_or_404(RestaurantNetwork, id=network_id)
    user = request.user
    if not user or not user.is_authenticated:
        raise PermissionDenied()
    if user.role == 'superadmin':
        return network
    if user.role != 'admin' or str(user.restaurant_id) != str(network.owner_restaurant_id):
        raise PermissionDenied('Центральным меню управляет только владелец сети.')
    return network


class NetworkMenuTemplateListView(APIView):
    def get(self, request, network_id):
        network = _network_owner(request, network_id)
        items = network.menu_template_items.all()
        return Response(NetworkMenuTemplateItemSerializer(items, many=True).data)

    def post(self, request, network_id):
        network = _network_owner(request, network_id)
        ser = NetworkMenuTemplateItemSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        item = ser.save(network=network)
        return Response(NetworkMenuTemplateItemSerializer(item).data, status=201)


class NetworkMenuTemplateDetailView(APIView):
    def patch(self, request, network_id, item_id):
        network = _network_owner(request, network_id)
        item = generics.get_object_or_404(NetworkMenuTemplateItem, id=item_id, network=network)
        ser = NetworkMenuTemplateItemSerializer(item, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(ser.data)

    def delete(self, request, network_id, item_id):
        network = _network_owner(request, network_id)
        item = generics.get_object_or_404(NetworkMenuTemplateItem, id=item_id, network=network)
        item.delete()
        return Response(status=204)


class NetworkMenuBranchOverrideView(APIView):
    """Branch Admin/Manager may override only its own verified branch."""
    def _scope(self, request, network_id, restaurant_id):
        network = generics.get_object_or_404(RestaurantNetwork, id=network_id)
        if not network.restaurants.filter(id=restaurant_id).exists():
            raise PermissionDenied('Ресторан не входит в эту сеть.')
        user = request.user
        if not user or not user.is_authenticated:
            raise PermissionDenied()
        if user.role != 'superadmin' and not (user.is_admin_or_manager and str(user.restaurant_id) == str(restaurant_id)):
            raise PermissionDenied('Можно менять overrides только своего филиала.')
        return network

    def get(self, request, network_id, restaurant_id):
        network = self._scope(request, network_id, restaurant_id)
        qs = NetworkMenuBranchOverride.objects.filter(template_item__network=network, restaurant_id=restaurant_id)
        return Response(NetworkMenuBranchOverrideSerializer(qs, many=True).data)

    def put(self, request, network_id, restaurant_id, item_id):
        network = self._scope(request, network_id, restaurant_id)
        item = generics.get_object_or_404(NetworkMenuTemplateItem, id=item_id, network=network)
        obj, _ = NetworkMenuBranchOverride.objects.get_or_create(template_item=item, restaurant_id=restaurant_id)
        ser = NetworkMenuBranchOverrideSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True); ser.save()
        return Response(ser.data)


class NetworkMenuPublishView(APIView):
    """Idempotently materialize canonical menu + branch overrides into normal MenuItem rows."""
    def post(self, request, network_id):
        network = _network_owner(request, network_id)
        branch_id = request.data.get('restaurant_id')
        branches = network.restaurants.all()
        if branch_id:
            branches = branches.filter(id=branch_id)
            if not branches.exists():
                return Response({'detail':'Филиал не входит в сеть.'}, status=400)
        created = updated = 0
        with transaction.atomic():
            for branch in branches:
                overrides = {o.template_item_id:o for o in NetworkMenuBranchOverride.objects.filter(restaurant=branch, template_item__network=network)}
                categories = {c.name.casefold():c for c in Category.objects.filter(restaurant=branch)}
                for template in network.menu_template_items.all():
                    category = None
                    if template.category_name:
                        key = template.category_name.casefold()
                        category = categories.get(key)
                        if not category:
                            category = Category.objects.create(restaurant=branch, name=template.category_name, sort_order=len(categories)); categories[key] = category
                    override = overrides.get(template.id)
                    defaults = dict(name=template.name, category=category, description=template.description, price=override.price if override and override.price is not None else template.price,
                        image_url=template.image_url, emoji=template.emoji, weight=template.weight, preparation_station=template.preparation_station,
                        is_available=override.is_available if override and override.is_available is not None else template.is_available,
                        is_visible=override.is_visible if override and override.is_visible is not None else template.is_visible, sort_order=template.sort_order)
                    _, was_created = MenuItem.objects.update_or_create(restaurant=branch, network_template_item=template, defaults=defaults)
                    created += int(was_created); updated += int(not was_created)
        return Response({'ok':True,'branches':branches.count(),'created':created,'updated':updated})
