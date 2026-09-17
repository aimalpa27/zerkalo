import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'

export default function NewOrderModal() {
  const { tables, sessions, menuItems, djangoRestId, rest, setNewOrderOpen, showToast } = useAdminStore()
  const [tableNum, setTableNum] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const available = menuItems.filter(m => m.isAvailable !== false)

  const chg = (id: string, delta: number) => {
    setCart(prev => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }
      if (!next[id]) delete next[id]
      return next
    })
  }

  const cartEntries = Object.entries(cart).filter(([, q]) => q > 0)

  const cartItems = cartEntries.map(([id, qty]) => {
    const m = menuItems.find(x => x.id === id)!
    const price = (m.discountPercent ?? 0) > 0
      ? m.price - Math.floor(m.price * m.discountPercent! / 100)
      : m.price
    return { id, qty, m, price }
  })

  const subtotal = cartItems.reduce((s, x) => s + x.price * x.qty, 0)

  const submit = async () => {
    if (!djangoRestId) return
    const num = parseInt(tableNum)
    if (!num) { showToast('Выберите стол'); return }
    if (!cartEntries.length) { showToast('Добавьте блюда'); return }

    const t = tables.find(x => x.number === num)
    if (!t) { showToast('Стол не найден'); return }
    if (!t.token) { showToast('Стол не имеет токена'); return }

    setLoading(true)
    try {
      // Staff-заказ уходит через Django API; статус позиций проставит бэкенд
      // (PlaceOrderService: added_by='waiter' → сразу 'confirmed', минуя
      // awaiting_confirmation — паритет с семантикой order-confirmation).
      const items = cartItems.map(({ id, qty }) => ({
        menu_item_id: id,
        quantity: qty,
        note: notes[id] ?? '',
      }))

      await api.staffPlaceOrder(djangoRestId, {
        table_token: t.token,
        payment_method: 'cash',
        items,
      })

      setNewOrderOpen(false)
      showToast(`Заказ стол №${num} на кухне ✓`)
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.data?.detail ?? e?.message ?? 'попробуйте ещё раз'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={() => setNewOrderOpen(false)} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl max-h-[90vh] flex flex-col"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <p className="text-lg font-bold" style={{ color: 'var(--color-soft)' }}>Новый заказ</p>
          <button onClick={() => setNewOrderOpen(false)}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-card2)' }}>
            <X size={16} style={{ color: 'var(--color-mid)' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5">
          {/* Table select */}
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-dim)' }}>Стол</p>
          <select value={tableNum} onChange={e => setTableNum(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none mb-5"
            style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)',
                     color: 'var(--color-soft)' }}>
            <option value="">Выберите стол...</option>
            {tables.map(t => {
              const busy = sessions.find(s => s.tableNumber === t.number)
              return <option key={t.id} value={t.number}>
                {t.number} — {busy ? 'Занят' : 'Свободен'}
              </option>
            })}
          </select>

          {/* Menu */}
          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-dim)' }}>Блюда</p>
          {available.map(m => (
            <div key={m.id} className="flex flex-col rounded-2xl mb-2 overflow-hidden"
                 style={{ background: 'var(--color-card2)' }}>
              <div className="flex items-center gap-3 p-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 overflow-hidden"
                     style={{ background: 'var(--color-card)' }}>
                  {m.imageUrl ? <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" /> : (m.emoji ?? '🍽️')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-soft)' }}>{m.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-gold)' }}>
                    {(m.price ?? 0).toLocaleString('ru')} ₸
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => chg(m.id, -1)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold transition-all active:scale-90"
                    style={{ background: 'var(--color-card)', color: 'var(--color-soft)' }}>−</button>
                  <span className="w-6 text-center text-sm font-bold"
                        style={{ color: cart[m.id] ? 'var(--color-gold)' : 'var(--color-dim)' }}>
                    {cart[m.id] ?? 0}
                  </span>
                  <button onClick={() => chg(m.id, 1)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold transition-all active:scale-90"
                    style={{ background: 'var(--color-card)', color: 'var(--color-soft)' }}>+</button>
                </div>
              </div>
              {(cart[m.id] ?? 0) > 0 && (
                <div className="px-3 pb-3">
                  <input
                    value={notes[m.id] ?? ''}
                    onChange={e => setNotes(prev => ({ ...prev, [m.id]: e.target.value }))}
                    placeholder="Пожелание (без лука, без острого...)"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)',
                             color: 'var(--color-soft)' }}
                  />
                </div>
              )}
            </div>
          ))}

          {cartItems.length > 0 && (
            <div className="mt-4 p-4 rounded-2xl mb-4"
                 style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}>
              <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--color-dim)' }}>
                В заказе
              </p>
              {cartItems.map(({ id, qty, m, price }) => (
                <div key={id} className="flex justify-between text-sm py-1">
                  <span style={{ color: 'var(--color-mid)' }}>{m.name} ×{qty}</span>
                  <span style={{ color: 'var(--color-gold)' }}>{(price * qty).toLocaleString('ru')} ₸</span>
                </div>
              ))}
              <div className="h-px my-2" style={{ background: 'var(--color-rim)' }} />
              <div className="flex justify-between font-bold text-sm">
                <span style={{ color: 'var(--color-soft)' }}>Итого</span>
                <span style={{ color: 'var(--color-gold)' }}>{subtotal.toLocaleString('ru')} ₸</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 flex-shrink-0"
             style={{ borderTop: '1px solid var(--color-rim)' }}>
          <button onClick={() => setNewOrderOpen(false)}
            className="flex-1 h-14 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--color-card2)', color: 'var(--color-mid)',
                     border: '1px solid var(--color-rim)' }}>
            Отмена
          </button>
          <button onClick={submit} disabled={loading}
            className="flex-[2] h-14 rounded-2xl text-sm font-bold text-black transition-all active:scale-[.98]"
            style={{ background: loading ? 'var(--color-dim)' : 'var(--color-gold)' }}>
            {loading ? 'Отправка...' : 'ОТПРАВИТЬ НА КУХНЮ'}
          </button>
        </div>
      </motion.div>
    </>
  )
}
