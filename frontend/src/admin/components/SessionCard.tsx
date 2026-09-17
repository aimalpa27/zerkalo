import React from 'react'
import { Eye, CheckCheck, CreditCard, Check, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'
import { normalizeStatus, isBillable } from '../../lib/itemStatus'
import { awaitingItems, escalationLevel } from '../lib/orderConfirmation'
import type { TableSession } from '../../types'

// ── Умный таймер: 5м / 1ч 20м / 2д 3ч ──────────────────────────────────────
function elapsed(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1)  return 'только что'
  if (m < 60) return `${m}м`
  const h = Math.floor(m / 60); const rm = m % 60
  if (h < 24) return rm ? `${h}ч ${rm}м` : `${h}ч`
  const d = Math.floor(h / 24)
  return `${d}д ${h % 24}ч`
}

// ── Цвет таймера: зелёный < 15м, жёлтый < 30м, красный ≥ 30м ───────────────
function timeColor(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 15) return 'var(--color-green)'
  if (m < 30) return 'var(--color-orange)'
  return 'var(--color-red)'
}

// ── Цвет и метка статуса позиции ─────────────────────────────────────────────
const ITEM_STATUS: Record<string, { dot: string; label: string }> = {
  pending:               { dot: '#6B7280', label: 'Ожидает' },
  waiter_confirmed:      { dot: '#6B7280', label: 'Принят' },
  sent_to_kitchen:       { dot: '#F59E0B', label: 'На кухне' },
  sent_to_bar:           { dot: '#F59E0B', label: 'В баре' },
  awaiting_confirmation: { dot: '#FF6B1A', label: 'Ожидает подтв.' },
  confirmed:             { dot: '#6B7280', label: 'Принят' },
  ready:                 { dot: '#4CAF50', label: 'Готово' },
  served:                { dot: '#FF6B1A', label: 'Подано' },
  delivered:             { dot: '#FF6B1A', label: 'Подано' },
  rejected:              { dot: '#EF4444', label: 'Отклонён' },
  cancelled:             { dot: '#EF4444', label: 'Отменён' },
}

// ── Общий статус карточки ─────────────────────────────────────────────────────
function cardStatus(s: TableSession) {
  if (awaitingItems(s).length > 0) return 'awaiting'
  if (s.status === 'payment_requested') return 'pay'
  const items = (s.items ?? []).filter(i => i.status !== 'cancelled')
  if (items.some(i => normalizeStatus(i.status) === 'ready')) return 'ready'
  if (items.some(i => normalizeStatus(i.status) === 'confirmed')) return 'cooking'
  return 'open'
}

const STATUS_CFG = {
  awaiting: { label: 'Ждёт подтверждения', bg: 'rgba(255,107,26,.15)', color: '#FF6B1A', border: 'rgba(255,107,26,.5)' },
  open:    { label: 'Открыт',          bg: 'rgba(107,114,128,.15)', color: '#9CA3AF', border: 'rgba(255,107,26,.20)' },
  cooking: { label: 'Готовится',       bg: 'rgba(245,158,11,.12)', color: '#F59E0B', border: 'rgba(245,158,11,.35)' },
  ready:   { label: 'Готово к подаче', bg: 'rgba(76,175,80,.12)',  color: '#4CAF50', border: 'rgba(76,175,80,.45)' },
  pay:     { label: 'Ожидает оплату',  bg: 'rgba(255,107,26,.12)', color: '#FF6B1A', border: 'rgba(255,107,26,.55)' },
}

const GLOW = {
  awaiting: '0 0 16px rgba(255,107,26,.2), 0 4px 16px rgba(0,0,0,.4)',
  open:    'none',
  cooking: '0 0 0 0 transparent',
  ready:   '0 0 16px rgba(76,175,80,.18), 0 4px 16px rgba(0,0,0,.4)',
  pay:     '0 0 20px rgba(255,107,26,.18), 0 4px 16px rgba(0,0,0,.4)',
}

interface Props { session: TableSession }

