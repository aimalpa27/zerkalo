/**
 * useKitchenSessions — загружает активные заказы через Django REST API + WebSocket.
 * Данные через Django REST API + WebSocket.
 */
import { useEffect, useRef } from 'react'
import { api, staffWsUrl } from '../../lib/api'
import { useKitchenStore } from '../store'
import { useAudioAlert } from './useAudioAlert'
import { normalizeStatus, isKitchenVisible } from '../../lib/itemStatus'

const normalizeSession = (s: any) => ({
  id: s.id,
  tableNumber: s.table_number,
  tableToken: s.table_token ?? '',
  status: s.status,
  items: (s.items ?? []).map((i: any) => ({
    id: i.id,
    itemName: i.item_name,
    price: parseFloat(i.price),
    quantity: i.quantity,
    status: i.status,
    note: i.note,
    addedBy: i.added_by,
    preparationStation: i.preparation_station,
  })),
  subtotalAmount: parseFloat(s.subtotal_amount ?? '0'),
  serviceChargePercent: s.service_charge_percent ?? 10,
  serviceChargeAmount: parseFloat(s.service_charge_amount ?? '0'),
  totalAmount: parseFloat(s.total_amount ?? '0'),
  createdAt: new Date(s.created_at).getTime(),
  updatedAt: new Date(s.updated_at).getTime(),
})

// Считаем только позиции, видимые кухне (confirmed — подтверждённые официантом) —
// 'awaiting_confirmation' ещё ждёт подтверждения официанта и не должно вызывать
// звуковое уведомление, пока позиция не появится на кухонной доске. Единая
// семантика — см. lib/itemStatus.ts (normalizeStatus + isKitchenVisible).
function visibleItemsCount(session: { items?: { status: string }[] }) {
  return (session.items ?? []).filter(i =>
    isKitchenVisible(normalizeStatus(i.status))
  ).length
}

export function useKitchenSessions() {
  const { restId, setSessions, setScreen, setLoadState, setLastUpdatedAt } = useKitchenStore()
  const playAlert = useAudioAlert()

  const wsRef         = useRef<WebSocket | null>(null)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef  = useRef(false)
  const isFirstRef    = useRef(true)
  const prevItemsRef  = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (!restId) return

    cancelledRef.current = false
    isFirstRef.current   = true
    prevItemsRef.current = new Map()

    wsRef.current?.close()
    if (intervalRef.current) clearInterval(intervalRef.current)

    const loadSessions = async () => {
      if (cancelledRef.current) return
      const firstLoad = isFirstRef.current
      if (firstLoad) setLoadState('loading')
      try {
        const data = await api.activeSessionsV2(restId)
        if (cancelledRef.current) return

        const incoming = data.map(normalizeSession)

        if (!isFirstRef.current) {
          const hasMoreItems = incoming.some(
            s => visibleItemsCount(s) > (prevItemsRef.current.get(s.id) ?? 0)
          )
          if (hasMoreItems) playAlert()
        }

        isFirstRef.current = false
        prevItemsRef.current = new Map(incoming.map(s => [s.id, visibleItemsCount(s)]))

        setSessions(incoming as any)
        setLastUpdatedAt(Date.now())
        setLoadState('ready')
        setScreen('board')
      } catch (e: any) {
        console.warn('[Kitchen] loadSessions error:', e)
        const message = e?.message === 'SESSION_EXPIRED'
          ? 'Сессия истекла. Войдите снова.'
          : 'Не удалось загрузить заказы. Проверьте интернет и повторите.'
        setLoadState('error', message)
        // Если это первая загрузка, выводим board с явным retry-state вместо
        // бесконечного экрана «Подключение...». При последующих сбоях сохраняем
        // последние успешные карточки и показываем non-destructive error banner.
        if (firstLoad) setScreen('board')
      }
    }

    loadSessions()
    intervalRef.current = setInterval(loadSessions, 8_000)

    // WebSocket для мгновенных обновлений
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempt = 0

    const connectWs = async () => {
      if (cancelledRef.current) return
      try {
        const url = await staffWsUrl(restId)
        if (cancelledRef.current) return
        if (!url) {
          // Refresh-сессии больше нет: polling продолжает работать, а бесконечный
          // цикл rejected WebSocket handshakes не запускаем.
          return
        }

        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => { reconnectAttempt = 0 }
        ws.onmessage = () => loadSessions()
        ws.onclose = () => {
          if (cancelledRef.current) return
          const delay = Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempt, 5))
          reconnectAttempt += 1
          reconnectTimer = setTimeout(connectWs, delay)
        }
        ws.onerror = () => ws.close()
      } catch {
        if (!cancelledRef.current) {
          const delay = Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempt, 5))
          reconnectAttempt += 1
          reconnectTimer = setTimeout(connectWs, delay)
        }
      }
    }

    void connectWs()

    return () => {
      cancelledRef.current = true
      wsRef.current?.close()
      wsRef.current = null
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [restId, playAlert, setLastUpdatedAt, setLoadState, setScreen, setSessions])
}
