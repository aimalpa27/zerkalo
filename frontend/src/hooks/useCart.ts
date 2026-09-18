/**
 * useCart — корзина и оформление заказа через Django REST API.
 * Пишет через Django REST API.
 */
import { api } from '../lib/api'
import { clearCartDraft, useStore } from '../store/useStore'

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export function useCart() {
  const store = useStore()

  const addItem = (id: string) => {
    store.set({ cart: { ...store.cart, [id]: (store.cart[id] ?? 0) + 1 } })
  }

  const decItem = (id: string) => {
    const next = { ...store.cart }
    if (!next[id]) return
    next[id]--
    if (!next[id]) delete next[id]
    store.set({ cart: next })
  }

  const cartTotal = () => {
    return Object.entries(store.cart).reduce((sum, [id, qty]) => {
      const item = store.menuItems.find(i => i.id === id) as any
      if (!item) return sum
      const price = (item.final_price ?? item.price) as number
      return sum + price * qty
    }, 0)
  }

  const cartCount = () => Object.values(store.cart).reduce((s, q) => s + q, 0)

  const checkGeo = (rest: any) =>
    new Promise<{ ok: boolean; dist?: number; denied?: boolean }>((resolve) => {
      if (!rest.latitude || !rest.longitude) return resolve({ ok: true })
      if (!navigator.geolocation) return resolve({ ok: true })
      navigator.geolocation.getCurrentPosition(
        pos => {
          const dist = haversine(pos.coords.latitude, pos.coords.longitude, rest.latitude!, rest.longitude!)
          resolve(dist <= 100 ? { ok: true, dist } : { ok: false, dist: Math.round(dist) })
        },
        err => resolve({ ok: false, denied: err.code === 1 }),
        { timeout: 6000, maximumAge: 30000 }
      )
    })

  const placeOrder = async (paymentMethod: 'cash' | 'card' = 'cash', redeemLoyalty = false) => {
    const rest = store.tableRestaurant as any
    if (!rest || !store.tableToken) return { error: 'Нет подключения к столу' }

    const cartEntries = Object.entries(store.cart).filter(([, q]) => q > 0)
    if (!cartEntries.length) return { error: 'Корзина пуста' }

    const geo = await checkGeo(rest)
    if (!geo.ok) {
      if (geo.denied) return { error: 'Разрешите доступ к геолокации' }
      return { error: `Заказ только в ресторане. Вы в ${geo.dist} м` }
    }

    // Формируем items для Django API — menu_item_id это Django UUID
    const items = cartEntries.map(([id, quantity]) => {
      const item = store.menuItems.find(i => i.id === id) as any
      return {
        menu_item_id: id,
        quantity,
        note: store.cartNotes[id] ?? '',
        ...(store.upsellAttribution[id] ? { upsell_rule_id: store.upsellAttribution[id] } : {}),
      }
    })

    try {
      const loyaltyKey = `plait_loyalty_${rest.id}`
      let loyaltyToken = localStorage.getItem(loyaltyKey)
      if (!loyaltyToken) {
        loyaltyToken = crypto.randomUUID()
        localStorage.setItem(loyaltyKey, loyaltyToken)
      }
      await api.placeOrder({
        table_token: store.tableToken,
        payment_method: paymentMethod,
        loyalty_token: loyaltyToken,
        redeem_loyalty: redeemLoyalty,
        items,
      })
      clearCartDraft()
      store.set({ cart: {}, cartNotes: {}, upsellAttribution: {} })
      return { ok: true }
    } catch (e: any) {
      return { error: e?.data?.detail ?? e?.message ?? 'Ошибка заказа' }
    }
  }

  /** Оформить заказ на доставку или самовывоз (без стола) */
  const placeDeliveryOrder = async (params: {
    orderType: 'delivery' | 'pickup'
    customerName: string
    customerPhone: string
    deliveryAddress?: string
    deliveryComment?: string
    paymentMethod?: 'cash' | 'card'
  }) => {
    const rest = store.currentRestaurant as any
    if (!rest?.id) return { error: 'Ресторан не найден' }

    const cartEntries = Object.entries(store.cart).filter(([, q]) => q > 0)
    if (!cartEntries.length) return { error: 'Корзина пуста' }

    if (!params.customerName.trim()) return { error: 'Укажите имя' }
    if (!params.customerPhone.trim()) return { error: 'Укажите номер телефона' }
    if (params.orderType === 'delivery' && !params.deliveryAddress?.trim()) {
      return { error: 'Укажите адрес доставки' }
    }

    const minOrder = Number(rest.delivery_min_order ?? 0)
    if (params.orderType === 'delivery' && minOrder > 0 && cartTotal() < minOrder) {
      return { error: `Минимальная сумма заказа для доставки — ${minOrder.toLocaleString('ru')} ₸` }
    }

    const items = cartEntries.map(([id, quantity]) => ({
      menu_item_id: id,
      quantity,
      note: store.cartNotes[id] ?? '',
    }))

    try {
      const session = await api.placeDeliveryOrder({
        restaurant_id: rest.id,
        order_type: params.orderType,
        customer_name: params.customerName.trim(),
        customer_phone: params.customerPhone.trim(),
        delivery_address: params.deliveryAddress?.trim() ?? '',
        delivery_comment: params.deliveryComment?.trim() ?? '',
        payment_method: params.paymentMethod ?? 'cash',
        items,
      })
      clearCartDraft()
      store.set({ cart: {}, cartNotes: {}, upsellAttribution: {} })
      return { ok: true, session }
    } catch (e: any) {
      const msg =
        e?.data?.detail ??
        e?.data?.items?.[0] ??
        e?.data?.delivery_address?.[0] ??
        e?.data?.customer_name?.[0] ??
        e?.data?.customer_phone?.[0] ??
        e?.message ?? 'Ошибка оформления заказа'
      return { error: msg }
    }
  }

  return { addItem, decItem, cartTotal, cartCount, placeOrder, placeDeliveryOrder }
}
