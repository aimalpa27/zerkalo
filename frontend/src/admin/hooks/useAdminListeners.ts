/**
 * useAdminListeners — загружает данные через Django REST API + WebSocket.
 * Данные через Django REST API + WebSocket.
 *
 * Схема:
 *   - Начальная загрузка всех данных через REST API
 *   - WebSocket ws/staff/<restId>/?token=<JWT> для realtime-обновлений
 *   - Polling каждые 15 сек как fallback если WS не работает
 */
import { useEffect, useRef } from 'react'
import { api, staffWsUrl, mapDjangoMenuItem, mapDjangoChatMessage, mapDjangoZone } from '../../lib/api'
import { useAudioAlert } from '../../hooks/useAudioAlert'
import { useAdminStore } from '../store'
import type { AdminWaiterCall } from '../store'

// Нормализует Django-сессию в формат adminStore
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
  paymentMethod: s.payment_method ?? '',
  createdAt: new Date(s.created_at).getTime(),
  updatedAt: new Date(s.updated_at).getTime(),
  closedAt: s.closed_at ? new Date(s.closed_at).getTime() : null,
})

const normalizeCall = (c: any): AdminWaiterCall => ({
  id: c.id,
  restaurantId: c.restaurant ?? '',
  tableId: c.table ?? '',
  tableNumber: c.table_number,
  tableToken: c.table_token ?? '',
  status: c.status,
  reason: c.reason ?? '',
  createdAt: new Date(c.created_at).getTime(),
})

