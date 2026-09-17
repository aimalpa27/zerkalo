import React, { useEffect, useState } from 'react'
import { useAdminStore } from '../store'
import { api, mapDjangoSession } from '../../lib/api'

// ── Локальный fallback: фильтрация на клиенте ─────────────────────────────────
function periodFilter(sessions: any[], period: string, from: string, to: string) {
  const closed = sessions.filter(s => s.status === 'closed')
  const now = new Date()
  if (period === 'today') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    return closed.filter(s => (s.closedAt || s.updatedAt || 0) >= d)
  }
  if (period === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 7); d.setHours(0,0,0,0)
    return closed.filter(s => (s.closedAt || s.updatedAt || 0) >= d.getTime())
  }
  if (period === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    return closed.filter(s => (s.closedAt || s.updatedAt || 0) >= d)
  }
  if (period === 'custom' && from && to) {
    const fs = new Date(from).getTime()
    const ts = new Date(to).getTime() + 86400000
    return closed.filter(s => { const t = s.closedAt || s.updatedAt || 0; return t >= fs && t <= ts })
  }
  return closed
}

const PERIOD_LABELS: Record<string, string> = {
  today: 'за сегодня', week: 'за 7 дней', month: 'за месяц', custom: 'за период'
}

// ── Конвертация period → Django date params ────────────────────────────────────
function periodToDates(period: string, from: string, to: string): { from?: string; to?: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  if (period === 'today')  return { from: fmt(now), to: fmt(now) }
  if (period === 'week')   {
    const d = new Date(now); d.setDate(d.getDate() - 7)
    return { from: fmt(d), to: fmt(now) }
  }
  if (period === 'month')  {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: fmt(d), to: fmt(now) }
  }
  if (period === 'custom' && from && to) return { from, to }
  return {}
}

interface DjangoSummary {
  revenue: number
  sessions_count: number
  avg_check: number
  top_items: Array<{ item_name: string; total_qty: number; total_revenue: number }>
}

