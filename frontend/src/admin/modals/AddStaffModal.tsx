import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'

export default function AddStaffModal() {
  const { djangoRestId, setAddStaffOpen, showToast } = useAdminStore()
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('staff123')
  const [role, setRole]   = useState<'waiter' | 'cashier' | 'manager' | 'kitchen'>('waiter')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    if (!name || !email || !pass) { setError('Заполните все поля'); return }
    if (pass.length < 6) { setError('Пароль минимум 6 символов'); return }
    if (!djangoRestId) { setError('Ресторан не найден'); return }
    setLoading(true); setError('')

    try {
      await api.createStaff(djangoRestId, { email, name, role, password: pass })
      setAddStaffOpen(false)
      showToast(`${name} добавлен ✓`)
    } catch (e: any) {
      const msg = e?.data?.email?.[0]
        ?? e?.data?.detail
        ?? e?.message
        ?? 'Ошибка создания'
      setError(msg)
      setLoading(false)
    }
  }

  const inp = (val: string, set: (v: string) => void, placeholder: string, type = 'text') => (
    <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
      className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none"
      style={{ background: 'var(--color-card2)', border: '1px solid var(--card-border)',
               color: 'var(--color-soft)' }} />
  )

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={() => setAddStaffOpen(false)} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl"
        style={{ background: 'var(--color-card)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <p className="text-lg font-bold" style={{ color: 'var(--color-soft)' }}>Новый сотрудник</p>
          <button onClick={() => setAddStaffOpen(false)}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-card2)' }}>
            <X size={16} style={{ color: 'var(--color-mid)' }} />
          </button>
        </div>

        <div className="px-5 pb-6 flex flex-col gap-3">
          {inp(name, setName, 'Имя сотрудника')}
          {inp(email, setEmail, 'Email', 'email')}
          {inp(pass, setPass, 'Пароль (мин. 6 символов)')}

          <select value={role} onChange={e => setRole(e.target.value as any)}
            className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none"
            style={{ background: 'var(--color-card2)', border: '1px solid var(--card-border)',
                     color: 'var(--color-soft)' }}>
            <option value="waiter">Официант</option>
            <option value="cashier">Кассир</option>
            <option value="manager">Менеджер</option>
            <option value="kitchen">Кухня</option>
          </select>

          <div className="rounded-xl px-3 py-2.5"
               style={{ background: 'rgba(255,107,26,.08)', border: '1px solid rgba(255,107,26,.2)' }}>
            <p className="text-[11px]" style={{ color: 'var(--color-gold)' }}>
              💡 Сотрудник входит на <strong>admin.html</strong> с этим email и паролем
            </p>
          </div>

          {error && <p className="text-xs text-center" style={{ color: 'var(--color-red)' }}>{error}</p>}

          <div className="flex gap-3 mt-2">
            <button onClick={() => setAddStaffOpen(false)}
              className="flex-1 h-14 rounded-2xl text-sm font-semibold"
              style={{ background: 'var(--color-card2)', color: 'var(--color-mid)',
                       border: '1px solid var(--color-rim)' }}>
              Отмена
            </button>
            <button onClick={create} disabled={loading}
              className="flex-[2] h-14 rounded-2xl text-sm font-bold text-black"
              style={{ background: loading ? 'var(--color-dim)' : 'var(--color-gold)' }}>
              {loading ? 'Создаём...' : 'СОЗДАТЬ'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
