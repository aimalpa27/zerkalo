# Интеграция с iiko (Cloud API)

Хост: **`https://api-ru.iiko.services`** (iikoTransport / Cloud API). Это НЕ старый
Public API `public-api.iikoweb.ru` — другой продукт с другой авторизацией.

Авторизация — `POST /api/v2/access_token` с телом `{appId, apiKey, clientSecret}`
(camelCase) → JWT-токен (`Bearer`, живёт ~1 час).

- `appId` / `clientSecret` — нашего приложения (общие): в `.env`
  (`IIKO_APP_ID`, `IIKO_CLIENT_SECRET`).
- `apiKey` — у каждого ресторана свой (iikoWeb → **Настройки Cloud API**):
  поле `Restaurant.iiko_api_key`, плюс флаг `Restaurant.iiko_enabled`.
- `organizationId` / `externalMenuId` — опционально в модели
  (`iiko_organization_id`, `iiko_external_menu_id`). Если пусты — берётся первая
  организация и первое внешнее меню аккаунта.

## Токен
Кэшируется в Django cache на `IIKO_TOKEN_TTL` секунд (по умолчанию **600 = 10 мин**),
после чего переавторизуется. Логика в `apps/integrations/iiko.py`
(`IikoClient._get_token`).

## Что работает
| Возможность | Эндпоинт | Статус |
|---|---|---|
| Список организаций | `POST /api/1/organizations` | ✅ |
| Список внешних меню | `POST /api/2/menu` | ✅ |
| Импорт меню (позиции) | `POST /api/2/menu/by_id` | ✅ работает |
| Создание заказа | `POST /api/1/deliveries/create` | ⚙️ клиент готов (`create_delivery`), не подключён к заказам PWA |

Меню в аккаунте лежит во **внешнем меню** (iikoWeb → Внешние меню). Обычная
номенклатура `/api/1/nomenclature` в demo-аккаунте возвращает пустой `products` —
поэтому импортируем именно внешнее меню.

## Заказы
В отличие от старого Public API, Cloud API умеет принимать заказы гостя обратно
в iikoWeb «Заказы» через `POST /api/1/deliveries/create`. Метод реализован в
`IikoClient.create_delivery`, но пока не привязан к жизненному циклу заказа PWA —
это следующий шаг (нужно сопоставить позиции корзины с `productId` iiko,
выбрать `orderServiceType` и тип оплаты).

## Как протестировать
- **Кнопкой в панели:** `POST /api/v1/restaurants/<id>/iiko/sync/` (см. `RestaurantIikoSyncView`).
- **Postman:** импортируй `docs/iiko.postman_collection.json` +
  `docs/iiko.postman_environment.json`, заполни секреты, прогони «1. Auth» →
  «2. Organizations» → «3. External menus» → «4. Menu by id».
- **Кодом:** `python manage.py shell` →
  `from apps.integrations.tasks import sync_iiko_menu; sync_iiko_menu()`.
- **На стороне iiko:** iikoWeb → Внешние заказы → «Настройки Cloud API» → у ключа
  видно срок действия и статус «Интеграция активна».
