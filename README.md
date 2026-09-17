# Plait — QR-меню и система управления рестораном

> **Architecture note (2026-09-16):** текущая рабочая кодовая база использует **Django REST + JWT + PostgreSQL/SQLite + Django Channels/Redis** как основной backend/realtime слой. Разделы ниже, где Firebase/Firestore/Firebase Auth описаны как текущая архитектура, являются legacy-документацией и требуют поэтапного обновления. Не разворачивайте новый production flow на Firebase, опираясь только на эти старые разделы. External AI integrations отключены: `AI_ENABLED=false`.


Полностью готовое PWA-приложение для ресторана: гостевое меню по QR-коду, панель управления для администраторов и официантов, кухонное табло в реальном времени.

**Живой адрес:** https://cafe-879cf.web.app

---

## Что умеет приложение

### Гостевое меню (`/`)
- Сканирует QR-код со стола → открывает меню конкретного ресторана
- Просмотр блюд по категориям, фильтрация, промо
- Корзина с комментариями к каждому блюду («без лука», «без острого»)
- Оплата наличными или картой — гость выбирает при оформлении
- Кнопка вызова официанта
- Поддержка 6 языков: RU, KK, EN, ZH, TR, KO
- Устанавливается на телефон как нативное приложение (PWA)
- Тёмная и светлая темы

### Панель управления (`/admin`)
- **Вход:** администратор или официант — разные уровни доступа
- **Заказы в реальном времени** — карточки столов, статусы блюд, уведомления о вызове официанта
- **Управление меню** — добавить/редактировать/скрыть блюда, категории, скидки, фото, подготовительная станция (кухня/бар)
- **Столы** — создание, QR-коды для печати
- **Персонал** — добавление сотрудников, назначение столов официанту
- **Аналитика** — выручка за день/неделю/месяц/произвольный период
- **Новый заказ** — администратор или официант сами добавляют блюда на стол с комментариями
- Тёмная и светлая темы

### Кухонное табло (`/kitchen`)
- Отдельный экран для кухни / бара / всех станций
- Все входящие заказы в реальном времени с таймером ожидания
- Комментарии к каждому блюду видны поварам
- Кнопки «Готово» / «Вернуть»
- Звуковой сигнал при новом заказе
- Клавиатурная навигация (↑↓ Enter Backspace)
- Светлая тема для яркого освещения кухни

---

## Технологии

| Слой | Что используется |
|------|-----------------|
| Фреймворк | React 18 + TypeScript |
| Сборщик | Vite 5 (multi-entry: 3 отдельных приложения) |
| Стили | Tailwind CSS + CSS Custom Properties (дизайн-токены) |
| Состояние | Zustand (отдельный стор для каждого приложения) |
| База данных | Firebase Firestore (realtime onSnapshot) |
| Авторизация | Firebase Auth (email/password) |
| Хостинг | Firebase Hosting |
| Шрифт | Manrope (self-hosted через @fontsource) |
| Анимации | Framer Motion |
| Иконки | Lucide React |

---

## Структура файлов