export default function SessionCard({ session: s }: Props) {
  const { djangoRestId, isAdmin, rest, showToast, showAlert, setSessionDetail } = useAdminStore()
  const items  = (s.items ?? []).filter(i => i.status !== 'cancelled')
  const st     = cardStatus(s)
  const cfg    = STATUS_CFG[st]
  const isPay  = st === 'pay'
  const canClose = isPay && (isAdmin || !!rest?.allowWaiterClose)

  const awaiting     = awaitingItems(s)
  const billable     = items.filter(i => isBillable(normalizeStatus(i.status)))
  const servedCount  = billable.filter(i => normalizeStatus(i.status) === 'served').length
  const readyCount   = items.filter(i => normalizeStatus(i.status) === 'ready').length
  const escLevel     = escalationLevel(s, rest)

  const markServed = async () => {
    if (!djangoRestId) return
    const readyItems = (s.items ?? []).filter(i => normalizeStatus(i.status) === 'ready')
    if (!readyItems.length) {
      // FIX (upstream): не молчим, если нет готовых позиций — подсказываем официанту.
      const cooking = (s.items ?? []).some(i => normalizeStatus(i.status) === 'confirmed')
      showAlert(
        cooking
          ? 'Блюдо ещё готовится. Дождитесь подтверждения повара, что блюдо готово.'
          : 'Нет позиций, готовых к подаче.'
      )
      return
    }
    try {
      await Promise.all(
        readyItems.map(i => api.updateItemStatus(djangoRestId, s.id, i.id!, 'served'))
      )
      useAdminStore.getState().updateItemsStatus(s.id, readyItems.map(i => i.id!), 'served')
      showToast('Подано ✓')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const acceptAllAwaiting = async () => {
    if (!djangoRestId) return
    const ids = awaiting.map(i => i.id!).filter(Boolean)
    if (!ids.length) return
    try {
      // awaiting_confirmation → confirmed (бэкенд проставит confirmed_at и пересчитает
      // итоги — позиция входит в счёт). Единая семантика — lib/itemStatus.ts.
      await Promise.all(ids.map(id => api.updateItemStatus(djangoRestId, s.id, id, 'confirmed')))
      useAdminStore.getState().updateItemsStatus(s.id, ids, 'confirmed')
      showToast('Заказ принят ✓')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const rejectAllAwaiting = async () => {
    if (!djangoRestId) return
    const ids = awaiting.map(i => i.id!).filter(Boolean)
    if (!ids.length) return
    try {
      await Promise.all(ids.map(id => api.updateItemStatus(djangoRestId, s.id, id, 'rejected')))
      useAdminStore.getState().updateItemsStatus(s.id, ids, 'rejected')
      showToast('Отклонено')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const reqPay = async () => {
    if (!djangoRestId) return
    try {
      await api.patchSessionStatus(djangoRestId, s.id, 'payment_requested')
      showToast('Клиент уведомлён об оплате')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const closeS = () => {
    useAdminStore.getState().showConfirm('Закрыть счёт?', async () => {
      if (!djangoRestId) return
      try {
        await api.closeSession(djangoRestId, s.id, s.paymentMethod || 'cash')
        showToast('Счёт закрыт')
      } catch (e: any) {
        showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
      }
    })
  }

  return (
    <div
      className={`rounded-2xl overflow-hidden mb-2 ${escLevel === 'escalate' ? 'animate-pulse-gold' : ''}`}
      style={{
        background:   'var(--color-card)',
        border:       `1px solid ${escLevel === 'escalate' ? 'rgba(239,68,68,.6)' : escLevel === 'reminder' ? 'rgba(255,107,26,.6)' : cfg.border}`,
        boxShadow:    escLevel === 'escalate'
          ? '0 0 24px rgba(239,68,68,.55), 0 4px 16px rgba(0,0,0,.4)'
          : escLevel === 'reminder'
          ? '0 0 20px rgba(255,107,26,.4), 0 4px 16px rgba(0,0,0,.4)'
          : GLOW[st],
      }}
    >
      {/* ── Заголовок: Номер стола | Статус | Время ── */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <span className="text-base font-bold" style={{ color: 'var(--color-soft)' }}>
          Стол №{s.tableNumber}
        </span>

        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: cfg.bg, color: cfg.color }}>
          {cfg.label}
        </span>

        <div className="flex items-center gap-1 ml-auto"
             style={{ color: timeColor(s.createdAt) }}>
          <Clock size={12} strokeWidth={2} />
          <span className="text-xs font-mono font-semibold tabular-nums">
            {elapsed(s.createdAt)}
          </span>
        </div>

        <button
          onClick={() => setSessionDetail(s.id)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'var(--color-card2)' }}
        >
          <Eye size={13} style={{ color: 'var(--color-dim)' }} />
        </button>
      </div>

      {/* ── Позиции заказа ── */}
      {items.length > 0 && (
        <div className="px-4" style={{ borderTop: '1px solid var(--color-rim)' }}>
          {items.slice(0, 4).map((it, i) => {
            const ist = ITEM_STATUS[it.status] ?? ITEM_STATUS.pending
            return (
              <div key={i}
                   className="flex items-center gap-2 py-1.5"
                   style={{ borderBottom: i < Math.min(items.length, 4) - 1 ? '1px solid var(--color-rim)' : 'none' }}>
                {/* Цветная точка статуса */}
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                     style={{ background: ist.dot }} />
                <span className="flex-1 text-sm" style={{ color: 'var(--color-soft)' }}>
                  {it.itemName}
                  <span className="ml-1 text-xs" style={{ color: 'var(--color-dim)' }}>
                    ×{it.quantity}
                  </span>
                </span>
                <span className="text-[10px] font-medium"
                      style={{ color: ist.dot }}>
                  {ist.label}
                </span>
                <span className="text-sm tabular-nums font-medium"
                      style={{ color: 'var(--color-mid)' }}>
                  {(it.price * it.quantity).toLocaleString('ru')}₸
                </span>
              </div>
            )
          })}
          {items.length > 4 && (
            <p className="text-xs py-1.5" style={{ color: 'var(--color-dim)' }}>
              +ещё {items.length - 4} позиции
            </p>
          )}
        </div>
      )}

      {/* ── Бейджи: подано X из Y / готово-не-подано / ожидают подтверждения ── */}
      {(billable.length > 0 || readyCount > 0 || awaiting.length > 0) && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 flex-wrap"
             style={{ borderTop: '1px solid var(--color-rim)' }}>
          {billable.length > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: 'var(--color-card2)', color: 'var(--color-dim)' }}>
              Подано {servedCount} из {billable.length}
            </span>
          )}
          {readyCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(76,175,80,.15)', color: 'var(--color-green)' }}>
              🔔 {readyCount} готово, не подано
            </span>
          )}
          {awaiting.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(255,107,26,.15)', color: 'var(--color-gold)' }}>
              ⏳ {awaiting.length} ждут подтверждения
            </span>
          )}
        </div>
      )}

      {/* ── Итого + Кнопки ── */}
      <div className="flex items-center gap-2 px-4 py-2.5"
           style={{ borderTop: '1px solid var(--color-rim)' }}>
        <div className="flex-1">
          <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-dim)' }}>
            Итого
          </span>
          <p className="text-base font-bold leading-tight" style={{ color: 'var(--color-soft)' }}>
            {(s.totalAmount ?? 0).toLocaleString('ru')} ₸
          </p>
        </div>

        {/* Кнопки действий */}
        {awaiting.length > 0 ? (
          <div className="flex gap-2">
            <button
              onClick={rejectAllAwaiting}
              title="Отклонить"
              className="h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-90"
              style={{ background: 'rgba(239,68,68,.1)', color: 'var(--color-red)',
                       border: '1px solid rgba(239,68,68,.3)' }}
            >
              <span>✕ Отклонить</span>
            </button>
            <button
              onClick={acceptAllAwaiting}
              title="Принять"
              className="h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 text-black"
              style={{ background: 'var(--color-gold)' }}
            >
              <Check size={13} />
              <span>Принять{awaiting.length > 1 ? ` (${awaiting.length})` : ''}</span>
            </button>
          </div>
        ) : !isPay ? (
          <div className="flex gap-2">
            <button
              onClick={markServed}
              title="Подано"
              className="h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-90"
              style={{ background: 'var(--color-card2)', color: 'var(--color-mid)',
                       border: '1px solid var(--color-rim)' }}
            >
              <CheckCheck size={13} />
              <span>Подано</span>
            </button>
            <button
              onClick={reqPay}
              title="Запросить оплату"
              className="h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 text-black"
              style={{ background: 'var(--color-gold)' }}
            >
              <CreditCard size={13} />
              <span>Оплата</span>
            </button>
          </div>
        ) : canClose ? (
          <button
            onClick={closeS}
            className="h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
            style={{ background: 'rgba(76,175,80,.15)', color: 'var(--color-green)',
                     border: '1px solid rgba(76,175,80,.3)' }}
          >
            <Check size={13} />
            <span>Закрыть счёт</span>
          </button>
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-dim)' }}>
            Ожидание оплаты...
          </span>
        )}
      </div>
    </div>
  )
}
