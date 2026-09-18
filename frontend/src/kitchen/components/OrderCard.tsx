import React, { useState } from 'react'
import { api } from '../../lib/api'
import { useKitchenStore } from '../store'
import { normalizeStatus, isKitchenVisible } from '../../lib/itemStatus'
import type { TableSession, SessionItem } from '../../types'

function elapsed(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1)  return 'только что'
  if (m < 60) return `${m} мин`
  return `${Math.floor(m / 60)}ч ${m % 60}м`
}

function timerClass(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 5)  return 'timer--ok'
  if (m < 10) return 'timer--warn'
  return 'timer--late'
}

interface Props {
  session: TableSession
  col: 'pending' | 'ready'
  items: SessionItem[]
  focused: boolean
}

export default function OrderCard({ session: s, col, items, focused }: Props) {
  const { restId } = useKitchenStore()
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState('')

  const markReady = async () => {
    if (!restId || actionPending) return
    setActionPending(true)
    setActionError('')
    const { station, updateItemsStatus } = useKitchenStore.getState()
    // Кухня переводит в 'ready' только реально подтверждённые (confirmed) позиции —
    // awaiting_confirmation/ready/served/rejected/cancelled трогать нельзя. Единая
    // семантика — см. lib/itemStatus.ts (normalizeStatus + isKitchenVisible).
    const pendingItems = (s.items ?? []).filter(item => {
      if (!isKitchenVisible(normalizeStatus(item.status))) return false
      const st = item.preparationStation ?? 'kitchen'
      if (station !== 'all' && st !== station) return false
      return true
    })
    const results = await Promise.allSettled(
      pendingItems.map(item => api.updateItemStatus(restId, s.id, item.id!, 'ready'))
    )
    // FIX: сразу обновляем локально успешно изменённые позиции — иначе
    // карточка не меняется до следующего опроса (8 сек), и сотрудник жмёт
    // повторно (а повторный запрос для уже 'ready' позиции падает с ошибкой).
    const doneIds = pendingItems
      .filter((_, i) => results[i].status === 'fulfilled')
      .map(item => item.id!)
    if (doneIds.length) updateItemsStatus(s.id, doneIds, 'ready')
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error('[OrderCard] markReady error for item', pendingItems[i].id, ':', r.reason?.message ?? r.reason)
      }
    })
    if (results.some(r => r.status === 'rejected')) setActionError('Не все позиции обновились. Повторите.')
    setActionPending(false)
  }

  const markBack = async () => {
    if (!restId || actionPending) return
    setActionPending(true)
    setActionError('')
    const { station, updateItemsStatus } = useKitchenStore.getState()
    const readyItems = (s.items ?? []).filter(item => {
      if (item.status !== 'ready') return false
      const st = item.preparationStation ?? 'kitchen'
      if (station !== 'all' && st !== station) return false
      return true
    })
    // Возврат «готово → в работу»: в order-confirmation модели это ready → confirmed
    // (позиция снова видна кухне). Legacy sent_to_kitchen/sent_to_bar в модели больше нет.
    const results = await Promise.allSettled(
      readyItems.map(item => api.updateItemStatus(restId, s.id, item.id!, 'confirmed'))
    )
    readyItems.forEach((item, i) => {
      if (results[i].status === 'fulfilled') {
        updateItemsStatus(s.id, [item.id!], 'confirmed')
      } else {
        console.error('[OrderCard] markBack error for item', item.id, ':', (results[i] as PromiseRejectedResult).reason?.message ?? (results[i] as PromiseRejectedResult).reason)
      }
    })
    if (results.some(r => r.status === 'rejected')) setActionError('Не удалось вернуть часть позиций. Повторите.')
    setActionPending(false)
  }

  const isPending = col === 'pending'

  return (
    <div
      className={`order-card ${isPending ? 'order-card--new' : 'order-card--ready'} ${focused ? 'order-card--focused' : ''}`}
    >
      {/* Шапка */}
      <div className="order-card__head">
        <span className="order-card__table">Стол №{s.tableNumber}</span>
        <span className={`order-card__badge ${isPending ? 'badge--new' : 'badge--ready'}`}>
          {isPending ? 'новый' : 'готово'}
        </span>
        <span className={`order-card__timer ${timerClass(s.updatedAt ?? s.createdAt)}`}>
          {elapsed(s.updatedAt ?? s.createdAt)}
        </span>
      </div>

      {/* Позиции */}
      <div className="order-card__items">
        {items.map((it, i) => (
          <div key={i} className="order-item">
            <div className="order-item__info">
              <span className="order-item__name">{it.itemName}</span>
              {it.note && <span className="order-item__note">📝 {it.note}</span>}
            </div>
            <span className="order-item__qty">×{it.quantity}</span>
          </div>
        ))}
      </div>

      {/* Кнопки */}
      {actionError && <div className="order-card__error" role="alert">{actionError}</div>}
      <div className="order-card__footer">
        {isPending ? (
          <button id={`order-${s.id}-action`} onClick={markReady} disabled={actionPending} className="order-btn order-btn--ready">
            {actionPending ? 'Сохраняем…' : '✓ Готово'}
          </button>
        ) : (
          <button id={`order-${s.id}-action`} onClick={markBack} disabled={actionPending} className="order-btn order-btn--back">
            {actionPending ? 'Сохраняем…' : '↩ Вернуть'}
          </button>
        )}
      </div>
    </div>
  )
}
