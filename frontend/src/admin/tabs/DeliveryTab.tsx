import React, { useEffect, useState } from 'react'
import { Bike, ShoppingBag, User, Phone, MapPin, MessageSquare, Banknote, CreditCard, Loader } from 'lucide-react'
import { api, mapDjangoSession } from '../../lib/api'
import type { TableSession } from '../../types'
import { useAdminStore } from '../store'

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  preparing: 'Готовится',
  on_the_way: 'Курьер в пути',
  ready_for_pickup: 'Готов к выдаче',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'var(--color-gold)',
  confirmed: '#3b82f6',
  preparing: '#f59e0b',
  on_the_way: '#8b5cf6',
  ready_for_pickup: '#8b5cf6',
  completed: '#22c55e',
  cancelled: '#ef4444',
}

// Зеркало DELIVERY_STATUS_TRANSITIONS из backend (apps/sessions/views.py)
const TRANSITIONS: Record<string, string[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['on_the_way', 'ready_for_pickup', 'cancelled'],
  on_the_way: ['completed', 'cancelled'],
  ready_for_pickup: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

function nextActions(order: TableSession): string[] {
  const all = TRANSITIONS[order.deliveryStatus || 'new'] ?? []
  if (order.orderType === 'delivery') return all.filter(s => s !== 'ready_for_pickup')
  if (order.orderType === 'pickup') return all.filter(s => s !== 'on_the_way')
  return all
}

export default function DeliveryTab() {
  const { djangoRestId, showToast } = useAdminStore()
  const [orders, setOrders] = useState<TableSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'history'>('active')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = async () => {
    if (!djangoRestId) return
    try {
      const data = await api.deliveryOrders(djangoRestId)
      setOrders(data.map(mapDjangoSession))
    } catch {
      showToast('Не удалось загрузить заказы')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
  }, [djangoRestId])

  const updateStatus = async (order: TableSession, status: string) => {
    if (!djangoRestId) return
    setUpdatingId(order.id)
    try {
      const updated = await api.updateDeliveryStatus(djangoRestId, order.id, status)
      const mapped = mapDjangoSession(updated)
      setOrders(prev => prev.map(o => o.id === order.id ? mapped : o))
      showToast(`Статус обновлён: ${STATUS_LABELS[status] ?? status}`)
    } catch (e: any) {
      showToast(e?.data?.detail ?? 'Не удалось обновить статус')
    } finally {
      setUpdatingId(null)
    }
  }

  const active = orders.filter(o => !['completed', 'cancelled'].includes(o.deliveryStatus || ''))
  const history = orders.filter(o => ['completed', 'cancelled'].includes(o.deliveryStatus || ''))
  const visible = filter === 'active' ? active : history

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader size={24} className="animate-spin" style={{ color: 'var(--color-gold)' }} />
      </div>
    )
  }

  return (
    <div className="px-4 py-5">
      <p className="text-[10px] tracking-[3px] uppercase font-medium mb-1"
         style={{ color: 'rgba(255,107,26,.6)' }}>Доставка и самовывоз</p>
      <p className="text-xs mb-4" style={{ color: 'var(--color-dim)' }}>
        {active.length} активных заказов
      </p>

      {/* Filter */}
      <div className="flex gap-2 p-1 rounded-2xl mb-4"
           style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}>
        {(['active', 'history'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: filter === f ? 'var(--color-gold)' : 'transparent',
              color: filter === f ? '#fff' : 'var(--color-mid)',
            }}
          >
            {f === 'active' ? `Активные (${active.length})` : `История (${history.length})`}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3">
          <span className="text-5xl opacity-20">{filter === 'active' ? '🛵' : '📦'}</span>
          <p className="text-sm font-medium" style={{ color: 'var(--color-mid)' }}>
            {filter === 'active' ? 'Нет активных заказов на доставку/самовывоз' : 'История пуста'}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {visible.map(order => {
          const isDelivery = order.orderType === 'delivery'
          const statusKey = order.deliveryStatus || 'new'
          const actions = nextActions(order)
          return (
            <div key={order.id} className="rounded-2xl p-4"
                 style={{ background: 'var(--color-card)', border: '1px solid var(--card-border, var(--color-rim))' }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isDelivery
                    ? <Bike size={16} style={{ color: 'var(--color-gold)' }} />
                    : <ShoppingBag size={16} style={{ color: 'var(--color-gold)' }} />}
                  <span className="text-sm font-bold" style={{ color: 'var(--color-soft)' }}>
                    {isDelivery ? 'Доставка' : 'Самовывоз'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-dim)' }}>
                    #{order.id.slice(0, 8)}
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2 py-1 rounded-lg"
                      style={{ background: `${STATUS_COLORS[statusKey]}22`, color: STATUS_COLORS[statusKey] }}>
                  {STATUS_LABELS[statusKey] ?? statusKey}
                </span>
              </div>

              {/* Customer info */}
              <div className="flex flex-col gap-1 mb-3">
                {order.customerName && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-mid)' }}>
                    <User size={12} /> {order.customerName}
                  </div>
                )}
                {order.customerPhone && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-mid)' }}>
                    <Phone size={12} /> {order.customerPhone}
                  </div>
                )}
                {isDelivery && order.deliveryAddress && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-mid)' }}>
                    <MapPin size={12} /> {order.deliveryAddress}
                  </div>
                )}
                {order.deliveryComment && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-mid)' }}>
                    <MessageSquare size={12} /> {order.deliveryComment}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-mid)' }}>
                  {order.paymentMethod === 'card' ? <CreditCard size={12} /> : <Banknote size={12} />}
                  {order.paymentMethod === 'card' ? 'Картой' : 'Наличными'}
                </div>
              </div>

              {/* Items */}
              <div className="flex flex-col gap-1 mb-3 pl-1" style={{ borderLeft: '2px solid var(--color-rim)' }}>
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-xs pl-2" style={{ color: 'var(--color-soft)' }}>
                    <span>{item.itemName} ×{item.quantity}</span>
                    <span style={{ color: 'var(--color-gold)' }}>{(item.price * item.quantity).toLocaleString('ru')} ₸</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center mb-3">
                {(order.deliveryFee ?? 0) > 0 && (
                  <span className="text-xs" style={{ color: 'var(--color-dim)' }}>
                    + доставка {(order.deliveryFee ?? 0).toLocaleString('ru')} ₸
                  </span>
                )}
                <span className="ml-auto text-base font-bold" style={{ color: 'var(--color-gold)' }}>
                  {order.totalAmount.toLocaleString('ru')} ₸
                </span>
              </div>

              {/* Actions */}
              {actions.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {actions.map(action => (
                    <button
                      key={action}
                      onClick={() => updateStatus(order, action)}
                      disabled={updatingId === order.id}
                      className="flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      style={{
                        background: action === 'cancelled' ? 'rgba(239,68,68,.1)' : 'var(--color-gold)',
                        color: action === 'cancelled' ? 'var(--color-red)' : '#fff',
                      }}
                    >
                      {action === 'cancelled' ? 'Отменить' : `→ ${STATUS_LABELS[action]}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
