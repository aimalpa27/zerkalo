import React, { useState } from 'react'
import {
  CreditCard, Calendar, Save, CheckCircle2, XCircle,
  Truck, ShoppingBag, Bell, BarChart2, Wallet, Headphones, Armchair, Users, CalendarClock, MessageCircle,
} from 'lucide-react'
import { api, type SuperAdminRestaurant } from '../../lib/api'
import { useSAStore } from '../store'

const STATUS_OPTIONS: { value: SuperAdminRestaurant['subscription_status']; label: string; color: string }[] = [
  { value: 'trial',     label: 'Триал',       color: 'var(--color-gold)' },
  { value: 'active',    label: 'Активна',     color: 'var(--color-green)' },
  { value: 'past_due',  label: 'Просрочена',  color: 'var(--color-orange)' },
  { value: 'suspended', label: 'Заблокирована', color: 'var(--color-red)' },
]

const FEATURE_ROWS: { key: keyof typeof FEATURE_ICONS; label: string }[] = [
  { key: 'delivery_enabled',          label: 'Доставка' },
  { key: 'online_orders_enabled',     label: 'Заказ из-за стола' },
  { key: 'waiter_calls_enabled',      label: 'Вызов официанта' },
  { key: 'analytics_enabled',         label: 'Аналитика' },
  { key: 'kaspi_pay_enabled',         label: 'Kaspi Pay' },
  { key: 'schedule_enabled',          label: 'График смен' },
  { key: 'chat_enabled',              label: 'Чат команды' },
  { key: 'priority_support',          label: 'Приоритетная поддержка' },
]

const FEATURE_ICONS = {
  delivery_enabled: Truck,
  online_orders_enabled: ShoppingBag,
  waiter_calls_enabled: Bell,
  analytics_enabled: BarChart2,
  kaspi_pay_enabled: Wallet,
  schedule_enabled: CalendarClock,
  chat_enabled: MessageCircle,
  priority_support: Headphones,
} as const

const inputStyle: React.CSSProperties = {
  background: 'var(--color-card)', border: '1.5px solid var(--color-rim)', color: 'var(--color-soft)',
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export default function SubscriptionTab({
  restId, restaurant, onUpdate,
}: {
  restId: string
  restaurant: SuperAdminRestaurant
  onUpdate: (r: SuperAdminRestaurant) => void
}) {
  const { plans, showToast } = useSAStore()
  const [planId, setPlanId] = useState(restaurant.subscription_plan ?? '')
  const [statusVal, setStatusVal] = useState(restaurant.subscription_status)
  const [expiresAt, setExpiresAt] = useState(toDateInput(restaurant.subscription_expires_at))
  const [saving, setSaving] = useState(false)

  const selectedPlan = plans.find(p => p.id === planId)

  const save = async () => {
    setSaving(true)
    try {
      const updated = await api.superadminUpdateRestaurant(restId, {
        subscription_plan: planId || null,
        subscription_status: statusVal,
        subscription_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      onUpdate(updated)
      setPlanId(updated.subscription_plan ?? '')
      setStatusVal(updated.subscription_status)
      setExpiresAt(toDateInput(updated.subscription_expires_at))
      showToast('Подписка обновлена')
    } catch (e: any) {
      showToast(e?.message ?? 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-24">

      {/* Тариф */}
      <div className="adm-card p-4 flex flex-col gap-3">
        <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-mid)' }}>
          <CreditCard size={13} /> Тарифный план
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => setPlanId('')}
            className="flex flex-col items-start gap-1 px-3 py-3 rounded-xl text-left transition-all"
            style={{
              background: planId === '' ? 'var(--color-gold)' : 'var(--color-card)',
              color: planId === '' ? '#fff' : 'var(--color-soft)',
              border: '1px solid var(--color-rim)',
            }}
          >
            <span className="text-sm font-bold">Без тарифа</span>
            <span className="text-xs" style={{ opacity: 0.8 }}>Без ограничений (legacy)</span>
          </button>
          {plans.map(p => (
            <button
              key={p.id}
              onClick={() => setPlanId(p.id)}
              className="flex flex-col items-start gap-1 px-3 py-3 rounded-xl text-left transition-all"
              style={{
                background: planId === p.id ? 'var(--color-gold)' : 'var(--color-card)',
                color: planId === p.id ? '#fff' : 'var(--color-soft)',
                border: '1px solid var(--color-rim)',
              }}
            >
              <span className="text-sm font-bold">{p.name}</span>
              <span className="text-xs" style={{ opacity: 0.8 }}>
                {Number(p.price) > 0 ? `${Number(p.price).toLocaleString('ru-RU')} ₸/мес` : 'Бесплатно'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Статус и срок */}
      <div className="adm-card p-4 flex flex-col gap-3">
        <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-mid)' }}>
          <CreditCard size={13} /> Статус подписки
        </label>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusVal(opt.value)}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: statusVal === opt.value ? opt.color : 'var(--color-card)',
                color: statusVal === opt.value ? '#fff' : opt.color,
                border: `1px solid ${opt.color}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="text-xs font-semibold flex items-center gap-1.5 mt-2" style={{ color: 'var(--color-mid)' }}>
          <Calendar size={13} /> Действует до
        </label>
        <input
          type="date"
          value={expiresAt}
          onChange={e => setExpiresAt(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={inputStyle}
        />
        <p className="text-xs" style={{ color: 'var(--color-dim)' }}>
          Оставьте пустым, если подписка бессрочная (например, тестовый период без даты окончания).
        </p>
      </div>

      {/* Лимиты и фичи выбранного плана */}
      <div className="adm-card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-mid)' }}>
          Что входит в тариф
        </p>

        {!selectedPlan && (
          <p className="text-sm" style={{ color: 'var(--color-soft)' }}>
            Без тарифа — все функции доступны без ограничений.
          </p>
        )}

        {selectedPlan && (
          <>
            <div className="flex items-center gap-4 text-sm pb-2" style={{ borderBottom: '1px solid var(--color-rim)' }}>
              <span className="flex items-center gap-1.5" style={{ color: 'var(--color-soft)' }}>
                <Armchair size={14} style={{ color: 'var(--color-mid)' }} />
                Столов: {selectedPlan.max_tables ?? '∞'}
              </span>
              <span className="flex items-center gap-1.5" style={{ color: 'var(--color-soft)' }}>
                <Users size={14} style={{ color: 'var(--color-mid)' }} />
                Сотрудников: {selectedPlan.max_staff ?? '∞'}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {FEATURE_ROWS.map(({ key, label }) => {
                const Icon = FEATURE_ICONS[key]
                const enabled = Boolean(selectedPlan[key])
                return (
                  <div key={key} className="flex items-center gap-3 text-sm">
                    <Icon size={15} style={{ color: 'var(--color-mid)' }} />
                    <span className="flex-1" style={{ color: 'var(--color-soft)' }}>{label}</span>
                    {enabled
                      ? <CheckCircle2 size={16} style={{ color: 'var(--color-green)' }} />
                      : <XCircle size={16} style={{ color: 'var(--color-red)' }} />}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-4 z-10">
        <button
          onClick={save}
          disabled={saving}
          className="w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98]"
          style={{ background: saving ? 'var(--color-dim)' : 'var(--color-gold)', color: '#fff', boxShadow: 'var(--card-pay-shadow)' }}
        >
          <Save size={16} />
          {saving ? 'Сохранение...' : 'Сохранить подписку'}
        </button>
      </div>
    </div>
  )
}
