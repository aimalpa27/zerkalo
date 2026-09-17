"""
Клиент iiko Cloud API (iikoTransport, host api-ru.iiko.services).

Это НЕ старый Public API (public-api.iikoweb.ru) — тот другой продукт с другой
авторизацией. Ключ ресторана выдаётся в iikoWeb → «Настройки Cloud API».

Проверено живыми запросами:
    POST https://api-ru.iiko.services/api/v2/access_token
        {appId, apiKey, clientSecret}            -> {token}          (JWT ~1 час)
    POST https://api-ru.iiko.services/api/1/organizations
        Authorization: Bearer <token>            -> {organizations: [...]}
    POST https://api-ru.iiko.services/api/2/menu
        {organizationIds:[...]}                  -> {externalMenus: [...]}
    POST https://api-ru.iiko.services/api/2/menu/by_id
        {organizationIds:[...], externalMenuId}  -> {itemCategories: [...]}
    POST https://api-ru.iiko.services/api/1/deliveries/create
        {organizationId, order:{...}}            -> заказ падает в iikoWeb «Заказы»

Ключи:
    appId / clientSecret — нашего приложения (общие, из settings/.env).
    apiKey — свой у каждого ресторана (Restaurant.iiko_api_key).
    organizationId / externalMenuId — свои у ресторана; если не заданы в модели,
    берём первый из ответа API (Restaurant.iiko_organization_id / _external_menu_id).
"""

import hashlib

import requests

# Типы номенклатуры, которые показываем гостям как блюда/товары.
MENU_ITEM_TYPES = {'DISH', 'GOOD', 'PRODUCT'}

# TTL кэшированного токена (сек). JWT от iiko живёт ~1 час; держим свой чуть
# меньше и «крутим».
DEFAULT_TOKEN_TTL = 600  # секунд


class IikoError(RuntimeError):
    """Любая ошибка обращения к iiko Cloud API."""


