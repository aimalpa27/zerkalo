import cloudinary.uploader

from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import IsRestaurantAdmin

from .models import Category, MenuItem
from .serializers import CategorySerializer, MenuItemSerializer


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