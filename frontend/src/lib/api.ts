/**
 * Django REST API client.
 *
 * Всё через Django: аутентификация (JWT), данные, запись/мутации,
 * аналитика, Cloudinary, realtime по WebSocket.
 *
 * Токены хранятся в памяти (access) и sessionStorage (refresh).
 * sessionStorage очищается при закрытии вкладки — токен не лежит в localStorage
 * навсегда.
 */

import type { MenuItem, TableSession, Restaurant, Shift, ChatMessage, Zone } from '../types'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '')

// ── Token store ───────────────────────────────────────────────────────────────

let _access: string | null = null

export const tokenStore = {
  setTokens(access: string, refresh: string) {
    _access = access
    sessionStorage.setItem('plait_refresh', refresh)
  },
  getAccess: () => _access,
  getRefresh: () => sessionStorage.getItem('plait_refresh'),
  clear() {
    _access = null
    sessionStorage.removeItem('plait_refresh')
  },
  hasSession: () => !!sessionStorage.getItem('plait_refresh'),
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

// FIX: на старте приложения (и при каждом редеплое фронтенда — браузер делает
// полную перезагрузку страницы, сбрасывая _access) сразу выполняется несколько
// параллельных запросов (auth/me, sessions, menu, tables, staff, calls...).
// Все они получают 401 одновременно и раньше КАЖДЫЙ вызывал _refreshAccess()
// независимо. Из-за ROTATE_REFRESH_TOKENS+BLACKLIST_AFTER_ROTATION первый запрос
// успешно ротировал refresh-токен, а все остальные параллельные запросы
// отправляли уже устаревший (заблокированный) refresh-токен, получали ошибку
// и вызывали tokenStore.clear() — стирая свежие токены, которые только что
// записал первый запрос. Итог: пользователя выкидывало из сессии сразу после
// загрузки/редеплоя. Дедупликация через общий промис гарантирует один запрос
// /auth/refresh/ на все параллельные 401.
let _refreshPromise: Promise<string | null> | null = null

async function _refreshAccess(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise

  _refreshPromise = (async () => {
    const refresh = tokenStore.getRefresh()
    if (!refresh) return null
    try {
      const r = await fetch(`${BASE}/auth/refresh/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh }),
      })
      if (!r.ok) { tokenStore.clear(); return null }
      const data = await r.json()
      _access = data.access
      // Rotate refresh token if backend returned a new one
      if (data.refresh) sessionStorage.setItem('plait_refresh', data.refresh)
      return data.access
    } catch {
      return null
    }
  })()

  try {
    return await _refreshPromise
  } finally {
    _refreshPromise = null
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
  _retry = true,
): Promise<T> {
  const isForm = options.body instanceof FormData

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    ...(!isForm ? { 'Content-Type': 'application/json' } : {}),
    ...(_access   ? { Authorization: `Bearer ${_access}` }  : {}),
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  // Auto-refresh on 401
  if (res.status === 401 && _retry) {
    const newAccess = await _refreshAccess()
    if (newAccess) return apiRequest<T>(path, options, false)
    tokenStore.clear()
    throw Object.assign(new Error('SESSION_EXPIRED'), { status: 401 })
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw Object.assign(
      new Error(body.detail ?? body.message ?? `HTTP ${res.status}`),
      { status: res.status, data: body },
    )
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── API methods ───────────────────────────────────────────────────────────────

export const api = {

  // ── Auth ──────────────────────────────────────────────────────────────────

  /** Получить JWT-пару по email/password */
  login(email: string, password: string) {
    return apiRequest<{
      access: string
      refresh: string
      user: {
        id: string
        email: string
        name: string
        role: string
        restaurant_id: string | null
        assigned_tables: string[]
        assigned_zones?: string[]
      }
    }>('/auth/login/', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    })
  },

  /** Инвалидировать refresh-токен (logout) */
  logout() {
    const refresh = tokenStore.getRefresh()
    if (!refresh) return Promise.resolve()
    return apiRequest('/auth/logout/', {
      method: 'POST',
      body:   JSON.stringify({ refresh }),
    }).finally(() => tokenStore.clear())
  },

  /** Профиль текущего пользователя */
  me() {
    return apiRequest<{
      id: string; email: string; name: string; role: string
      restaurant_id: string | null; is_active: boolean
      assigned_tables: string[]; assigned_zones?: string[]
    }>('/auth/me/')
  },

  /** Изменить собственный профиль (сейчас — только отображаемое имя) */
  updateProfile(data: { name: string }) {
    return apiRequest<{ id: string; email: string; name: string; role: string }>('/auth/me/', {
      method: 'PATCH',
      body:   JSON.stringify(data),
    })
  },

  // ── Рестораны ─────────────────────────────────────────────────────────────

  restaurants() {
    return apiRequest<DjangoRestaurant[]>('/restaurants/')
  },

  restaurantById(id: string) {
    return apiRequest<DjangoRestaurant>(`/restaurants/${id}/`)
  },

  /** Ключевой метод: найти Django-ресторан по slug */
  restaurantBySlug(slug: string) {
    return apiRequest<DjangoRestaurant>(`/restaurants/by-slug/${slug}/`)
  },

  // ── Меню ──────────────────────────────────────────────────────────────────

  menu(restId: string) {
    return apiRequest<DjangoMenuItem[]>(`/restaurants/${restId}/menu/`)
  },

  categories(restId: string) {
    return apiRequest<DjangoCategory[]>(`/restaurants/${restId}/categories/`)
  },

  toggleMenuItem(restId: string, itemId: string) {
    return apiRequest<DjangoMenuItem>(
      `/restaurants/${restId}/menu/${itemId}/toggle-availability/`,
      { method: 'PATCH' },
    )
  },

  /** Загрузить фото блюда в Cloudinary через Django */
  uploadMenuImage(restId: string, itemId: string, file: File) {
    const form = new FormData()
    form.append('image', file)
    return apiRequest<DjangoMenuItem>(
      `/restaurants/${restId}/menu/${itemId}/upload-image/`,
      { method: 'POST', body: form },
    )
  },

  /** Загрузить фото ИЛИ видео блюда в Cloudinary через Django */
  uploadMenuMedia(restId: string, itemId: string, file: File) {
    const form = new FormData()
    form.append('file', file)
    return apiRequest<DjangoMenuItem>(
      `/restaurants/${restId}/menu/${itemId}/upload-media/`,
      { method: 'POST', body: form },
    )
  },

  /** Создать новое блюдо */
  createMenuItem(restId: string, data: Partial<{
    name: string; description: string; price: number | string; emoji: string; weight: string
    badge: string | null; discount_percent: number; preparation_station: 'kitchen' | 'bar'
    category_id: string | null; is_available: boolean; is_visible: boolean; sort_order: number
  }>) {
    return apiRequest<DjangoMenuItem>(`/restaurants/${restId}/menu/`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /** Обновить блюдо (частично) */
  updateMenuItem(restId: string, itemId: string, data: Partial<{
    name: string; description: string; price: number | string; emoji: string; weight: string
    badge: string | null; discount_percent: number; preparation_station: 'kitchen' | 'bar'
    category_id: string | null; is_available: boolean; is_visible: boolean; sort_order: number
  }>) {
    return apiRequest<DjangoMenuItem>(`/restaurants/${restId}/menu/${itemId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  /** Удалить блюдо */
  deleteMenuItem(restId: string, itemId: string) {
    return apiRequest<void>(`/restaurants/${restId}/menu/${itemId}/`, { method: 'DELETE' })
  },

  /** Создать категорию меню */
  createCategory(restId: string, data: { name: string; sort_order?: number }) {
    return apiRequest<DjangoCategory>(`/restaurants/${restId}/categories/`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /** Обновить категорию меню */
  updateCategory(restId: string, categoryId: string, data: Partial<{ name: string; sort_order: number }>) {
    return apiRequest<DjangoCategory>(`/restaurants/${restId}/categories/${categoryId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  /** Удалить категорию меню */
  deleteCategory(restId: string, categoryId: string) {
    return apiRequest<void>(`/restaurants/${restId}/categories/${categoryId}/`, { method: 'DELETE' })
  },

  // ── Сессии / заказы ───────────────────────────────────────────────────────

  /** Оформить заказ (гостевой эндпоинт — не требует JWT) */
  placeOrder(data: {
    table_token: string
    payment_method?: string
    items: Array<{ menu_item_id: string; quantity: number; note?: string }>
  }) {
    return apiRequest<DjangoSession>('/sessions/', {
      method: 'POST',
      body:   JSON.stringify(data),
    })
  },

  /** Оформить заказ от имени персонала (требует JWT) — сразу sent_to_kitchen/sent_to_bar, без подтверждения */
  staffPlaceOrder(restId: string, data: {
    table_token: string
    payment_method?: string
    items: Array<{ menu_item_id: string; quantity: number; note?: string }>
  }) {
    return apiRequest<DjangoSession>(`/restaurants/${restId}/sessions/place-order/`, {
      method: 'POST',
      body:   JSON.stringify(data),
    })
  },

  /** Оформить заказ на доставку или самовывоз (гостевой эндпоинт — не требует JWT) */
  placeDeliveryOrder(data: {
    restaurant_id: string
    order_type: 'delivery' | 'pickup'
    customer_name: string
    customer_phone: string
    delivery_address?: string
    delivery_comment?: string
    payment_method?: string
    items: Array<{ menu_item_id: string; quantity: number; note?: string }>
  }) {
    return apiRequest<DjangoSession>('/delivery-orders/', {
      method: 'POST',
      body:   JSON.stringify(data),
    })
  },

  activeSessions(restId: string) {
    return apiRequest<DjangoSession[]>(`/restaurants/${restId}/sessions/`)
  },

  closeSession(restId: string, sessionId: string, paymentMethod?: string) {
    return apiRequest<DjangoSession>(
      `/restaurants/${restId}/sessions/${sessionId}/close/`,
      { method: 'POST', body: JSON.stringify({ payment_method: paymentMethod ?? '' }) },
    )
  },

  requestPayment(tableToken: string) {
    return apiRequest<DjangoSession>(`/sessions/${tableToken}/request-payment/`, {
      method: 'POST',
    })
  },

  updateItemStatus(restId: string, sessionId: string, itemId: string, status: string) {
    return apiRequest(
      `/restaurants/${restId}/sessions/${sessionId}/items/${itemId}/`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    )
  },

  // ── Вызов официанта ───────────────────────────────────────────────────────

  /** Гостевой вызов — не требует JWT, только table_token */
  waiterCall(tableToken: string, reason?: string) {
    return apiRequest('/waiter-calls/', {
      method: 'POST',
      body:   JSON.stringify({ table_token: tableToken, reason: reason ?? '' }),
    })
  },

  waiterCalls(restId: string) {
    return apiRequest<DjangoWaiterCall[]>(`/restaurants/${restId}/waiter-calls/`)
  },

  // ── Персонал ──────────────────────────────────────────────────────────────

  staff(restId: string) {
    return apiRequest<DjangoUser[]>(`/restaurants/${restId}/staff/`)
  },

  createStaff(restId: string, data: {
    email: string; name: string; role: string; password: string
  }) {
    return apiRequest<DjangoUser>(`/restaurants/${restId}/staff/`, {
      method: 'POST',
      body:   JSON.stringify(data),
    })
  },

  updateStaff(restId: string, userId: string, data: Partial<DjangoUser>) {
    return apiRequest<DjangoUser>(`/restaurants/${restId}/staff/${userId}/`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    })
  },

  deleteStaff(restId: string, userId: string) {
    return apiRequest(`/restaurants/${restId}/staff/${userId}/`, { method: 'DELETE' })
  },

  // ── Аналитика ─────────────────────────────────────────────────────────────

  analyticsSummary(restId: string, from?: string, to?: string) {
    const q = new URLSearchParams()
    if (from) q.set('from', from)
    if (to)   q.set('to',   to)
    const qs = q.toString() ? `?${q}` : ''
    return apiRequest<{
      revenue: number
      sessions_count: number
      avg_check: number
      top_items: Array<{ item_name: string; total_qty: number; total_revenue: number }>
    }>(`/restaurants/${restId}/analytics/summary/${qs}`)
  },

  analyticsSessions(restId: string, from?: string, to?: string) {
    const q = new URLSearchParams()
    if (from) q.set('from', from)
    if (to)   q.set('to', to)
    const qs = q.toString() ? `?${q}` : ''
    return apiRequest<DjangoSession[]>(`/restaurants/${restId}/analytics/sessions/${qs}`)
  },

  // ── Guest (публичные — без JWT) ───────────────────────────────────────────

  /** Полная информация о столе + ресторан + меню по QR-токену */
  guestInfo(tableToken: string) {
    return apiRequest<GuestInfo>(`/guest/${tableToken}/`)
  },

  /** Активная сессия по токену стола */
  sessionByTable(tableToken: string) {
    return apiRequest<DjangoSession>(`/sessions/by-table/${tableToken}/`)
  },

  /** Запросить счёт (гостевой) */
  requestPaymentByToken(tableToken: string) {
    return apiRequest<DjangoSession>(`/sessions/by-table/${tableToken}/request-payment/`, {
      method: 'POST',
    })
  },

  /** Гость отменяет свою позицию, пока она ждёт подтверждения официантом */
  cancelGuestItem(tableToken: string, itemId: string) {
    return apiRequest<DjangoSession>(
      `/sessions/by-table/${tableToken}/items/${itemId}/cancel/`,
      { method: 'POST' },
    )
  },

  // ── Столы ─────────────────────────────────────────────────────────────────

  tables(restId: string) {
    return apiRequest<DjangoTable[]>(`/restaurants/${restId}/tables/`)
  },

  createTable(restId: string, number: number) {
    return apiRequest<DjangoTable>(`/restaurants/${restId}/tables/`, {
      method: 'POST',
      body:   JSON.stringify({ number }),
    })
  },

  deleteTable(restId: string, tableId: string) {
    return apiRequest(`/restaurants/${restId}/tables/${tableId}/`, { method: 'DELETE' })
  },

  /** Перегенерировать QR-токен стола (старый QR перестаёт работать). */
  regenerateTableToken(restId: string, tableId: string) {
    return apiRequest<DjangoTable>(
      `/restaurants/${restId}/tables/${tableId}/regenerate-token/`,
      { method: 'POST' },
    )
  },

  // ── Зоны зала (#6 zones) ──────────────────────────────────────────────────

  zones(restId: string) {
    return apiRequest<DjangoZone[]>(`/restaurants/${restId}/zones/`)
  },

  createZone(restId: string, data: { name: string; color?: string; sort_order?: number }) {
    return apiRequest<DjangoZone>(`/restaurants/${restId}/zones/`, {
      method: 'POST',
      body:   JSON.stringify(data),
    })
  },

  updateZone(restId: string, zoneId: string, data: { name?: string; color?: string; sort_order?: number }) {
    return apiRequest<DjangoZone>(`/restaurants/${restId}/zones/${zoneId}/`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    })
  },

  /** Удалить зону. БД сама обнуляет tables.zone (SET_NULL) и снимает M2M у официантов. */
  deleteZone(restId: string, zoneId: string) {
    return apiRequest(`/restaurants/${restId}/zones/${zoneId}/`, { method: 'DELETE' })
  },

  /** Массово перенести столы в зону. */
  moveTablesToZone(restId: string, zoneId: string, tableIds: string[]) {
    return apiRequest(`/restaurants/${restId}/zones/${zoneId}/tables/`, {
      method: 'POST',
      body:   JSON.stringify({ table_ids: tableIds }),
    })
  },

  /** Обновить зону стола (PATCH tables/<id>/, поле zone — PK зоны или null). */
  setTableZone(restId: string, tableId: string, zoneId: string | null) {
    return apiRequest<DjangoTable>(`/restaurants/${restId}/tables/${tableId}/`, {
      method: 'PATCH',
      body:   JSON.stringify({ zone: zoneId }),
    })
  },

  /** Гибридное назначение официанту: зоны целиком + отдельные столы. */
  assignStaffScope(restId: string, userId: string, data: { zone_ids: string[]; table_ids: string[] }) {
    return apiRequest<DjangoUser>(
      `/restaurants/${restId}/staff/${userId}/assignment/`,
      { method: 'POST', body: JSON.stringify(data) },
    )
  },

  // ── Вызовы официанта — обновление статуса ─────────────────────────────────

  updateWaiterCall(restId: string, callId: string, status: string) {
    return apiRequest<DjangoWaiterCall>(
      `/restaurants/${restId}/waiter-calls/${callId}/`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    )
  },

  // ── Активные сессии с правильным URL ──────────────────────────────────────

  activeSessionsV2(restId: string) {
    return apiRequest<DjangoSession[]>(`/restaurants/${restId}/sessions/active/`)
  },

  /** Обновить статус сессии (payment_requested, closed, etc.) */
  patchSessionStatus(restId: string, sessionId: string, status: string) {
    return apiRequest<DjangoSession>(
      `/restaurants/${restId}/sessions/${sessionId}/`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    )
  },

  // ── Доставка / самовывоз (персонал) ──────────────────────────────────────

  /** Список заказов на доставку/самовывоз. activeOnly=true — без завершённых/отменённых */
  deliveryOrders(restId: string, activeOnly = false) {
    const qs = activeOnly ? '?active=1' : ''
    return apiRequest<DjangoSession[]>(`/restaurants/${restId}/delivery-orders/${qs}`)
  },

  /** Обновить статус доставки/самовывоза заказа */
  updateDeliveryStatus(restId: string, sessionId: string, deliveryStatus: string) {
    return apiRequest<DjangoSession>(
      `/restaurants/${restId}/sessions/${sessionId}/delivery-status/`,
      { method: 'PATCH', body: JSON.stringify({ delivery_status: deliveryStatus }) },
    )
  },

  /** Назначить столы сотруднику */
  assignTables(restId: string, userId: string, tableIds: string[]) {
    return apiRequest<DjangoUser>(
      `/restaurants/${restId}/staff/${userId}/assign-tables/`,
      { method: 'POST', body: JSON.stringify({ table_ids: tableIds }) },
    )
  },

  // ── График смен (Pro) ────────────────────────────────────────────────────

  shifts(restId: string, from?: string, to?: string) {
    const qs = from && to ? `?from=${from}&to=${to}` : ''
    return apiRequest<DjangoShift[]>(`/restaurants/${restId}/schedule/shifts/${qs}`)
  },

  createShift(restId: string, data: { staff: string; date: string; start_time: string; end_time: string; note?: string }) {
    return apiRequest<DjangoShift>(`/restaurants/${restId}/schedule/shifts/`, {
      method: 'POST',
      body:   JSON.stringify(data),
    })
  },

  updateShift(restId: string, shiftId: string, data: Partial<{ staff: string; date: string; start_time: string; end_time: string; note: string }>) {
    return apiRequest<DjangoShift>(`/restaurants/${restId}/schedule/shifts/${shiftId}/`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    })
  },

  deleteShift(restId: string, shiftId: string) {
    return apiRequest<void>(`/restaurants/${restId}/schedule/shifts/${shiftId}/`, { method: 'DELETE' })
  },

  // ── Настройки ресторана (бренд / оформление) ─────────────────────────────
  // Доступно владельцу ресторана и superadmin (тех-поддержке).

  restaurantSettings(restId: string) {
    return apiRequest<DjangoRestaurant>(`/restaurants/${restId}/settings/`)
  },

  updateRestaurantSettings(restId: string, data: Partial<DjangoRestaurant>) {
    return apiRequest<DjangoRestaurant>(`/restaurants/${restId}/settings/`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    })
  },

  uploadRestaurantLogo(restId: string, file: File) {
    const form = new FormData()
    form.append('image', file)
    return apiRequest<DjangoRestaurant>(`/restaurants/${restId}/upload-logo/`, {
      method: 'POST', body: form,
    })
  },

  uploadRestaurantCover(restId: string, file: File) {
    const form = new FormData()
    form.append('image', file)
    return apiRequest<DjangoRestaurant>(`/restaurants/${restId}/upload-cover/`, {
      method: 'POST', body: form,
    })
  },

  // ── Интеграция iiko (Cloud API) ───────────────────────────────────────────
  // Доступно admin/manager ресторана и superadmin (тех-поддержке).

  iikoSettings(restId: string) {
    return apiRequest<IikoSettings>(`/restaurants/${restId}/iiko/`)
  },

  updateIikoSettings(restId: string, data: Partial<{
    iiko_enabled: boolean
    iiko_api_key: string
    iiko_organization_id: string
    iiko_external_menu_id: string
  }>) {
    return apiRequest<IikoSettings>(`/restaurants/${restId}/iiko/`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    })
  },

  /** Импортировать меню из iiko прямо сейчас. → {created, updated} */
  iikoSync(restId: string) {
    return apiRequest<{ created: number; updated: number }>(
      `/restaurants/${restId}/iiko/sync/`,
      { method: 'POST' },
    )
  },

  // ── Тех-панель (superadmin) ───────────────────────────────────────────────

  subscriptionPlans() {
    return apiRequest<SubscriptionPlan[]>('/billing/plans/')
  },

  superadminRestaurants() {
    return apiRequest<SuperAdminRestaurant[]>('/billing/restaurants/')
  },

  superadminRestaurant(restId: string) {
    return apiRequest<SuperAdminRestaurant>(`/billing/restaurants/${restId}/`)
  },

  superadminUpdateRestaurant(restId: string, data: Partial<SuperAdminRestaurant>) {
    return apiRequest<SuperAdminRestaurant>(`/billing/restaurants/${restId}/`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    })
  },

  /** Подключить новый ресторан к платформе. slug опционален — сгенерируется из названия */
  superadminCreateRestaurant(data: {
    name: string; slug?: string; address?: string; working_hours?: string; is_public?: boolean
  }) {
    return apiRequest<SuperAdminRestaurant>('/billing/restaurants/', {
      method: 'POST',
      body:   JSON.stringify(data),
    })
  },

  // ── Групповой чат персонала (тариф chat) ──────────────────────────────────

  /** Сообщения группового чата. after — ISO-время для инкрементальной подгрузки */
  chatMessages(restId: string, after?: string) {
    const qs = after ? `?after=${encodeURIComponent(after)}` : ''
    return apiRequest<DjangoChatMessage[]>(`/restaurants/${restId}/chat/messages/${qs}`)
  },

  /** Отправить сообщение в групповой чат */
  sendChatMessage(restId: string, text: string) {
    return apiRequest<DjangoChatMessage>(`/restaurants/${restId}/chat/messages/`, {
      method: 'POST',
      body:   JSON.stringify({ text }),
    })
  },

  /** Закрепить / открепить сообщение (до 5 закреплённых на ресторан) */
  pinChatMessage(restId: string, messageId: string, isPinned: boolean) {
    return apiRequest<DjangoChatMessage>(`/restaurants/${restId}/chat/messages/${messageId}/pin/`, {
      method: 'PATCH',
      body:   JSON.stringify({ is_pinned: isPinned }),
    })
  },

  /** Удалить сообщение (своё — любой; чужое — админ/менеджер) */
  deleteChatMessage(restId: string, messageId: string) {
    return apiRequest<void>(`/restaurants/${restId}/chat/messages/${messageId}/`, { method: 'DELETE' })
  },
}

// ── TypeScript types for Django responses ─────────────────────────────────────

export interface DjangoRestaurant {
  id: string
  name: string
  slug: string
  address: string
  working_hours: string
  rating: number | null
  tags?: string[]
  cover_image_url: string
  logo_url?: string
  theme?: 'dark' | 'light'
  accent_color?: string
  latitude?: number | null
  longitude?: number | null
  service_charge_percent: number
  allow_waiter_close: boolean
  kaspi_pay_url?: string
  panorama_url?: string
  is_public: boolean
  delivery_fee?: string | number
  delivery_min_order?: string | number
  schedule_visibility?: 'own' | 'all'
  order_confirmation_enabled?: boolean
  order_reminder_after_sec?: number
  order_escalate_after_sec?: number
  order_auto_action?: 'none' | 'auto_confirm' | 'auto_reject'
  features?: RestaurantFeatures
}

export interface RestaurantFeatures {
  delivery: boolean
  online_orders: boolean
  waiter_calls: boolean
  analytics: boolean
  kaspi_pay: boolean
  schedule: boolean
  chat: boolean
}

export interface DjangoChatMessage {
  id: string
  sender: string | null
  sender_name: string
  sender_role: string
  text: string
  is_pinned: boolean
  pinned_at: string | null
  created_at: string
}

export interface DjangoShift {
  id: string
  staff: string
  staff_name: string
  staff_role: string
  date: string
  start_time: string
  end_time: string
  note: string
  created_at: string
  updated_at: string
}

export interface SubscriptionPlan {
  id: string
  code: string
  name: string
  description: string
  price: string
  billing_period_days: number
  max_tables: number | null
  max_staff: number | null
  delivery_enabled: boolean
  online_orders_enabled: boolean
  waiter_calls_enabled: boolean
  analytics_enabled: boolean
  kaspi_pay_enabled: boolean
  priority_support: boolean
  schedule_enabled: boolean
  chat_enabled: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SubscriptionPlanBrief {
  id: string
  code: string
  name: string
  price: string
}

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended'

export interface SuperAdminRestaurant {
  id: string
  name: string
  slug: string
  address: string
  working_hours: string
  cover_image_url: string
  logo_url: string
  theme: 'dark' | 'light'
  accent_color: string
  is_public: boolean
  subscription_plan: string | null
  subscription_plan_detail: SubscriptionPlanBrief | null
  subscription_status: SubscriptionStatus
  subscription_expires_at: string | null
  tables_count: number
  staff_count: number
  kaspi_pay_url: string
  created_at: string
  updated_at: string
}

export interface IikoSettings {
  id: string
  iiko_enabled: boolean
  /** true, если ключ уже сохранён (сам ключ наружу не отдаётся) */
  iiko_api_key_set: boolean
  iiko_organization_id: string
  iiko_external_menu_id: string
}

export interface DjangoCategory {
  id: string
  name: string
  sort_order: number
}

export interface DjangoMenuItem {
  id: string
  name: string
  description: string
  price: string
  final_price?: string
  image_url: string
  video_url: string
  emoji: string
  weight: string
  badge: string | null
  discount_percent: number
  preparation_station: 'kitchen' | 'bar'
  is_available: boolean
  is_visible: boolean
  sort_order: number
  category: DjangoCategory | null
  category_id?: string | null
}

export type OrderType = 'dine_in' | 'delivery' | 'pickup'
export type DeliveryStatus = '' | 'new' | 'confirmed' | 'preparing' | 'on_the_way' | 'ready_for_pickup' | 'completed' | 'cancelled'

export interface DjangoSession {
  id: string
  table_number: number | null
  table_token?: string
  order_type: OrderType
  status: string
  items: DjangoSessionItem[]
  subtotal_amount: string
  service_charge_percent?: number
  service_charge_amount: string
  delivery_fee: string
  total_amount: string
  payment_method: string
  customer_name?: string
  customer_phone?: string
  delivery_address?: string
  delivery_comment?: string
  delivery_status?: DeliveryStatus
  created_at: string
  updated_at: string
  closed_at: string | null
}

export interface DjangoSessionItem {
  id: string
  item_name: string
  price: string
  quantity: number
  status: string
  preparation_station: string
  note: string
  added_by: string
  created_at: string
  ready_at: string | null
  served_at: string | null
}

export interface DjangoUser {
  id: string
  email: string
  name: string
  role: string
  is_active: boolean
  created_at: string
  assigned_tables?: string[]
  assigned_zones?: string[]
  effective_table_ids?: string[]
}

export interface DjangoWaiterCall {
  id: string
  table_number: number
  table_token: string
  status: string
  reason: string
  created_at: string
  updated_at: string
}

export interface DjangoTable {
  id: string
  number: number
  token: string
  is_active: boolean
  zone?: string | null
  qr_url?: string
}

export interface DjangoZone {
  id: string
  name: string
  color?: string
  sort_order?: number
  created_at?: string
}

export function mapDjangoZone(z: DjangoZone): Zone {
  return {
    id: z.id,
    name: z.name,
    color: z.color || undefined,
    sortOrder: z.sort_order ?? 0,
  }
}

export interface GuestInfo {
  table: { id: string; number: number; token: string }
  restaurant: DjangoRestaurant
  categories: DjangoCategory[]
  menu_items: DjangoMenuItem[]
}

/** Преобразовать ресторан из формата Django (snake_case) в формат фронтенда (camelCase) */
export function mapDjangoRestaurant(r: DjangoRestaurant): Restaurant {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    address: r.address,
    workingHours: r.working_hours,
    rating: r.rating ?? undefined,
    tags: r.tags,
    coverImageUrl: r.cover_image_url || undefined,
    logoUrl: r.logo_url || undefined,
    latitude: r.latitude ?? undefined,
    longitude: r.longitude ?? undefined,
    serviceChargePercent: r.service_charge_percent,
    allowWaiterClose: r.allow_waiter_close,
    theme: r.theme,
    accentColor: r.accent_color,
    panoramaUrl: r.panorama_url,
    isPublic: r.is_public,
    delivery_fee: r.delivery_fee,
    delivery_min_order: r.delivery_min_order,
    features: r.features,
    orderConfirmation: {
      enabled: r.order_confirmation_enabled ?? false,
      reminderAfterSec: r.order_reminder_after_sec ?? 60,
      escalateAfterSec: r.order_escalate_after_sec ?? 180,
      autoAction: r.order_auto_action ?? 'none',
    },
  }
}

/** Преобразовать блюдо из формата Django (snake_case) в формат фронтенда (camelCase) */
export function mapDjangoMenuItem(m: DjangoMenuItem): MenuItem {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    price: Number(m.price),
    imageUrl: m.image_url || undefined,
    videoUrl: m.video_url || undefined,
    emoji: m.emoji,
    weight: m.weight,
    categoryId: m.category?.id ?? m.category_id ?? undefined,
    isAvailable: m.is_available,
    isVisible: m.is_visible,
    badge: (m.badge || null) as MenuItem['badge'],
    discountPercent: m.discount_percent,
    preparationStation: m.preparation_station,
    sortOrder: m.sort_order,
  }
}

/** Преобразовать сессию из формата Django (snake_case) в формат фронтенда (camelCase) */
export function mapDjangoSession(s: DjangoSession): TableSession {
  return {
    id: s.id,
    tableNumber: s.table_number,
    tableToken: s.table_token ?? '',
    orderType: s.order_type,
    status: s.status as TableSession['status'],
    items: (s.items ?? []).map(i => ({
      id: i.id,
      menuItemId: '',
      itemName: i.item_name,
      price: parseFloat(i.price),
      quantity: i.quantity,
      status: i.status as any,
      preparationStation: i.preparation_station,
      note: i.note,
      addedBy: i.added_by,
      readyAt: i.ready_at ? new Date(i.ready_at).getTime() : undefined,
      servedAt: i.served_at ? new Date(i.served_at).getTime() : undefined,
      createdAt: new Date(i.created_at).getTime(),
    })),
    subtotalAmount: parseFloat(s.subtotal_amount ?? '0'),
    serviceChargePercent: s.service_charge_percent ?? 0,
    serviceChargeAmount: parseFloat(s.service_charge_amount ?? '0'),
    deliveryFee: parseFloat(s.delivery_fee ?? '0'),
    totalAmount: parseFloat(s.total_amount ?? '0'),
    paymentMethod: (s.payment_method || undefined) as TableSession['paymentMethod'],
    customerName: s.customer_name ?? '',
    customerPhone: s.customer_phone ?? '',
    deliveryAddress: s.delivery_address ?? '',
    deliveryComment: s.delivery_comment ?? '',
    deliveryStatus: s.delivery_status ?? '',
    createdAt: new Date(s.created_at).getTime(),
    updatedAt: new Date(s.updated_at).getTime(),
    closedAt: s.closed_at ? new Date(s.closed_at).getTime() : null,
  }
}

/** Преобразовать сообщение чата из формата Django (snake_case) в camelCase */
export function mapDjangoChatMessage(m: DjangoChatMessage): ChatMessage {
  return {
    id: m.id,
    senderId: m.sender,
    senderName: m.sender_name,
    senderRole: m.sender_role,
    text: m.text,
    isPinned: m.is_pinned,
    pinnedAt: m.pinned_at ? new Date(m.pinned_at).getTime() : null,
    createdAt: new Date(m.created_at).getTime(),
  }
}

/** Преобразовать смену из формата Django (snake_case) в формат фронтенда (camelCase) */
export function mapDjangoShift(s: DjangoShift): Shift {
  return {
    id: s.id,
    staff: s.staff,
    staffName: s.staff_name,
    staffRole: s.staff_role,
    date: s.date,
    startTime: s.start_time,
    endTime: s.end_time,
    note: s.note,
  }
}

// ── WebSocket URL helper ──────────────────────────────────────────────────────
// Converts http(s):// base URL to ws(s):// and strips /api/v1 suffix.

export function wsUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1')
    .replace(/\/api\/v1\/?$/, '')
    .replace(/^http/, 'ws')
  return `${base}/ws${path}`
}

function accessTokenNeedsRefresh(token: string | null, skewSeconds = 30): boolean {
  if (!token) return true
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return true
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { exp?: number }
    if (typeof payload.exp !== 'number') return true
    return payload.exp <= Math.floor(Date.now() / 1000) + skewSeconds
  } catch {
    return true
  }
}

/**
 * Возвращает актуальный access token для WebSocket handshake.
 * REST умеет refresh по 401, а WebSocket — нет: expired JWT просто закрывает
 * handshake с 4401. Поэтому перед каждым staff reconnect заранее проверяем exp
 * и при необходимости используем тот же дедуплицированный refresh flow.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const current = tokenStore.getAccess()
  if (!accessTokenNeedsRefresh(current)) return current
  if (!tokenStore.getRefresh()) return null
  return _refreshAccess()
}

/** WebSocket для кухни/официанта: ws/staff/<restId>/?token=<JWT> */
export async function staffWsUrl(restId: string): Promise<string | null> {
  const token = await getValidAccessToken()
  if (!token) return null
  return wsUrl(`/staff/${restId}/`) + `?token=${encodeURIComponent(token)}`
}

/** WebSocket для гостя: ws/guest/<tableToken>/ */
export function guestWsUrl(tableToken: string): string {
  return wsUrl(`/guest/${tableToken}/`)
}
