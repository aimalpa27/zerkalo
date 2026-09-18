import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, Plus } from 'lucide-react'
import { api, mapDjangoShift } from '../../lib/api'
import type { Shift } from '../../types'
import { useAdminStore } from '../store'

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}

function fmtTime(t: string): string {
  return t.slice(0, 5)
}

export default function ScheduleTab() {
  const { djangoRestId, rest, isAdmin, profile, staff, shifts, setShifts,
          openShiftModal, updateRest, showToast } = useAdminStore()

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [loading, setLoading] = useState(true)
  const [savingVisibility, setSavingVisibility] = useState(false)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const fromStr = fmtDate(days[0])
  const toStr = fmtDate(days[6])

  const hasFeature = !!rest?.features?.schedule

  useEffect(() => {
    if (!djangoRestId || !hasFeature) { setLoading(false); return }
    setLoading(true)
    api.shifts(djangoRestId, fromStr, toStr)
      .then(data => setShifts(data.map(mapDjangoShift)))
      .catch(() => showToast('Не удалось загрузить график'))
      .finally(() => setLoading(false))
  }, [djangoRestId, fromStr, toStr, hasFeature])

  if (!hasFeature) {
    return (
      <div className="px-4 py-5">
        <p className="text-[10px] tracking-[3px] uppercase font-medium mb-4"
           style={{ color: 'rgba(255,107,26,.6)' }}>График смен</p>
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
               style={{ background: 'rgba(255,107,26,.1)', border: '1px solid rgba(255,107,26,.2)' }}>
            <Lock size={22} style={{ color: 'var(--color-gold)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-soft)' }}>
            Доступно на тарифе Pro
          </p>
          <p className="text-xs max-w-xs" style={{ color: 'var(--color-dim)' }}>
            График смен сотрудников — функция тарифа Pro. Обновите тариф, чтобы планировать
            рабочие смены и показывать их сотрудникам.
          </p>
        </div>
      </div>
    )
  }

  const weekLabel = `${days[0].getDate()} ${days[0].toLocaleDateString('ru', { month: 'short' })} – ${days[6].getDate()} ${days[6].toLocaleDateString('ru', { month: 'short' })}`

  const setVisibility = async (v: 'own' | 'all') => {
    if (!djangoRestId || savingVisibility) return
    setSavingVisibility(true)
    try {
      await api.updateRestaurantSettings(djangoRestId, { schedule_visibility: v })
      updateRest({ schedule_visibility: v })
      showToast('Сохранено')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    } finally {
      setSavingVisibility(false)
    }
  }

  // ── Строки таблицы: для админа — весь персонал, для официанта — только свои
  // (и коллеги, если включена видимость "все")
  const rows = useMemo(() => {
    if (isAdmin) {
      return staff
        .filter(s => ['waiter', 'cashier', 'manager', 'kitchen'].includes(s.role))
        .map(s => ({ id: s.id, name: s.name || s.email }))
    }
    const seen = new Map<string, string>()
    for (const sh of shifts) {
      if (!seen.has(sh.staff)) seen.set(sh.staff, sh.staffName || '')
    }
    if (profile && !seen.has(profile.id)) seen.set(profile.id, profile.name || '')
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [isAdmin, staff, shifts, profile])

  const shiftsFor = (staffId: string, dateStr: string) =>
    shifts.filter(s => s.staff === staffId && s.date === dateStr)

  return (
    <div className="px-4 py-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] tracking-[3px] uppercase font-medium"
           style={{ color: 'rgba(255,107,26,.6)' }}>График смен</p>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4 mt-2">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}>
          <ChevronLeft size={16} style={{ color: 'var(--color-mid)' }} />
        </button>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-soft)' }}>{weekLabel}</p>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}>
          <ChevronRight size={16} style={{ color: 'var(--color-mid)' }} />
        </button>
      </div>

      {/* Visibility setting (admin only) */}
      {isAdmin && (
        <div className="adm-card p-4 mb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-soft)' }}>
            Видимость графика для официантов
          </p>
          <div className="flex gap-2 p-1 rounded-2xl"
               style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}>
            {(['own', 'all'] as const).map(v => (
              <button key={v} onClick={() => setVisibility(v)} disabled={savingVisibility}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                style={{
                  background: (rest?.schedule_visibility ?? 'own') === v ? 'var(--color-gold)' : 'transparent',
                  color: (rest?.schedule_visibility ?? 'own') === v ? '#fff' : 'var(--color-mid)',
                }}>
                {v === 'own' ? 'Только свою смену' : 'Весь график'}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 rounded-full animate-spin"
               style={{ border: '2px solid var(--color-rim)', borderTopColor: 'var(--color-gold)' }} />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <span className="text-4xl opacity-30">🗓️</span>
          <p className="text-sm" style={{ color: 'var(--color-dim)' }}>
            {isAdmin ? 'Нет сотрудников для составления графика' : 'На этой неделе смен нет'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full border-collapse" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold pb-2 pr-2 sticky left-0"
                    style={{ color: 'var(--color-mid)', background: 'var(--color-bg)' }}>
                  Сотрудник
                </th>
                {days.map((d, i) => (
                  <th key={i} className="text-center text-xs font-semibold pb-2 px-1"
                      style={{ color: 'var(--color-mid)', minWidth: 84 }}>
                    {DAY_LABELS[i]} <span style={{ color: 'var(--color-dim)' }}>{d.getDate()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td className="text-xs font-medium py-1 pr-2 sticky left-0"
                      style={{ color: 'var(--color-soft)', background: 'var(--color-bg)' }}>
                    {row.name}
                  </td>
                  {days.map((d, i) => {
                    const dateStr = fmtDate(d)
                    const cellShifts = shiftsFor(row.id, dateStr)
                    return (
                      <td key={i} className="p-1 align-top">
                        <div
                          onClick={() => isAdmin && openShiftModal({ staffId: row.id, date: dateStr })}
                          className="rounded-xl p-1.5 min-h-[44px] flex flex-col gap-1 transition-all"
                          style={{
                            background: 'var(--color-card)',
                            border: '1px solid var(--color-rim)',
                            cursor: isAdmin ? 'pointer' : 'default',
                          }}
                        >
                          {cellShifts.map(sh => (
                            <div key={sh.id}
                              onClick={(e) => { if (isAdmin) { e.stopPropagation(); openShiftModal({ editing: sh }) } }}
                              className="text-[11px] font-semibold rounded-lg px-1.5 py-1 text-center"
                              style={{ background: 'rgba(255,107,26,.12)', color: 'var(--color-gold)' }}>
                              {fmtTime(sh.startTime)}–{fmtTime(sh.endTime)}
                              {sh.note ? <div className="text-[10px] mt-0.5 font-normal opacity-80">{sh.note}</div> : null}
                            </div>
                          ))}
                          {cellShifts.length === 0 && isAdmin && (
                            <div className="flex items-center justify-center py-1.5">
                              <Plus size={14} style={{ color: 'var(--color-dim)' }} />
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