export function useAdminListeners() {
  const {
    djangoRestId,
    setSessions, setMenuItems, setTables, setZones, setStaff,
    setCalls, showCallBanner, showToast, setScreen, reset, setChatMessages,
    setOperationalLoad, markOperationalUpdated, operationalReloadNonce,
  } = useAdminStore()

  const wsRef         = useRef<WebSocket | null>(null)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef  = useRef(false)
  const prevCallCount = useRef(-1)
  const initializedRef = useRef(false)
  const prevReadyIds  = useRef<Set<string>>(new Set())
  const playReadyAlert = useAudioAlert(660, [0, 220])

  useEffect(() => {
    if (!djangoRestId) return

    cancelledRef.current   = false
    initializedRef.current = false
    prevCallCount.current  = -1
    prevReadyIds.current   = new Set()

    // Закрываем старые соединения
    wsRef.current?.close()
    if (intervalRef.current) clearInterval(intervalRef.current)

    // ── Загрузить все данные из REST API ──────────────────────────────────────
    // FIX: транзитная ошибка (или истёкший токен) у одного из запросов больше
    // не затирает уже загруженные данные пустым массивом — иначе, например,
    // список столов "пропадал" при кратковременном сбое запроса api.tables().
    const loadAll = async () => {
      if (cancelledRef.current) return

      let sessionExpired = false
      const onError = (e: any) => {
        if (e?.message === 'SESSION_EXPIRED') sessionExpired = true
        return null
      }

      try {
        const hadData = useAdminStore.getState().operationalLastUpdatedAt !== null
        if (!hadData) setOperationalLoad('loading')
        let operationalFailures = 0
        const operationalError = (e: any) => { operationalFailures += 1; return onError(e) }
        const [sessions, menu, tables, staff, calls, zones] = await Promise.all([
          api.activeSessionsV2(djangoRestId).catch(operationalError),
          api.menu(djangoRestId).catch(onError),
          api.tables(djangoRestId).catch(onError),
          api.staff(djangoRestId).catch(onError),
          api.waiterCalls(djangoRestId).catch(operationalError),
          api.zones(djangoRestId).catch(onError),
        ])
        if (cancelledRef.current) return

        if (sessionExpired) {
          showToast('Сессия истекла, войдите снова')
          reset()
          setScreen('mode')
          return
        }

        // Сессии — нормализуем + получаем все сессии (добавляем closed для аналитики)
        if (sessions) {
          const normalized = sessions.map(normalizeSession)
          setSessions(normalized)

          // FIX: уведомление официанту со звуком, когда повар отмечает позицию
          // 'ready' — иначе официант узнаёт о готовом блюде только при ручном
          // обновлении экрана.
          const currentReadyIds = new Set<string>()
          const newlyReady: { tableNumber: number | null; itemName: string }[] = []
          for (const s of normalized) {
            for (const item of s.items) {
              if (item.status !== 'ready') continue
              currentReadyIds.add(item.id)
              if (initializedRef.current && !prevReadyIds.current.has(item.id)) {
                newlyReady.push({ tableNumber: s.tableNumber, itemName: item.itemName })
              }
            }
          }
          if (newlyReady.length) {
            playReadyAlert()
            const msg = newlyReady.length === 1
              ? `Стол №${newlyReady[0].tableNumber}: «${newlyReady[0].itemName}» готово — можно подавать!`
              : `Готово к подаче: ${newlyReady.length} позиций`
            showToast(msg)
          }
          prevReadyIds.current = currentReadyIds
        }

        // Меню
        if (menu) {
          const menuItems = [...menu]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(mapDjangoMenuItem)
          setMenuItems(menuItems)
        }

        // Столы — денормализуем zone (PK) → zoneId для UI (группировка/фильтры зон)
        if (tables) {
          const sortedTables = [...tables]
            .sort((a, b) => a.number - b.number)
            .map(t => ({ ...t, zoneId: t.zone ?? null }))
          setTables(sortedTables as any)
        }

        // Зоны зала
        if (zones) {
          setZones([...zones].map(mapDjangoZone))
        }

        // Персонал
        if (staff) {
          setStaff(staff.map(u => ({
            id: u.id,
            uid: u.id,
            email: u.email,
            name: u.name,
            role: u.role as any,
            restaurantId: djangoRestId,
            assignedTables: u.assigned_tables ?? [],
            assignedZones: u.assigned_zones ?? [],
            createdAt: new Date(u.created_at).getTime(),
          })))
        }

        // Вызовы официанта (только новые)
        if (calls) {
          const newCalls = calls
            .filter(c => c.status === 'new')
            .map(normalizeCall)
            .sort((a, b) => a.createdAt - b.createdAt)

          if (initializedRef.current && newCalls.length > prevCallCount.current) {
            showCallBanner(newCalls[newCalls.length - 1])
          }
          prevCallCount.current  = newCalls.length
          initializedRef.current = true
          setCalls(newCalls)
        }

        if (operationalFailures === 0) markOperationalUpdated()
        else setOperationalLoad('error', 'Не удалось обновить счета или вызовы. Показаны последние доступные данные.')

        // Чат (только если фича доступна на тарифе). Счётчик непрочитанных
        // вычисляется в setChatMessages; звук/пуш намеренно не используем.
        if (useAdminStore.getState().rest?.features?.chat) {
          const messages = await api.chatMessages(djangoRestId).catch(onError)
          if (messages) setChatMessages(messages.map(mapDjangoChatMessage))
        }

      } catch (e) {
        console.error('[AdminListeners] loadAll error:', e)
      }
    }

    // Первая загрузка
    loadAll()

    // Polling каждые 15 сек (fallback)
    intervalRef.current = setInterval(loadAll, 15_000)

    // ── WebSocket для мгновенных событий ─────────────────────────────────────
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempt = 0

    const connectWs = async () => {
      if (cancelledRef.current) return

      try {
        // staffWsUrl заранее refresh-ит истекающий JWT. Без этого REST уже мог
        // получить новый access token, а WS продолжал бесконечно стучаться с 4401.
        const url = await staffWsUrl(djangoRestId)
        if (cancelledRef.current) return
        if (!url) return  // refresh-сессии нет — остаёмся на polling

        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
          reconnectAttempt = 0
          console.log('[AdminWS] connected')
        }

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            // При любом событии — перезагружаем данные
            if (['new_order', 'item_status_changed', 'session_status_changed', 'delivery_status_changed', 'waiter_call', 'chat_message'].includes(msg.type)) {
              loadAll()

              // Мгновенный баннер на вызов
              if (msg.type === 'waiter_call') {
                showCallBanner({
                  id: msg.data?.call_id ?? '',
                  restaurantId: djangoRestId,
                  tableId: '',
                  tableNumber: msg.data?.table_number ?? 0,
                  tableToken: '',
                  status: 'new',
                  reason: msg.data?.reason ?? '',
                  createdAt: Date.now(),
                })
              }
            }
          } catch {}
        }

        ws.onclose = () => {
          if (cancelledRef.current) return
          const delay = Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempt, 5))
          reconnectAttempt += 1
          reconnectTimer = setTimeout(connectWs, delay)
        }

        ws.onerror = () => ws.close()
      } catch (e) {
        console.warn('[AdminWS] connection failed, using polling fallback')
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
  }, [djangoRestId, operationalReloadNonce])
}
