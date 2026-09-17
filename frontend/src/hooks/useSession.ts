/**
 * useSession — отслеживает активную сессию стола.
 * Источники данных:
 *   1. REST API polling каждые 8 сек
 *   2. WebSocket ws/guest/<table_token>/ для мгновенных обновлений
 */
import { useEffect } from 'react'
import { api, guestWsUrl } from '../lib/api'
import { useStore } from '../store/useStore'

export function useSession(_restaurantId: string | null, _tableId: string | null) {
  const { set, tableToken, addListener } = useStore()

  useEffect(() => {
    if (!tableToken) return

    let cancelled = false
    let ws: WebSocket | null = null
    let pollInterval: ReturnType<typeof setInterval> | null = null

    // Нормализует Django-сессию в формат приложения
    const normalizeSession = (s: any) => ({
      id: s.id,
      tableNumber: s.table_number,
      tableToken: s.table_token ?? tableToken,
      orderType: s.order_type ?? 'dine_in',
      status: s.status,
      items: (s.items ?? []).map((i: any) => ({
        id: i.id,
        itemName: i.item_name,
        price: parseFloat(i.price),
        quantity: i.quantity,
        status: i.status,
        note: i.note,
        addedBy: i.added_by,
      })),
      subtotalAmount: parseFloat(s.subtotal_amount ?? '0'),
      serviceChargePercent: s.service_charge_percent ?? 10,
      serviceChargeAmount: parseFloat(s.service_charge_amount ?? '0'),
      deliveryFee: parseFloat(s.delivery_fee ?? '0'),
      totalAmount: parseFloat(s.total_amount ?? '0'),
      paymentMethod: s.payment_method ?? '',
      customerName: s.customer_name ?? '',
      customerPhone: s.customer_phone ?? '',
      deliveryAddress: s.delivery_address ?? '',
      deliveryComment: s.delivery_comment ?? '',
      deliveryStatus: s.delivery_status ?? '',
      createdAt: new Date(s.created_at).getTime(),
      updatedAt: new Date(s.updated_at).getTime(),
      closedAt: s.closed_at ? new Date(s.closed_at).getTime() : null,
    })

    const loadSession = async () => {
      try {
        const s = await api.sessionByTable(tableToken)
        if (!cancelled) set({ activeSession: normalizeSession(s) })
      } catch (e: any) {
        if (e?.status === 404 && !cancelled) set({ activeSession: null })
      }
    }

    // 1. Начальная загрузка
    loadSession()

    // 2. Polling каждые 8 сек
    pollInterval = setInterval(loadSession, 8_000)

    // 3. WebSocket для мгновенных обновлений
    const connectWs = () => {
      try {
        ws = new WebSocket(guestWsUrl(tableToken))

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            // При любом событии от сервера — перезагружаем сессию
            if (['order_confirmed', 'item_ready', 'session_status_changed', 'delivery_status_changed'].includes(msg.type)) {
              loadSession()
            }
          } catch {}
        }

        ws.onclose = () => {
          if (!cancelled) {
            // Переподключение через 3 сек
            setTimeout(connectWs, 3_000)
          }
        }

        ws.onerror = () => ws?.close()
      } catch {}
    }

    connectWs()

    const cleanup = () => {
      cancelled = true
      ws?.close()
      if (pollInterval) clearInterval(pollInterval)
    }

    addListener(cleanup)
    return cleanup
  }, [tableToken])
}
