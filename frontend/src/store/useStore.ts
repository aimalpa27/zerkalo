import { create } from 'zustand'
import type { Restaurant, Category, MenuItem, TableSession, Table, Promo, CartMap, Screen, Lang } from '../types'

interface AppState {
  // Данные
  restaurants: Restaurant[]
  promos: Promo[]
  categories: Category[]
  menuItems: MenuItem[]
  upsellRules: Array<{ id: string; trigger_item_id: string; recommended_item_id: string; priority: number }>
  menuLoadState: 'idle' | 'loading' | 'ready' | 'error'
  menuLoadError: string | null
  menuLastUpdatedAt: number | null
  menuReloadNonce: number

  // Текущий контекст
  currentRestaurant: Restaurant | null
  selectedCat: string | null

  // Стол
  tableRestaurant: Restaurant | null
  tableId: string | null
  tableNumber: number | null
  tableToken: string | null
  activeSession: TableSession | null

  // Навигация
  currentScreen: Screen
  prevScreen: Screen

  // Корзина
  cart: CartMap
  cartNotes: Record<string, string>
  upsellAttribution: Record<string, string>

  // UI
  lang: Lang
  theme: 'dark' | 'light'
  paymentMethod: 'cash' | 'card'
  cartOpen: boolean
  dishModalItem: MenuItem | null

  // Доставка / самовывоз (оформление заказа без стола)
  checkoutOrderType: 'delivery' | 'pickup'
  customerName: string
  customerPhone: string
  deliveryAddress: string
  deliveryComment: string

  // Cleanup functions (WebSocket / intervals)
  listeners: (() => void)[]
  restListeners: (() => void)[]

  // Сеттеры
  set: (patch: Partial<AppState>) => void
  addListener: (unsub: () => void) => void
  addRestListener: (unsub: () => void) => void
  clearListeners: () => void
  clearRestListeners: () => void
}

export const useStore = create<AppState>((set, get) => ({
  restaurants:       [],
  promos:            [],
  categories:        [],
  menuItems:         [],
  upsellRules:        [],
  menuLoadState:     'idle',
  menuLoadError:     null,
  menuLastUpdatedAt: null,
  menuReloadNonce:   0,
  currentRestaurant: null,
  selectedCat:       null,
  tableRestaurant:   null,
  tableId:           null,
  tableNumber:       null,
  tableToken:        null,
  activeSession:     null,
  currentScreen:     'home',
  prevScreen:        'home',
  cart:              {},
  cartNotes:         {},
  upsellAttribution: {},
  lang:              (localStorage.getItem('cafe_lang') as Lang) || 'ru',
  theme:             (localStorage.getItem('cafe_theme') as 'dark' | 'light') || 'dark',
  paymentMethod:     'cash',
  cartOpen:          false,
  dishModalItem:     null,
  checkoutOrderType: 'pickup',
  customerName:      '',
  customerPhone:     '',
  deliveryAddress:   '',
  deliveryComment:   '',
  listeners:         [],
  restListeners:     [],

  set: (patch) => set(patch),

  addListener: (unsub) => set(s => ({ listeners: [...s.listeners, unsub] })),

  addRestListener: (unsub) => set(s => ({ restListeners: [...s.restListeners, unsub] })),

  clearListeners: () => {
    get().listeners.forEach(u => u())
    set({ listeners: [] })
  },

  clearRestListeners: () => {
    get().restListeners.forEach(u => u())
    set({ restListeners: [] })
  },
}))

const CART_DRAFT_KEY = 'plait_guest_cart_v1'

type CartDraft = {
  restaurantId: string
  tableToken: string | null
  cart: CartMap
  cartNotes: Record<string, string>
  upsellAttribution: Record<string, string>
  savedAt: number
}

function readCartDraft(): CartDraft | null {
  try {
    const raw = localStorage.getItem(CART_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CartDraft
    if (!parsed?.restaurantId || !parsed?.cart || Date.now() - Number(parsed.savedAt || 0) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CART_DRAFT_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearCartDraft() {
  try { localStorage.removeItem(CART_DRAFT_KEY) } catch { /* ignore restricted storage */ }
}

export function restoreCartDraft(restaurantId: string, tableToken: string | null, menuItems: MenuItem[]) {
  const draft = readCartDraft()
  if (!draft || draft.restaurantId !== restaurantId) return null
  // A table draft belongs to that exact QR token. Restaurant browsing drafts have no table token.
  if ((draft.tableToken || tableToken) && draft.tableToken !== tableToken) return null
  const allowed = new Set(menuItems.map(item => item.id))
  const cart: CartMap = {}
  const cartNotes: Record<string, string> = {}
  const upsellAttribution: Record<string, string> = {}
  Object.entries(draft.cart).forEach(([id, qty]) => {
    if (allowed.has(id) && qty > 0) {
      cart[id] = qty
      if (draft.cartNotes[id]) cartNotes[id] = draft.cartNotes[id]
      if (draft.upsellAttribution?.[id]) upsellAttribution[id] = draft.upsellAttribution[id]
    }
  })
  return { cart, cartNotes, upsellAttribution }
}

// Persist only meaningful guest drafts. This protects a cart from refresh/network failures without
// leaking one restaurant/table's cart into another context.
useStore.subscribe((state) => {
  try {
    const restaurantId = state.tableRestaurant?.id ?? state.currentRestaurant?.id ?? null
    const hasCart = Object.values(state.cart).some(qty => qty > 0)
    if (!restaurantId || !hasCart) return
    const draft: CartDraft = {
      restaurantId,
      tableToken: state.tableToken,
      cart: state.cart,
      cartNotes: state.cartNotes,
      upsellAttribution: state.upsellAttribution,
      savedAt: Date.now(),
    }
    localStorage.setItem(CART_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Storage can be unavailable in private/restricted browsers; cart still works in memory.
  }
})
