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
  comparison: null | { from: string; to: string; revenue: number; sessions_count: number; avg_check: number; revenue_change_pct: number | null; sessions_change_pct: number | null; avg_check_change_pct: number | null }
  operations: { active_tables: number; table_utilization_pct: number | null; avg_session_minutes: number; best_hour: null | { hour: number; sessions: number; revenue: number }; best_day: null | { weekday: number; label: string; sessions: number; revenue: number } }
  sla_incident_trends: { breaches: number; resolved: number; active: number; resolution_rate_pct: number | null; avg_resolution_minutes: number; previous_breaches: number | null; breach_change_pct: number | null; peak_hour: null | { hour: number; breaches: number }; by_day: Array<{ date: string; breaches: number }>; by_station: Array<{ station: string; breaches: number }> }
  daily_digest: { date: string; revenue: number; sessions_count: number; avg_check: number; sla_breaches: number; active_incidents: number; scheduled_staff: number; staff_on_shift_now: number; problem_zone: null | { zone_id: string; name: string; breaches: number }; attention: Array<{ severity: 'critical' | 'warning' | 'ok'; code: string; text: string; action?: null | { kind: 'session' | 'zone' | 'schedule' | 'sla_log'; session_id?: string; zone_id?: string } }> }
  shift_zone_operations: { shifts: Array<{ date: string; start: string; end: string; staff_count: number; sessions: number; revenue: number; sla_breaches: number }>; zones: Array<{ zone_id: string; name: string; sessions: number; revenue: number; avg_check: number; sla_breaches: number }> }
  staff_efficiency: { avg_response_minutes: number; p95_response_minutes: number; avg_ready_to_served_minutes: number; p95_ready_to_served_minutes: number; response_samples: number; serve_samples: number; waiters: Array<{ user_id: string; name: string; actions: number; avg_response_minutes: number | null; avg_ready_to_served_minutes: number | null }> }
  kitchen_sla: { avg_prep_minutes: number; p95_prep_minutes: number; avg_ready_to_served_minutes: number; ready_to_served_target_minutes: number; handoff_measured_items: number; handoff_late_items: number; handoff_sla_met_pct: number | null; measured_items: number; late_items: number; sla_met_pct: number | null; overload_hour: null | { hour: number; late_items: number }; stations: Array<{ station: string; avg_prep_minutes: number; p95_prep_minutes: number; avg_ready_to_served_minutes: number; measured_items: number; late_items: number; sla_met_pct: number | null; target_minutes: number }> }
  service_recovery: { total: number; compensation_cost: number; serious_problems:number; linked_problems:number; coverage_pct:number|null; previous_total: number | null; previous_compensation_cost: number | null; total_change_pct: number | null; cost_change_pct: number | null; reasons: Array<{ reason: string; count: number; cost: number }>; recent: Array<{ id: string; session_id: string; table_number: number; reason: string; note: string; compensation_type: string; compensation_amount: number; created_at: string }> }
  operations_exception_kpi: { total:number; acknowledged:number; resolved:number; avg_response_minutes:number|null; avg_resolution_minutes:number|null }
  upsell: { impressions: number; adds: number; conversions: number; conversion_rate: number; add_rate: number; revenue: number; top_rules: Array<{ rule_id: string; rule__trigger_item__name: string; rule__recommended_item__name: string; conversions: number; revenue: number }> }
}