class IikoClient:
    def __init__(
        self,
        api_key: str,
        app_id: str,
        client_secret: str,
        base_url: str = 'https://api-ru.iiko.services',
        organization_id: str = '',
        external_menu_id: str = '',
        timeout: int = 30,
        token_ttl: int = DEFAULT_TOKEN_TTL,
    ):
        self.api_key = api_key
        self.app_id = app_id
        self.client_secret = client_secret
        self.base_url = base_url.rstrip('/')
        self.organization_id = organization_id or ''
        self.external_menu_id = external_menu_id or ''
        self.timeout = timeout
        self.token_ttl = token_ttl
        self._token: str | None = None

    @property
    def _cache_key(self) -> str:
        # apiKey в ключ кэша не кладём открытым — хэшируем.
        digest = hashlib.sha256(self.api_key.encode()).hexdigest()[:16]
        return f'iiko:token:{digest}'

    # ── низкоуровневое ──────────────────────────────────────────────────────
    def _request(self, path: str, payload=None, auth: bool = True) -> dict:
        headers = {'Content-Type': 'application/json'}
        if auth:
            headers['Authorization'] = f'Bearer {self._get_token()}'
        try:
            resp = requests.post(
                f'{self.base_url}{path}', json=payload or {},
                headers=headers, timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise IikoError(f'iiko request failed ({path}): {exc}') from exc

        try:
            data = resp.json()
        except ValueError:
            data = {}

        if resp.status_code != 200:
            detail = ''
            if isinstance(data, dict):
                detail = data.get('errorDescription') or data.get('error') or data.get('message') or ''
            raise IikoError(f'iiko {path} -> HTTP {resp.status_code}: {detail or resp.text[:200]}')
        return data if isinstance(data, dict) else {}

    def _get_token(self, force_refresh: bool = False) -> str:
        """Токен Cloud API. Кэшируется на token_ttl секунд; force_refresh игнорирует кэш."""
        if self._token and not force_refresh:
            return self._token

        if not force_refresh:
            cached = self._cache_get()
            if cached:
                self._token = cached
                return cached

        data = self._request(
            '/api/v2/access_token',
            {
                'appId': self.app_id,
                'apiKey': self.api_key,
                'clientSecret': self.client_secret,
            },
            auth=False,
        )
        token = data.get('token')
        if not token:
            raise IikoError(f'iiko access_token: токен не получен, ответ: {data}')
        self._token = token
        self._cache_set(token)
        return token

    # Кэш токена через Django cache; вне Django — тихо деградируем до кэша в инстансе.
    def _cache_get(self) -> str | None:
        try:
            from django.core.cache import cache
            return cache.get(self._cache_key)
        except Exception:
            return None

    def _cache_set(self, token: str) -> None:
        try:
            from django.core.cache import cache
            cache.set(self._cache_key, token, self.token_ttl)
        except Exception:
            pass

    # ── организации / меню ──────────────────────────────────────────────────
    def get_organizations(self) -> list[dict]:
        data = self._request('/api/1/organizations', {'returnAdditionalInfo': False})
        return data.get('organizations', []) or []

    def resolve_organization_id(self) -> str:
        """organizationId ресторана: из модели, иначе первый из ответа API."""
        if self.organization_id:
            return self.organization_id
        orgs = self.get_organizations()
        if not orgs:
            raise IikoError('iiko: у ключа нет доступных организаций')
        self.organization_id = orgs[0]['id']
        return self.organization_id

    def get_external_menus(self, organization_id: str) -> list[dict]:
        data = self._request('/api/2/menu', {'organizationIds': [organization_id]})
        return data.get('externalMenus', []) or []

    def resolve_external_menu_id(self, organization_id: str) -> str:
        """externalMenuId ресторана: из модели, иначе первое внешнее меню."""
        if self.external_menu_id:
            return self.external_menu_id
        menus = self.get_external_menus(organization_id)
        if not menus:
            raise IikoError('iiko: у организации нет внешних меню (создайте в iikoWeb → Внешние меню)')
        self.external_menu_id = str(menus[0]['id'])
        return self.external_menu_id

    def get_menu(self, organization_id: str, external_menu_id: str) -> dict:
        return self._request(
            '/api/2/menu/by_id',
            {'organizationIds': [organization_id], 'externalMenuId': external_menu_id},
        )

    def get_products(self, include_hidden: bool = False) -> list[dict]:
        """Плоский нормализованный список позиций внешнего меню ресторана.

        Каждая позиция: {id, name, description, price, category, type, is_hidden}.
        organizationId и externalMenuId берутся из модели или разрешаются
        автоматически (первая организация / первое внешнее меню).
        """
        org_id = self.resolve_organization_id()
        menu_id = self.resolve_external_menu_id(org_id)
        menu = self.get_menu(org_id, menu_id)

        items: list[dict] = []
        for category in menu.get('itemCategories', []) or []:
            cat_name = category.get('name', '') or ''
            for raw in category.get('items', []) or []:
                is_hidden = bool(raw.get('isHidden'))
                if is_hidden and not include_hidden:
                    continue
                item_type = raw.get('type') or 'DISH'
                if item_type not in MENU_ITEM_TYPES and not include_hidden:
                    continue
                items.append({
                    'id': raw.get('itemId'),
                    'name': raw.get('name', '') or '',
                    'description': raw.get('description', '') or '',
                    'price': extract_price(raw),
                    'category': cat_name,
                    'type': item_type,
                    'is_hidden': is_hidden,
                })
        return items

    # ── заказы ──────────────────────────────────────────────────────────────
    def create_delivery(self, order: dict, organization_id: str | None = None) -> dict:
        """Отправляет заказ в iiko (падает в iikoWeb → «Заказы»).

        `order` — тело заказа Cloud API (customer, phone, items[], и т.п.).
        Пока не подключено к жизненному циклу заказа PWA — метод готов к вызову.
        """
        org_id = organization_id or self.resolve_organization_id()
        return self._request(
            '/api/1/deliveries/create',
            {'organizationId': org_id, 'order': order},
        )


def client_for_restaurant(restaurant) -> IikoClient:
    """Собирает клиента из глобальных настроек приложения + ключей ресторана."""
    from django.conf import settings

    return IikoClient(
        api_key=restaurant.iiko_api_key,
        app_id=settings.IIKO_APP_ID,
        client_secret=settings.IIKO_CLIENT_SECRET,
        base_url=settings.IIKO_API_BASE_URL,
        organization_id=getattr(restaurant, 'iiko_organization_id', '') or '',
        external_menu_id=getattr(restaurant, 'iiko_external_menu_id', '') or '',
        token_ttl=getattr(settings, 'IIKO_TOKEN_TTL', DEFAULT_TOKEN_TTL),
    )


def extract_price(item: dict) -> float:
    """Цена позиции внешнего меню: prices[] у размера по умолчанию."""
    sizes = item.get('itemSizes') or []
    default = next((s for s in sizes if s.get('isDefault')), sizes[0] if sizes else None)
    if not default:
        return 0
    for pr in default.get('prices') or []:
        price = pr.get('price')
        if price is not None:
            return price
    return 0