```
pwa/
├── firebase.json              # Firebase Hosting: правила маршрутизации, кэш, rewrites
├── .gitignore
├── README.md                  # ← этот файл
└── frontend/                  # Весь фронтенд
    ├── index.html             # Entry point: гостевое меню
    ├── admin.html             # Entry point: панель управления
    ├── kitchen.html           # Entry point: кухонное табло
    ├── vite.config.ts         # Multi-entry build + порт dev-сервера
    ├── tailwind.config.ts     # Шрифты, кастомные токены (gold, card, rim...)
    ├── tsconfig.json
    ├── package.json
    ├── public/
    │   ├── icon_512.png            # Иконка бренда (тёмная тема)
    │   ├── icon_white.png          # Иконка бренда (светлая тема)
    │   ├── manifest.json           # PWA-манифест: гостевое меню
    │   ├── admin-manifest.json     # PWA-манифест: панель управления
    │   └── kitchen-manifest.json   # PWA-манифест: кухня
    └── src/
        ├── main.tsx               # Точка входа гостевого меню
        ├── admin-main.tsx         # Точка входа панели управления
        ├── App.tsx                # Корневой компонент гостевого меню
        ├── index.css              # Глобальные стили гостевого меню
        │
        ├── lib/
        │   ├── firebase.ts        # Инициализация Firebase (db, auth)
        │   └── restaurantTheme.ts # Применение кастомных цветов ресторана
        │
        ├── types/
        │   └── index.ts           # Все TypeScript-интерфейсы (см. ниже)
        │
        ├── store/
        │   └── useStore.ts        # Zustand-стор гостевого приложения
        │                          # (корзина, cartNotes, активная сессия, навигация)
        │
        ├── hooks/
        │   ├── useCart.ts         # addItem, decItem, placeOrder (Firestore)
        │   ├── useMenu.ts         # onSnapshot: меню ресторана
        │   ├── useSession.ts      # onSnapshot: активная сессия стола
        │   ├── useRestaurants.ts  # onSnapshot: список ресторанов
        │   └── useT.ts            # Хук перевода (6 языков)
        │
        ├── i18n/
        │   └── translations.ts    # Все строки интерфейса на RU/KK/EN/ZH/TR/KO
        │
        ├── components/
        │   ├── ui/
        │   │   ├── Toast.tsx      # Глобальный тост (showToast утилита)
        │   │   ├── Spinner.tsx    # Анимация загрузки
        │   │   └── LangPicker.tsx # Выбор языка
        │   ├── menu/
        │   │   ├── MenuCard.tsx   # Карточка блюда в списке меню
        │   │   └── DishModal.tsx  # Модал блюда: фото, цена, кол-во, комментарий
        │   ├── layout/
        │   │   ├── CartBar.tsx    # Плавающая кнопка корзины
        │   │   ├── CartSheet.tsx  # Bottom sheet корзины с per-item заметками
        │   │   ├── BottomNav.tsx  # Нижняя навигация (мобайл)
        │   │   └── SidebarNav.tsx # Боковая навигация (десктоп)
        │   └── home/
        │       └── RestaurantCard.tsx  # Карточка ресторана на главной
        │
        ├── screens/
        │   ├── HomeScreen.tsx         # Главная: список ресторанов, промо
        │   ├── RestaurantScreen.tsx   # Меню ресторана (категории + блюда)
        │   ├── TableScreen.tsx        # Режим стола: заказы + вызов официанта
        │   ├── QRScreen.tsx           # Сканер QR-кода стола
        │   ├── PromosScreen.tsx       # Акции и предложения
        │   ├── MapScreen.tsx          # Карта расположения
        │   └── OwnersScreen.tsx       # Страница для владельцев (лэндинг)
        │
        ├── admin/
        │   ├── AdminApp.tsx           # Корень: Firebase Auth listener, загрузка профиля
        │   ├── store.ts               # Zustand-стор: сессии, меню, персонал, вызовы
        │   ├── index.css              # Стили панели управления
        │   ├── screens/
        │   │   ├── ModeScreen.tsx     # Выбор роли (Администратор / Официант)
        │   │   ├── AuthScreen.tsx     # Форма входа
        │   │   └── AppScreen.tsx      # Основной экран с вкладками
        │   ├── tabs/
        │   │   ├── SessionsTab.tsx    # Активные заказы столов в реальном времени
        │   │   ├── MenuTab.tsx        # CRUD меню: блюда, категории
        │   │   ├── TablesTab.tsx      # Управление столами, генерация QR
        │   │   ├── StaffTab.tsx       # Добавление/удаление сотрудников
        │   │   ├── CallsTab.tsx       # История вызовов официанта
        │   │   └── AnalyticsTab.tsx   # Выручка по периодам, топ блюд
        │   ├── modals/
        │   │   ├── NewOrderModal.tsx       # Ручное добавление заказа на стол
        │   │   ├── SessionDetailModal.tsx  # Детали сессии: блюда, суммы, статусы
        │   │   ├── AddStaffModal.tsx       # Добавление сотрудника
        │   │   └── AssignTablesModal.tsx   # Назначение столов официанту
        │   ├── components/
        │   │   ├── SessionCard.tsx    # Карточка стола в SessionsTab
        │   │   ├── AdminSidebar.tsx   # Боковое меню (десктоп)
        │   │   ├── AdminBottomNav.tsx # Нижняя навигация (мобайл)
        │   │   ├── TopBar.tsx         # Верхняя строка (заголовок + действия)
        │   │   ├── AdminToast.tsx     # Всплывающее уведомление
        │   │   ├── CallBanner.tsx     # Баннер вызова официанта (со звуком)
        │   │   └── ConfirmModal.tsx   # Модал подтверждения опасных действий
        │   └── hooks/
        │       └── useAdminListeners.ts  # Все Firestore onSnapshot-листенеры
        │                                 # (сессии, меню, столы, персонал, вызовы)
        │
        └── kitchen/
            ├── kitchen-main.tsx          # Точка входа кухни
            ├── KitchenApp.tsx            # Корень: Auth listener + useKitchenSessions
            ├── store.ts                  # Zustand: station, sessions, screen, restId
            ├── index.css                 # Стили кухни (тёмная + светлая темы)
            ├── screens/
            │   ├── KitchenLoginScreen.tsx  # Логин + выбор станции (Кухня/Бар/Все)
            │   └── KitchenBoardScreen.tsx  # Доска: колонки «Заказы» и «Готово»
            ├── components/
            │   ├── OrderCard.tsx     # Карточка заказа с таймером и заметками
            │   ├── KitchenHeader.tsx # Шапка: логотип, вкладки, часы, тема, выход
            │   └── NewOrderBanner.tsx # Баннер «Новый заказ» вверху экрана
            └── hooks/
                ├── useKitchenSessions.ts  # Firestore listener: open сессии ресторана
                └── useAudioAlert.ts       # Web Audio API: три коротких бипа
```