export default function AnalyticsTab() {
  const {
    tables, zones, period, customFrom, customTo,
    djangoRestId, setPeriod, setCustomRange, setTab, setSessionDetail,
  } = useAdminStore()

  // Django API state
  const [summary, setSummary]   = useState<DjangoSummary | null>(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [slaSettings, setSlaSettings] = useState({ kitchen: 20, bar: 10, handoff: 5 })
  const [slaSaving, setSlaSaving] = useState(false)
  const [slaSettingsError, setSlaSettingsError] = useState('')
  const [closedSessions, setClosedSessions] = useState<any[]>([])
  const [slaIncidents, setSlaIncidents] = useState<any[]>([])
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
      api.restaurantSettings(djangoRestId),
      api.slaIncidents(djangoRestId),
    ])
      .then(([data, history, settings, incidents]) => {
        setSummary(data)
        setClosedSessions(history.map(mapDjangoSession))
        setLastUpdatedAt(Date.now())
        setSlaSettings({ kitchen: settings.kitchen_sla_minutes ?? 20, bar: settings.bar_sla_minutes ?? 10, handoff: settings.ready_to_served_sla_minutes ?? 5 })
        setSlaIncidents(incidents.history)
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

  const Delta = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-[10px]" style={{color:'var(--color-dim)'}}>нет базы сравнения</span>
    const up = value > 0, down = value < 0
    return <span className={`text-[11px] font-bold ${up ? 'text-green-400' : down ? 'text-red-400' : ''}`} style={!up && !down ? {color:'var(--color-dim)'} : undefined}>
      {up ? '↑' : down ? '↓' : '→'} {Math.abs(value)}% к прошлому периоду
    </span>
  }

  const saveSlaSettings = async () => {
    if (!djangoRestId) return
    setSlaSaving(true); setSlaSettingsError('')
    try {
      await api.updateRestaurantSettings(djangoRestId, {
        kitchen_sla_minutes: slaSettings.kitchen,
        bar_sla_minutes: slaSettings.bar,
        ready_to_served_sla_minutes: slaSettings.handoff,
      })
      setRetryNonce(n => n + 1)
    } catch (e: any) { setSlaSettingsError(e?.message ?? 'Не удалось сохранить SLA') }
    finally { setSlaSaving(false) }
  }

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

      {summary.comparison && <div className="adm-card p-4 mb-5">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{color:'var(--color-mid)'}}>Динамика бизнеса</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><p className="text-xs mb-1" style={{color:'var(--color-mid)'}}>Выручка</p><Delta value={summary.comparison.revenue_change_pct}/></div>
          <div><p className="text-xs mb-1" style={{color:'var(--color-mid)'}}>Средний чек</p><Delta value={summary.comparison.avg_check_change_pct}/></div>
          <div><p className="text-xs mb-1" style={{color:'var(--color-mid)'}}>Закрытые счета</p><Delta value={summary.comparison.sessions_change_pct}/></div>
        </div>
        <p className="text-[10px] mt-3" style={{color:'var(--color-dim)'}}>Сравнение: {summary.comparison.from} — {summary.comparison.to}</p>
      </div>}

      <div className="adm-card p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{color:'var(--color-mid)'}}>Операционные KPI</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Загрузка столов*" value={summary.operations.table_utilization_pct === null ? '—' : `${summary.operations.table_utilization_pct}%`} />
          <Stat label="Среднее время стола" value={`${summary.operations.avg_session_minutes} мин`} />
          <Stat label="Лучший час" value={summary.operations.best_hour ? `${String(summary.operations.best_hour.hour).padStart(2,'0')}:00` : '—'} />
          <Stat label="Лучший день" value={summary.operations.best_day?.label ?? '—'} />
        </div>
        <p className="text-[10px] mt-3" style={{color:'var(--color-dim)'}}>* Доля занятого времени активных столов за выбранный календарный период; доставка и самовывоз исключены.</p>
      </div>

      {summary.staff_efficiency && <div className="adm-card p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{color:'var(--color-mid)'}}>Скорость команды</p>
        {summary.staff_efficiency.response_samples === 0 && summary.staff_efficiency.serve_samples === 0 ? (
          <p className="text-sm" style={{color:'var(--color-mid)'}}>Пока нет действий официантов с подтверждённой серверной атрибуцией.</p>
        ) : <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Stat label="Заказ → принят" value={`${summary.staff_efficiency.avg_response_minutes} мин`} />
            <Stat label="p95 реакции" value={`${summary.staff_efficiency.p95_response_minutes} мин`} />
            <Stat label="Ready → Served" value={`${summary.staff_efficiency.avg_ready_to_served_minutes} мин`} />
            <Stat label="p95 подачи" value={`${summary.staff_efficiency.p95_ready_to_served_minutes} мин`} />
          </div>
          {summary.staff_efficiency.waiters.length > 0 && <div className="space-y-2">
            {summary.staff_efficiency.waiters.map(w => <div key={w.user_id} className="rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{background:'var(--color-card2)'}}>
              <div><p className="text-sm font-bold" style={{color:'var(--color-soft)'}}>{w.name}</p><p className="text-[10px]" style={{color:'var(--color-dim)'}}>{w.actions} подтверждённых действий</p></div>
              <p className="text-xs" style={{color:'var(--color-mid)'}}>реакция <b>{w.avg_response_minutes ?? '—'} мин</b> · подача <b>{w.avg_ready_to_served_minutes ?? '—'} мин</b></p>
            </div>)}
          </div>}
          <p className="text-[10px] mt-3" style={{color:'var(--color-dim)'}}>Персональные строки показываются только при ≥3 серверно атрибутированных действиях. Это операционная диагностика, не рейтинг сотрудников.</p>
        </>}
      </div>}

      {summary.kitchen_sla && <div className="adm-card p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{color:'var(--color-mid)'}}>Цели SLA ресторана</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[['Кухня', 'kitchen'], ['Бар', 'bar'], ['Ready → Served', 'handoff']].map(([label, key]) => <label key={key} className="text-xs" style={{color:'var(--color-mid)'}}>{label}, мин
            <input type="number" min={1} max={180} value={(slaSettings as any)[key]} onChange={e => setSlaSettings(v => ({...v, [key]: Math.max(1, Math.min(180, Number(e.target.value) || 1))}))} className="mt-1 w-full rounded-xl px-3 py-2 bg-transparent" style={{border:'1px solid var(--color-rim)', color:'var(--color-soft)'}} />
          </label>)}
        </div>
        {slaSettingsError && <p className="text-xs mt-2" style={{color:'#fb7185'}}>{slaSettingsError}</p>}
        <button disabled={slaSaving} onClick={saveSlaSettings} className="mt-3 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50" style={{background:'var(--color-gold)', color:'#111'}}>{slaSaving ? 'Сохраняем…' : 'Сохранить SLA'}</button>
        <p className="text-[10px] mt-2" style={{color:'var(--color-dim)'}}>Цели применяются только к вашему ресторану и сразу пересчитывают аналитику выбранного периода.</p>
      </div>}


      {summary.daily_digest && <div className="adm-card p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3"><div><p className="text-xs font-bold uppercase tracking-[2px]" style={{color:'var(--color-mid)'}}>Сводка менеджера · сегодня</p><p className="text-[10px] mt-1" style={{color:'var(--color-dim)'}}>{summary.daily_digest.date} · только фактические данные Plait, без AI</p></div>{summary.daily_digest.active_incidents > 0 && <span className="text-xs font-bold px-3 py-1 rounded-full" style={{background:'rgba(251,113,133,.12)',color:'#fb7185'}}>{summary.daily_digest.active_incidents} активных SLA</span>}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <Stat label="Выручка сегодня" value={`${Number(summary.daily_digest.revenue).toLocaleString('ru')} ₸`} />
          <Stat label="Средний чек" value={`${Number(summary.daily_digest.avg_check).toLocaleString('ru')} ₸`} />
          <Stat label="Закрыто счетов" value={String(summary.daily_digest.sessions_count)} />
          <Stat label="Смена сейчас" value={`${summary.daily_digest.staff_on_shift_now}/${summary.daily_digest.scheduled_staff}`} />
        </div>
        <div className="space-y-2">{summary.daily_digest.attention.map(item => <div key={item.code} className="rounded-xl px-3 py-2 flex items-center justify-between gap-3" style={{background:'var(--color-card2)'}}><span className="text-xs font-medium" style={{color:item.severity === 'critical' ? '#fb7185' : item.severity === 'warning' ? '#fbbf24' : '#4ade80'}}>{item.text}</span>{item.action && <button className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold" style={{border:'1px solid var(--color-rim)',color:'var(--color-soft)'}} onClick={() => { if (item.action?.kind === 'session' && item.action.session_id) { setTab('sessions'); setSessionDetail(item.action.session_id) } else if (item.action?.kind === 'zone') { setTab('tables') } else if (item.action?.kind === 'schedule') { setTab('schedule') } else { document.getElementById('sla-incident-log')?.scrollIntoView({behavior:'smooth', block:'start'}) } }}>Открыть →</button>}</div>)}</div>
        <p className="text-[10px] mt-3" style={{color:'var(--color-dim)'}}>SLA за сегодня: {summary.daily_digest.sla_breaches} · проблемная зона: {summary.daily_digest.problem_zone?.name ?? 'не выявлена'}. Сводка строится детерминированно из закрытых счетов, графика и SLA-журнала.</p>
      </div>}

      {summary.shift_zone_operations && <div className="adm-card p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{color:'var(--color-mid)'}}>Операции по сменам и зонам</p>
        {summary.shift_zone_operations.shifts.length === 0 && summary.shift_zone_operations.zones.length === 0 ? <p className="text-sm" style={{color:'var(--color-mid)'}}>Пока нет закрытых счетов по зонам или запланированных смен в выбранном периоде.</p> : <>
          {summary.shift_zone_operations.shifts.length > 0 && <div className="mb-4"><p className="text-[11px] font-bold mb-2" style={{color:'var(--color-soft)'}}>Смены</p><div className="space-y-2">{summary.shift_zone_operations.shifts.slice(0,8).map((row, idx) => <div key={`${row.date}-${row.start}-${row.end}-${idx}`} className="rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{background:'var(--color-card2)'}}><div><b className="text-sm" style={{color:'var(--color-soft)'}}>{row.date} · {row.start}–{row.end}</b><p className="text-[10px]" style={{color:'var(--color-dim)'}}>{row.staff_count} сотрудников по графику · {row.sessions} закрытых счетов</p></div><div className="sm:text-right"><b className="text-sm" style={{color:'var(--color-gold)'}}>{Number(row.revenue).toLocaleString('ru')} ₸</b><p className="text-[10px]" style={{color:row.sla_breaches ? '#fb7185' : '#4ade80'}}>{row.sla_breaches} SLA-просрочек</p></div></div>)}</div></div>}
          {summary.shift_zone_operations.zones.length > 0 && <div><p className="text-[11px] font-bold mb-2" style={{color:'var(--color-soft)'}}>Зоны</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{summary.shift_zone_operations.zones.map(row => <div key={row.zone_id} className="rounded-xl p-3" style={{background:'var(--color-card2)'}}><div className="flex justify-between gap-3"><b className="text-sm" style={{color:'var(--color-soft)'}}>{row.name}</b><b className="text-sm" style={{color:'var(--color-gold)'}}>{Number(row.revenue).toLocaleString('ru')} ₸</b></div><p className="text-[10px] mt-1" style={{color:'var(--color-dim)'}}>{row.sessions} счетов · средний {Number(row.avg_check).toLocaleString('ru')} ₸ · {row.sla_breaches} SLA-просрочек</p></div>)}</div></div>}
          <p className="text-[10px] mt-3" style={{color:'var(--color-dim)'}}>Одинаковые интервалы нескольких сотрудников объединяются в одну смену, чтобы выручка и SLA не дублировались. Персональный рейтинг не строится.</p>
        </>}
      </div>}

      {summary.sla_incident_trends && <div className="adm-card p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{color:'var(--color-mid)'}}>SLA — динамика инцидентов</p>
        {summary.sla_incident_trends.breaches === 0 ? <p className="text-sm" style={{color:'var(--color-mid)'}}>За выбранный период SLA-просрочек не зафиксировано.</p> : <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Stat label="Просрочек" value={String(summary.sla_incident_trends.breaches)} />
            <Stat label="Закрыто" value={`${summary.sla_incident_trends.resolved} · ${summary.sla_incident_trends.resolution_rate_pct ?? '—'}%`} />
            <Stat label="Среднее устранение" value={`${summary.sla_incident_trends.avg_resolution_minutes} мин`} />
            <Stat label="К прошлому периоду" value={summary.sla_incident_trends.breach_change_pct === null ? 'нет базы' : `${summary.sla_incident_trends.breach_change_pct > 0 ? '+' : ''}${summary.sla_incident_trends.breach_change_pct}%`} />
          </div>
          {summary.sla_incident_trends.by_station.length > 0 && <div className="space-y-2">{summary.sla_incident_trends.by_station.map(row => <div key={row.station} className="rounded-xl p-3 flex items-center justify-between" style={{background:'var(--color-card2)'}}><span className="text-sm" style={{color:'var(--color-soft)'}}>{row.station === 'handoff' ? 'Ready → Served' : row.station === 'bar' ? 'Бар' : row.station === 'kitchen' ? 'Кухня' : row.station}</span><b className="text-sm" style={{color:'#fb7185'}}>{row.breaches} просрочек</b></div>)}</div>}
          {summary.sla_incident_trends.peak_hour && <p className="text-xs mt-3" style={{color:'var(--color-mid)'}}>Пиковый час инцидентов: <b>{String(summary.sla_incident_trends.peak_hour.hour).padStart(2,'0')}:00</b> · {summary.sla_incident_trends.peak_hour.breaches}</p>}
          <p className="text-[10px] mt-2" style={{color:'var(--color-dim)'}}>Считаются только фактические SLA breaches из durable журнала; предупреждения 80% не считаются нарушениями.</p>
        </>}
      </div>}

      {slaIncidents.length > 0 && <div id="sla-incident-log" className="adm-card p-5 mb-5 scroll-mt-4">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{color:'var(--color-mid)'}}>Журнал SLA-инцидентов</p>
        <div className="space-y-2">{slaIncidents.slice(0,8).map((i:any) => <div key={i.id} className="rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{background:'var(--color-card2)'}}>
          <div><b className="text-sm" style={{color:'var(--color-soft)'}}>Стол {i.table_number} · {i.item_name}</b><p className="text-[11px]" style={{color:'var(--color-mid)'}}>{i.kind === 'handoff' ? 'Ready → Served' : `Приготовление · ${i.station}`} · цель {i.target_minutes} мин</p></div>
          <div className="flex items-center gap-2"><span className="text-xs font-bold" style={{color:i.resolved_at ? '#4ade80' : '#fb7185'}}>{i.resolved_at ? 'Закрыт' : 'Активен'}</span>{i.session_id && <button className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold" style={{border:'1px solid var(--color-rim)',color:'var(--color-soft)'}} onClick={() => { setTab('sessions'); setSessionDetail(i.session_id) }}>К заказу →</button>}</div>
        </div>)}</div>
      </div>}

      {summary.kitchen_sla && <div className="adm-card p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{color:'var(--color-mid)'}}>Kitchen SLA</p>
        {summary.kitchen_sla.measured_items === 0 ? (
          <p className="text-sm" style={{color:'var(--color-mid)'}}>Пока нет завершённых блюд с полными временными отметками.</p>
        ) : <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Stat label="Среднее приготовление" value={`${summary.kitchen_sla.avg_prep_minutes} мин`} />
            <Stat label="p95 приготовления" value={`${summary.kitchen_sla.p95_prep_minutes} мин`} />
            <Stat label="SLA выполнен" value={summary.kitchen_sla.sla_met_pct === null ? '—' : `${summary.kitchen_sla.sla_met_pct}%`} />
            <Stat label={`Ready → Served ≤ ${summary.kitchen_sla.ready_to_served_target_minutes}м`} value={`${summary.kitchen_sla.avg_ready_to_served_minutes} мин · ${summary.kitchen_sla.handoff_sla_met_pct ?? '—'}% SLA`} />
          </div>
          <div className="space-y-2">
            {summary.kitchen_sla.stations.map(st => <div key={st.station} className="rounded-xl p-3 flex items-center justify-between gap-3" style={{background:'var(--color-card2)'}}>
              <div><p className="text-sm font-bold" style={{color:'var(--color-soft)'}}>{st.station === 'bar' ? 'Бар' : st.station === 'kitchen' ? 'Кухня' : st.station}</p><p className="text-[10px]" style={{color:'var(--color-dim)'}}>цель ≤ {st.target_minutes} мин · {st.measured_items} блюд</p></div>
              <div className="text-right"><p className="text-sm font-bold" style={{color:'var(--color-gold)'}}>{st.avg_prep_minutes} мин avg · {st.p95_prep_minutes} p95</p><p className="text-[10px]" style={{color: st.late_items ? '#fb7185' : '#4ade80'}}>{st.late_items} просрочено · {st.sla_met_pct ?? '—'}% SLA</p></div>
            </div>)}
          </div>
          {summary.kitchen_sla.overload_hour && <p className="text-xs mt-3" style={{color:'var(--color-mid)'}}>Час перегрузки: <b>{String(summary.kitchen_sla.overload_hour.hour).padStart(2,'0')}:00</b> · {summary.kitchen_sla.overload_hour.late_items} просроченных блюд</p>}
        </>}
      </div>}

      </>}


      {summary.service_recovery && <div className="adm-card p-5 mb-5">
        <div className="flex items-start justify-between gap-3 mb-3"><div><p className="text-xs font-bold uppercase tracking-[2px]" style={{color:'var(--color-mid)'}}>Восстановление сервиса</p><p className="text-[10px] mt-1" style={{color:'var(--color-dim)'}}>Фактические причины и компенсации · без AI</p></div></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <Stat label="Recovery-кейсов" value={String(summary.service_recovery.total)} />
          <Stat label="Компенсации" value={`${Number(summary.service_recovery.compensation_cost).toLocaleString('ru')} ₸`} />
          <Stat label="Recovery coverage" value={summary.service_recovery.coverage_pct==null?'нет базы':`${summary.service_recovery.coverage_pct}%`} />
          <div className="adm-card p-4 mb-0"><p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{color:'var(--color-mid)'}}>Кейсы к прошлому</p><Delta value={summary.service_recovery.total_change_pct}/></div>
          <div className="adm-card p-4 mb-0"><p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{color:'var(--color-mid)'}}>Стоимость к прошлому</p><Delta value={summary.service_recovery.cost_change_pct}/></div>
        </div>
        {summary.service_recovery.total === 0 ? <p className="text-sm" style={{color:'var(--color-mid)'}}>За выбранный период recovery-кейсов не зафиксировано.</p> : <>
          <div className="space-y-2 mb-4">{summary.service_recovery.reasons.map(r => { const max = Math.max(...summary.service_recovery.reasons.map(x=>x.count),1); const labels:any={delay:'Задержка',quality:'Качество',wrong_order:'Ошибка заказа',service:'Сервис',payment:'Оплата',other:'Другое'}; return <div key={r.reason} className="rounded-xl p-3" style={{background:'var(--color-card2)'}}><div className="flex items-center justify-between gap-3 mb-2"><b className="text-xs" style={{color:'var(--color-soft)'}}>{labels[r.reason]||r.reason}</b><span className="text-xs" style={{color:'var(--color-mid)'}}>{r.count} · {Number(r.cost||0).toLocaleString('ru')} ₸</span></div><div className="h-2 rounded-full overflow-hidden" style={{background:'var(--color-card)'}}><div className="h-full rounded-full" style={{width:`${Math.max(6,r.count/max*100)}%`,background:'var(--color-gold)'}} /></div></div> })}</div>
          {summary.service_recovery.recent.length > 0 && <><p className="text-[10px] font-bold uppercase tracking-[1.5px] mb-2" style={{color:'var(--color-dim)'}}>Последние кейсы</p><div className="space-y-2">{summary.service_recovery.recent.map(r => <div key={r.id} className="rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{background:'var(--color-card2)'}}><div className="min-w-0"><p className="text-sm font-bold" style={{color:'var(--color-soft)'}}>Стол {r.table_number} · {Number(r.compensation_amount||0).toLocaleString('ru')} ₸</p><p className="text-[11px] truncate" style={{color:'var(--color-mid)'}}>{r.note}</p><p className="text-[10px] mt-1" style={{color:'var(--color-dim)'}}>{new Date(r.created_at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</p></div><button className="shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold" style={{border:'1px solid var(--color-rim)',color:'var(--color-soft)'}} onClick={()=>{setTab('sessions');setSessionDetail(r.session_id)}}>К заказу →</button></div>)}</div></>}
        </>}
      </div>}

      {summary?.upsell && (
        <div className="adm-card p-5 mb-5">
          <p className="text-xs font-bold uppercase tracking-[2px] mb-3" style={{ color: 'var(--color-mid)' }}>Допродажи Plait</p>
          <p className="text-3xl font-bold mb-1" style={{ color: 'var(--color-gold)' }}>+{Number(summary.upsell.revenue).toLocaleString('ru')} ₸</p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-mid)' }}>доказанная дополнительная выручка по правилам · {total > 0 ? `${(Number(summary.upsell.revenue) / Number(total) * 100).toFixed(1)}% от выручки` : '0% от выручки'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Stat label="Показов" value={String(summary.upsell.impressions)} />
            <Stat label="Добавили" value={String(summary.upsell.adds)} />
            <Stat label="Купили" value={String(summary.upsell.conversions)} />
            <Stat label="Конверсия" value={`${summary.upsell.conversion_rate}%`} />
          </div>
          {summary.upsell.top_rules.length > 0 && <div className="space-y-2">
            {summary.upsell.top_rules.map(r => <div key={r.rule_id} className="flex items-center justify-between gap-3 text-xs">
              <span style={{ color: 'var(--color-soft)' }}>{r.rule__trigger_item__name} → {r.rule__recommended_item__name}</span>
              <b style={{ color: 'var(--color-gold)' }}>+{Number(r.revenue).toLocaleString('ru')} ₸</b>
            </div>)}
          </div>}
        </div>
      )}

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