export default function AnalyticsTab() {
  const {
    tables, zones, period, customFrom, customTo,
    djangoRestId, setPeriod, setCustomRange,
  } = useAdminStore()

  // Django API state
  const [summary, setSummary]   = useState<DjangoSummary | null>(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [closedSessions, setClosedSessions] = useState<any[]>([])
  const source = summary ? 'django' : 'unavailable'

  // Загружаем аналитику из Django при наличии djangoRestId
  useEffect(() => {
    if (!djangoRestId) return
    const { from, to } = periodToDates(period, customFrom, customTo)

    setApiLoading(true)
    setApiError('')

    Promise.all([
      api.analyticsSummary(djangoRestId, from, to),
      api.analyticsSessions(djangoRestId, from, to),
    ])
      .then(([data, history]) => {
        setSummary(data)
        setClosedSessions(history.map(mapDjangoSession))
        setLastUpdatedAt(Date.now())
      })
      .catch(err => {
        console.warn('[Analytics] Django API error:', err)
        setApiError(String(err?.message ?? err))
      })
      .finally(() => setApiLoading(false))
  }, [djangoRestId, period, customFrom, customTo, retryNonce])

  // ── Данные: Django или локальный fallback ─────────────────────────────────
  const filtered = closedSessions

  // Итоговые значения
  const total = summary?.revenue ?? 0
  const count = summary?.sessions_count ?? 0
  const avg   = summary ? Math.round(summary.avg_check) : 0

  // Сервис и выручка без него (только из локальных сессий, Django не возвращает отдельно)
  const svc = filtered.reduce((s, x) => s + (x.serviceChargeAmount || 0), 0)
  const sub = filtered.reduce((s, x) => s + (x.subtotalAmount || 0), 0)

  // Топ блюд
  const top: Array<{ name: string; qty: number; rev: number }> = summary
    ? summary.top_items.map(i => ({ name: i.item_name, qty: i.total_qty, rev: i.total_revenue }))
    : []

  // Выручка по зонам: денормализованный zoneName сессии (зона на момент заказа),
  // фолбэк — живой join table→zone для сессий без поля (сейчас zone в счёт не
  // денормализуется на бэкенде, поэтому фактически всегда идёт live-join).
  const zoneNameFor = (s: any): string => {
    if (s.zoneName) return s.zoneName
    const t = tables.find((x: any) => x.id === s.tableId) ?? tables.find((x: any) => x.number === s.tableNumber)
    const z = t?.zoneId ? zones.find(zz => zz.id === t.zoneId) : null
    return z?.name ?? 'Без зоны'
  }
  const zoneMap: Record<string, number> = {}
  filtered.forEach(s => {
    const zn = zoneNameFor(s)
    zoneMap[zn] = (zoneMap[zn] ?? 0) + (s.totalAmount || 0)
  })
  const zoneRows = Object.entries(zoneMap).sort((a, b) => b[1] - a[1])
  const zoneTotal = zoneRows.reduce((s, [, v]) => s + v, 0) || 1

  // График по дням (всегда из локальных сессий стора)
  const now = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i)); return d
  })
  const dm: Record<string, number> = {}
  days.forEach(d => { dm[d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' })] = 0 })
  closedSessions.forEach(s => {
    const k = new Date(s.closedAt || s.updatedAt || 0)
      .toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    if (dm[k] !== undefined) dm[k] += (s.totalAmount || 0)
  })
  const maxD = Math.max(...Object.values(dm), 1)

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="adm-card p-4 mb-0">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2"
         style={{ color: 'var(--color-mid)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: 'var(--color-gold)' }}>{value}</p>
    </div>
  )

  return (
    <div className="px-4 py-5">

      {/* ── Источник данных ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${source === 'django' ? 'bg-green-500/15 text-green-400' : 'bg-orange-500/15 text-orange-400'}`}>
          {apiLoading ? '⏳ Обновляем аналитику...' : source === 'django' ? '✓ Данные сервера' : '⚠ Аналитика недоступна'}
        </span>
        {apiError && <button onClick={() => setRetryNonce(n => n + 1)} disabled={apiLoading} className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background:'var(--color-card2)', color:'var(--color-gold)' }}>Повторить</button>}
        {apiError && summary && lastUpdatedAt && <span className="text-[10px]" style={{ color:'var(--color-dim)' }}>Показаны последние данные · {new Date(lastUpdatedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</span>}
      </div>
      {apiError && !summary && (
        <div className="adm-card p-4 mb-5" style={{ border:'1px solid rgba(255,107,26,.35)' }}>
          <p className="text-sm font-bold" style={{ color:'var(--color-soft)' }}>Не удалось загрузить финансовую аналитику</p>
          <p className="text-xs mt-1" style={{ color:'var(--color-mid)' }}>Мы не подменяем данные локальными нулями. Проверьте соединение и повторите загрузку.</p>
        </div>
      )}

      {/* ── Переключатели периода ── */}
      <div className="flex gap-2 mb-5">
        {(['today','week','month','custom'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className="flex-1 h-10 rounded-xl text-xs font-bold transition-all"
            style={period === p
              ? { background: 'var(--color-gold)', color: '#fff' }
              : { background: 'var(--color-card)', color: 'var(--color-mid)',
                  border: '1.5px solid var(--card-border)' }}>
            {p === 'today' ? 'Сег.' : p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Период'}
          </button>
        ))}
      </div>

      {/* ── Кастомный период ── */}
      {period === 'custom' && (
        <div className="flex gap-2 mb-5">
          <input type="date" value={customFrom}
            onChange={e => setCustomRange(e.target.value, customTo)}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium outline-none"
            style={{ background: 'var(--color-card)', border: '1.5px solid var(--card-border)',
                     color: 'var(--color-soft)' }} />
          <input type="date" value={customTo}
            onChange={e => setCustomRange(customFrom, e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium outline-none"
            style={{ background: 'var(--color-card)', border: '1.5px solid var(--card-border)',
                     color: 'var(--color-soft)' }} />
        </div>
      )}

      {/* ── Главная цифра: выручка ── */}
      {summary && <>
      <div className="adm-card p-6 text-center mb-3">
        <p className="text-xs font-bold uppercase tracking-[3px] mb-3"
           style={{ color: 'var(--color-mid)' }}>
          Выручка {PERIOD_LABELS[period]}
        </p>
        <p className="text-5xl font-bold" style={{ color: 'var(--color-gold)' }}>
          {Number(total).toLocaleString('ru')} ₸
        </p>
        <p className="text-sm font-semibold mt-2" style={{ color: 'var(--color-mid)' }}>
          {count} закрытых счетов
        </p>
      </div>

      {/* ── Сетка статистики ── */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <Stat label="Средний чек"   value={`${avg.toLocaleString('ru')} ₸`} />
        <Stat label="Сервисный сбор" value={`${svc.toLocaleString('ru')} ₸`} />
        <Stat label="Без сервиса"   value={`${sub.toLocaleString('ru')} ₸`} />
        <Stat label="Счетов"        value={String(count)} />
      </div>

      </>}

      {/* ── График по дням ── */}
      <p className="text-xs font-bold uppercase tracking-[2px] mb-3"
         style={{ color: 'var(--color-mid)' }}>По дням</p>
      <div className="adm-card p-4 mb-5">
        {Object.entries(dm).map(([date, val]) => (
          <div key={date} className="flex items-center gap-3 mb-2 last:mb-0">
            <span className="text-xs font-semibold w-12 text-right tabular-nums"
                  style={{ color: 'var(--color-mid)' }}>{date}</span>
            <div className="flex-1 h-7 rounded-lg overflow-hidden"
                 style={{ background: 'var(--color-card2)' }}>
              <div className="adm-bar-fill h-full"
                   style={{ width: `${Math.max(Math.round(val / maxD * 100), val > 0 ? 4 : 0)}%` }}>
                {val > 0 && (
                  <span className="text-[10px] font-bold text-black pr-1">
                    {val >= 1000 ? `${(val/1000).toFixed(0)}к` : val}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Топ блюд ── */}
      {top.length > 0 && (
        <>
          <p className="text-xs font-bold uppercase tracking-[2px] mb-3"
             style={{ color: 'var(--color-mid)' }}>Топ блюд</p>
          <div className="adm-card p-4 mb-5">
            {top.map(({ name, qty, rev }, i) => (
              <div key={name} className="flex items-center gap-3 py-2.5"
                   style={{ borderBottom: i < top.length - 1 ? '1px solid var(--color-rim)' : 'none' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                     style={{ background: 'var(--color-card2)', color: 'var(--color-gold)' }}>
                  {i + 1}
                </div>
                <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-soft)' }}>
                  {name}
                </span>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: 'var(--color-gold)' }}>{qty} шт.</p>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-dim)' }}>
                    {Number(rev).toLocaleString('ru')} ₸
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Выручка по зонам ── */}
      {zoneRows.length > 0 && (
        <>
          <p className="text-xs font-bold uppercase tracking-[2px] mb-3"
             style={{ color: 'var(--color-mid)' }}>Выручка по зонам</p>
          <div className="adm-card p-4 mb-5">
            {zoneRows.map(([name, rev], i) => (
              <div key={name} className="flex items-center gap-3 py-2.5"
                   style={{ borderBottom: i < zoneRows.length - 1 ? '1px solid var(--color-rim)' : 'none' }}>
                <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-soft)' }}>
                  {name}
                </span>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: 'var(--color-gold)' }}>
                    {rev.toLocaleString('ru')} ₸
                  </p>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-dim)' }}>
                    {Math.round(rev / zoneTotal * 100)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Список закрытых счетов (из локальных сессий стора) ── */}
      {filtered.length > 0 && (
        <>
          <p className="text-xs font-bold uppercase tracking-[2px] mb-3"
             style={{ color: 'var(--color-mid)' }}>Закрытые счета</p>
          {filtered.slice(0, 20).map(s => (
            <div key={s.id} className="adm-card flex justify-between items-center p-4">
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-soft)' }}>
                  Стол №{s.tableNumber}
                </p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--color-dim)' }}>
                  {new Date(s.closedAt || s.updatedAt || 0)
                    .toLocaleString('ru-RU', { day:'2-digit', month:'2-digit',
                                              hour:'2-digit', minute:'2-digit' })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold" style={{ color: 'var(--color-gold)' }}>
                  {(s.totalAmount || 0).toLocaleString('ru')} ₸
                </p>
                <p className="text-xs font-medium" style={{ color: 'var(--color-dim)' }}>
                  сервис {(s.serviceChargeAmount || 0).toLocaleString('ru')} ₸
                </p>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