---

## Типы данных (types/index.ts)

```typescript
Restaurant    // Ресторан: название, slug, адрес, координаты, serviceCharge
Category      // Категория меню
MenuItem      // Блюдо: цена, скидка, изображение, станция (kitchen/bar)
SessionItem   // Позиция в заказе: статус, note, preparationStation
TableSession  // Сессия стола: массив items, суммы, статус оплаты
Table         // Стол: номер + токен для QR
WaiterCall    // Вызов официанта: статус, причина
Promo         // Акция ресторана
```

### Жизненный цикл `SessionItem.status`

```
pending → ready → served → delivered
                          ↘ cancelled
```

---

## База данных Firebase Firestore

```
restaurants/
  {restId}/
    tableSessions/   ← активные и закрытые сессии столов
    menuItems/       ← блюда ресторана
    categories/      ← категории меню
    tables/          ← столы с токенами
    waiterCalls/     ← вызовы официанта
    promos/          ← акции

users/               ← профили сотрудников (role, restaurantId, assignedTables)
```

---

## Управление состоянием (Zustand)

Три независимых стора — по одному на каждое приложение:

| Стор | Файл | Что хранит |
|------|------|------------|
| Гостевой | `store/useStore.ts` | корзина, cartNotes, активная сессия, экраны, язык, тема |
| Админский | `admin/store.ts` | сессии, меню, столы, персонал, вызовы, тема, состояние модалов |
| Кухонный | `kitchen/store.ts` | станция, сессии, экран, restId |

---

## Как запустить локально

**Требования:** Node.js 18+, Firebase CLI

```bash
# 1. Установить зависимости
cd frontend
npm install

# 2. Запустить dev-сервер
npm run dev

# Открыть в браузере:
# http://localhost:5173          — гостевое меню
# http://localhost:5173/admin    — панель управления
# http://localhost:5173/kitchen  — кухонное табло
```

---

## Деплой

```bash
# 1. Собрать проект
cd frontend
npm run build

# 2. Задеплоить на Firebase Hosting
cd ..
firebase deploy --only hosting
```

Приложение доступно по адресу: **https://cafe-879cf.web.app**

---

## Создание ресторана — первый запуск

1. Войдите в [Firebase Console](https://console.firebase.google.com/project/cafe-879cf)
2. Firestore → создайте документ в коллекции `restaurants` с полями:
   ```json
   {
     "name": "Название ресторана",
     "slug": "url-friendly-slug",
     "isPublic": true,
     "serviceChargePercent": 10
   }
   ```
3. Создайте пользователя в Firebase Auth (Email/Password)
4. Создайте документ в коллекции `users`:
   ```json
   {
     "uid": "uid-из-firebase-auth",
     "email": "admin@example.com",
     "role": "admin",
     "restaurantId": "id-ресторана-из-шага-2"
   }
   ```
5. Войдите на `/admin` — система найдёт ресторан и откроет панель

---

## QR-коды для столов

QR-код содержит ссылку формата:
```
https://cafe-879cf.web.app/?slug=ВАШ_SLUG&token=ТОКЕН_СТОЛА
```

Токен стола генерируется в панели управления → вкладка **Столы** → кнопка QR.

---

## Установка на телефон (PWA)

**iPhone (Safari):** Поделиться → «На экран "Домой"»  
**Android (Chrome):** Меню → «Установить приложение»

Все три приложения (меню, панель, кухня) устанавливаются отдельно.

---

## Дизайн-система Plait

| Токен | Значение | Назначение |
|-------|----------|------------|
| `--color-bg` | `#1A0F08` | Фон (тёмный кофе) |
| `--color-card` | `#251408` | Карточки |
| `--color-card2` | `#311A0C` | Вложенные карточки |
| `--color-gold` | `#FF6B1A` | Основной акцент (огонь) |
| `--color-gold2` | `#FF9248` | Мягкий акцент (мандарин) |
| `--color-soft` | `#FAC775` | Основной текст (шафран) |
| `--color-green` | `#4CAF50` | Успех / готово |
| `--color-red` | `#EF4444` | Ошибка / отмена |

Шрифт: **Manrope** (400 / 500 / 600 / 800)
