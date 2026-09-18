import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Users, Eye, EyeOff } from 'lucide-react'
import { api, type DjangoUser, type SuperAdminRestaurant } from '../../lib/api'
import { useSAStore } from '../store'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор', manager: 'Менеджер', waiter: 'Официант', cashier: 'Кассир', kitchen: 'Кухня',
}

// Роль 'admin' здесь доступна: бэкенд разрешает её создавать только суперадмину
// (см. StaffListCreateView / CreateUserSerializer.validate_role).
type StaffRole = 'waiter' | 'cashier' | 'manager' | 'kitchen' | 'admin'
const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'waiter',  label: 'Официант' },
  { value: 'cashier', label: 'Кассир' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'kitchen', label: 'Кухня' },
  { value: 'admin',   label: 'Администратор' },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--color-card)', border: '1.5px solid var(--color-rim)', color: 'var(--color-soft)',
}

export default function StaffTab({ restId, restaurant }: { restId: string; restaurant: SuperAdminRestaurant }) {
  const { plans, showToast } = useSAStore()
  const [staff, setStaff] = useState<DjangoUser[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [role, setRole] = useState<StaffRole>('waiter')

  const plan = plans.find(p => p.id === restaurant.subscription_plan)
  const limit = plan?.max_staff ?? null
  const limitReached = limit != null && staff.length >= limit

  const load = async () => {
    setLoading(true)
    try {
      const list = await api.staff(restId)
      setStaff(list)
    } catch {
      showToast('Не удалось загрузить персонал')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [restId])

  const create = async () => {
    if (!name.trim()) { showToast('Укажите имя'); return }
    if (!email.trim()) { showToast('Укажите email'); return }
    if (pass.length < 8) { showToast('Пароль минимум 8 символов'); return }

    setAdding(true)
    try {
      const u = await api.createStaff(restId, { email: email.trim(), name: name.trim(), role, password: pass })
      setStaff(prev => [...prev, u])
      setName(''); setEmail(''); setPass('')
      showToast(`${u.name || u.email} добавлен`)
    } catch (e: any) {
      const msg = e?.data?.email?.[0] ?? e?.data?.role ?? e?.data?.detail ?? e?.message ?? 'Не удалось добавить сотрудника'
      showToast(msg)
    } finally {
      setAdding(false)
    }
  }

  const remove = async (u: DjangoUser) => {
    if (!confirm(`Удалить сотрудника «${u.name || u.email}»?`)) return
    try {
      await api.deleteStaff(restId, u.id)
      setStaff(prev => prev.filter(x => x.id !== u.id))
      showToast('Сотрудник удалён')
    } catch {
      showToast('Не удалось удалить сотрудника')
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-24">

      {/* Лимит */}
      <div className="adm-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} style={{ color: 'var(--color-gold)' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-soft)' }}>
              {staff.length}{limit != null ? ` / ${limit}` : ''} сотрудников
            </p>
            <p className="text-xs" style={{ color: 'var(--color-mid)' }}>
              {limit != null ? `Лимит тарифа «${plan?.name}»` : 'Без ограничений'}
            </p>
          </div>
        </div>
        {limitReached && (
          <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ color: 'var(--color-red)', border: '1px solid var(--color-red)' }}>
            Лимит достигнут
          </span>
        )}
      </div>

      {/* Добавить сотрудника */}
      <div className="adm-card p-4 flex flex-col gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-mid)' }}>Новый сотрудник</label>

        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Имя"
          disabled={limitReached}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50"
          style={inputStyle}
        />
        <input
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email" type="email" autoCapitalize="none" autoCorrect="off"
          disabled={limitReached}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50"
          style={inputStyle}
        />

        <div className="relative">
          <input
            value={pass} onChange={e => setPass(e.target.value)}
            placeholder="Пароль (мин. 8 символов)" type={showPass ? 'text' : 'password'}
            disabled={limitReached}
            className="w-full px-3 py-2.5 pr-11 rounded-xl text-sm outline-none disabled:opacity-50"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--color-dim)' }}
          >
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ROLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRole(opt.value)}
              disabled={limitReached}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: role === opt.value ? 'var(--color-gold)' : 'var(--color-card)',
                color: role === opt.value ? '#fff' : 'var(--color-mid)',
                border: '1px solid var(--color-rim)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={create}
          disabled={adding || limitReached}
          className="mt-1 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'var(--color-gold)', color: '#fff' }}
        >
          <Plus size={15} /> {adding ? 'Добавляем...' : 'Добавить сотрудника'}
        </button>

        {limitReached && (
          <p className="text-xs" style={{ color: 'var(--color-orange)' }}>
            Чтобы добавить ещё сотрудников, повысьте тариф на вкладке «Подписка».
          </p>
        )}
        <div className="rounded-xl px-3 py-2.5 mt-1"
             style={{ background: 'rgba(255,107,26,.08)', border: '1px solid rgba(255,107,26,.2)' }}>
          <p className="text-[11px]" style={{ color: 'var(--color-gold)' }}>
            Сотрудник входит в обычную панель управления (admin.html) с этим email и паролем.
            {role === 'admin' && ' Администратор получает полный доступ к панели ресторана: меню, персонал, столы, аналитика, настройки.'}
          </p>
        </div>
      </div>

      {/* Список сотрудников */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-8 h-8 rounded-full border-4 animate-spin"
               style={{ borderColor: 'var(--color-rim)', borderTopColor: 'var(--color-gold)' }} />
        </div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <Users size={28} style={{ color: 'var(--color-dim)' }} />
          <p className="text-sm" style={{ color: 'var(--color-mid)' }}>Сотрудников пока нет</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {staff.map(u => (
            <div key={u.id} className="adm-card flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                   style={{ background: 'rgba(255,107,26,.12)', border: '1px solid rgba(255,107,26,.2)', color: 'var(--color-gold)' }}>
                {(u.name || u.email || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-soft)' }}>{u.name || u.email}</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-mid)' }}>
                  {ROLE_LABELS[u.role] ?? u.role} · {u.email}
                </p>
              </div>
              {!u.is_active && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ color: 'var(--color-mid)', border: '1px solid var(--color-rim)' }}>
                  Неактивен
                </span>
              )}
              <button
                onClick={() => remove(u)}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                style={{ background: 'rgba(239,68,68,.08)', color: 'var(--color-red)' }}
                title="Удалить"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
