export interface RestaurantFeatures {
  delivery: boolean
  online_orders: boolean
  waiter_calls: boolean
  analytics: boolean
  kaspi_pay: boolean
  schedule: boolean
  chat: boolean
}

export interface ChatMessage {
  id: string
  senderId: string | null
  senderName: string
  senderRole: string
  text: string
  isPinned: boolean
  pinnedAt: number | null
  createdAt: number
}

export interface Restaurant {
  id: string
  name: string
  slug: string
  address?: string
  workingHours?: string
  rating?: number
  tags?: string[]
  coverImageUrl?: string
  logoUrl?: string
  latitude?: number
  longitude?: number
  serviceChargePercent?: number
  allowWaiterClose?: boolean
  theme?: string
  accentColor?: string
  panoramaUrl?: string
  isPublic?: boolean
  // Доставка / самовывоз — приходят как есть из Django (snake_case)
  delivery_fee?: string | number
  delivery_min_order?: string | number
  schedule_visibility?: 'own' | 'all'
  features?: RestaurantFeatures
  orderConfirmation?: {
    enabled: boolean
    reminderAfterSec: number
    escalateAfterSec: number
    autoAction: 'none' | 'auto_confirm' | 'auto_reject'
  }
}

export interface Shift {
  id: string
  staff: string
  staffName?: string
  staffRole?: string
  date: string        // YYYY-MM-DD
  startTime: string    // HH:MM:SS
  endTime: string      // HH:MM:SS
  note?: string
}

export interface Category {
  id: string
  name: string
  sortOrder?: number
}

export interface Zone {
  id: string
  name: string
  color?: string
  sortOrder?: number
}

export interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  videoUrl?: string
  emoji?: string
  weight?: string
  categoryId?: string
  isAvailable?: boolean
  isVisible?: boolean
  badge?: 'hit' | 'new' | 'sale' | null
  discountPercent?: number
  preparationStation?: 'kitchen' | 'bar'
  sortOrder?: number
}

export interface SessionItem {
  id?: string
  menuItemId: string
  itemName: string
  price: number
  quantity: number
  // Целевая модель: 'awaiting_confirmation' | 'confirmed' | 'ready' | 'served' | 'rejected' | 'cancelled'.
  // Legacy-значения оставлены на переходный период — см. frontend/src/lib/itemStatus.ts normalizeStatus().
  status: 'awaiting_confirmation' | 'confirmed' | 'ready' | 'served' | 'rejected' | 'cancelled'
    | 'pending' | 'delivered' | 'waiter_confirmed' | 'sent_to_kitchen' | 'sent_to_bar'
  preparationStation?: string
  note?: string
  createdAt?: number
  readyAt?: number
  servedAt?: number
  confirmedAt?: number
  rejectedAt?: number
  confirmedBy?: string
  rejectReason?: string
  addedBy?: string
}

export type OrderType = 'dine_in' | 'delivery' | 'pickup'
export type DeliveryStatus = '' | 'new' | 'confirmed' | 'preparing' | 'on_the_way' | 'ready_for_pickup' | 'completed' | 'cancelled'

export interface TableSession {
  id: string
  restaurantId?: string
  tableId?: string
  tableNumber: number | null
  tableToken: string
  orderType?: OrderType
  zoneId?: string | null
  zoneName?: string
  status: 'open' | 'closed' | 'awaiting_payment' | 'payment_requested'
  items: SessionItem[]
  subtotalAmount: number
  serviceChargePercent: number
  serviceChargeAmount: number
  deliveryFee?: number
  totalAmount: number
  paymentMethod?: 'cash' | 'card'
  customerName?: string
  customerPhone?: string
  deliveryAddress?: string
  deliveryComment?: string
  deliveryStatus?: DeliveryStatus
  createdAt: number
  updatedAt: number
  closedAt?: number | null
}

export interface Table {
  id: string
  number: number
  token: string
  isActive?: boolean
  zoneId?: string | null
}

export interface WaiterCall {
  restaurantId: string
  tableId: string
  tableNumber: number
  tableToken: string
  status: 'new' | 'accepted' | 'closed'
  reason?: string
  createdAt: number
}

export interface Promo {
  id: string
  restaurantId: string
  restaurantName?: string
  title: string
  description?: string
  validUntil?: string
  isActive?: boolean
}

export type CartMap = Record<string, number>

export type Screen = 'home' | 'restaurant' | 'qr' | 'table' | 'map' | 'promos' | 'owners' | 'checkout' | 'order-tracking'

export type Lang = 'ru' | 'kk' | 'en' | 'zh' | 'tr' | 'ko'