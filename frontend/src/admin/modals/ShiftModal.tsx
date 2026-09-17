import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { api, mapDjangoShift } from '../../lib/api'
import { useAdminStore } from '../store'

const ROLE_LABELS: Record<string, string> = {
  waiter: 'Официант', cashier: 'Кассир', manager: 'Менеджер', kitchen: 'Кухня', admin: 'Администратор'
}

export default function ShiftModal() {
  const { djangoRestId, staff, shiftModal, closeShiftModal, shifts, setShifts, showToast, showConfirm } = useAdminStore()
  const { editing, defaultStaffId, defaultDate } = shiftModal

  const workers = staff.filter(s => ['waiter', 'cashier', 'manager', 'kitchen'].includes(s.role))

  const [staffId, setStaffId] = useState(editing?.staff ?? defaultStaffId ?? workers[0]?.id ?? '')
  const [date, setDate] = useState(editing?.date ?? defaultDate ?? '')
  const [startTime, setStartTime] = useState(editing ? editing.startTime.slice(0, 5) : '09:00')
  const [endTime, setEndTime] = useState(editing ? editing.endTime.slice(0, 5) : '18:00')
  const [note, setNote] = useState(editing?.note ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!djangoRestId) return
    if (!staffId || !date || !startTime || !endTime) { setError('Заполните все поля'); return }
    if (endTime <= startTime) { setError('Время окончания должно быть позже начала'); return }
    setLoading(true); setError('')

    const payload = {
      staff: staffId, date,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      note,
    }

    try {
      if (editing) {
        const updated = await api.updateShift(djangoRestId, editing.id, payload)
        setShifts(shifts.map(s => s.id === editing.id ? mapDjangoShift(updated) : s))
      } else {
        const created = await api.createShift(djangoRestId, payload)
        setShifts([...shifts, mapDjangoShift(created)])
      }
      closeShiftModal()
      showToast('Сохранено')
    } catch (e: any) {
      const msg = e?.data?.staff?.[0] ?? e?.data?.non_field_errors?.[0] ?? e?.data?.detail ?? e?.message ?? 'Ошибка сохранения'
      setError(msg)
      setLoading(false)
    }
  }

  const remove = () => {
    if (!editing || !djangoRestId) return
    showConfirm('Удалить смену?', async () => {
      try {
        await api.deleteShift(djangoRestId, editing.id)
        setShifts(shifts.filter(s => s.id !== editing.id))
        closeShiftModal()
        showToast('Удалено')
      } catch (e: any) {
        showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
      }
    })
  }

  const inputStyle = {
    background: 'var(--color-card2)', border: '1px solid var(--card-border)',
    color: 'var(--color-soft)',
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={closeShiftModal} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl"
        style={{ background: 'var(--color-card)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <p className="text-lg font-bold" style={{ color: 'var(--color-soft)' }}>
            {editing ? 'Изменить смену' : 'Новая смена'}
          </p>
          <button onClick={closeShiftModal}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-card2)' }}>
            <X size={16} style={{ color: 'var(--color-mid)' }} />
          </button>
        </div>

        <div className="px-5 pb-6 flex flex-col gap-3">
          <select value={staffId} onChange={e => setStaffId(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none" style={inputStyle}>
            {workers.map(w => (
              <option key={w.id} value={w.id}>{w.name || w.email} ({ROLE_LABELS[w.role] ?? w.role})</option>
            ))}
          </select>

          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none" style={inputStyle} />

          <div className="flex gap-3">
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="flex-1 px-4 py-3.5 rounded-2xl text-sm outline-none" style={inputStyle} />
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
              className="flex-1 px-4 py-3.5 rounded-2xl text-sm outline-none" style={inputStyle} />
          </div>

          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Комментарий (необязательно)"
            className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none" style={inputStyle} />

          {error && <p className="text-xs text-center" style={{ color: 'var(--color-red)' }}>{error}</p>}

          <div className="flex gap-3 mt-2">
            {editing && (
              <button onClick={remove}
                className="h-14 px-4 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
                         color: 'var(--color-red)' }}>
                Удалить
              </button>
            )}
            <button onClick={closeShiftModal}
              className="flex-1 h-14 rounded-2xl text-sm font-semibold"
              style={{ background: 'var(--color-card2)', color: 'var(--color-mid)',
                       border: '1px solid var(--color-rim)' }}>
              Отмена
            </button>
            <button onClick={save} disabled={loading}
              className="flex-[2] h-14 rounded-2xl text-sm font-bold text-black"
              style={{ background: loading ? 'var(--color-dim)' : 'var(--color-gold)' }}>
              {loading ? 'Сохраняем...' : 'СОХРАНИТЬ'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
