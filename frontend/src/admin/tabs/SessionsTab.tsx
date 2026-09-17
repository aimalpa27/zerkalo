import React, { useEffect, useRef, useState } from 'react'
import { useAdminStore, playAdminAlertSound } from '../store'
import SessionCard from '../components/SessionCard'
import { normalizeStatus, isKitchenVisible, isServeable } from '../../lib/itemStatus'
import { awaitingItems, escalationLevel } from '../lib/orderConfirmation'
import { isRestricted, effectiveTableIds } from '../lib/effectiveTables'
import type { Table, TableSession } from '../../types'

// ── Приоритет для сортировки ──────────────────────────────────────────────────
function sessionPriority(s: TableSession): number {
  if (awaitingItems(s).length > 0) return -1        // Требуют подтверждения — самые первые
  if (s.status === 'payment_requested') return 0     // Ждут оплату
  const items = s.items ?? []
  if (items.some(i => isServeable(normalizeStatus(i.status))))     return 1 // Готово к подаче
  if (items.some(i => isKitchenVisible(normalizeStatus(i.status)))) return 2 // Готовится
  return 3                                                          // Открыт
}

// ── Метка группы ─────────────────────────────────────────────────────────────
function groupLabel(priority: number): string {
  if (priority === -1) return '🔔 Требуют подтверждения'
  if (priority === 0) return '💳 Ожидают оплату'
  if (priority === 1) return '✅ Готово к подаче'
  if (priority === 2) return '🍳 Готовится'
  return '🟡 Активные'
}

export default function SessionsTab() {
  const { sessions, staff, tables, zones, profile, isAdmin, setNewOrderOpen, operationalLoadState, operationalLoadError, operationalLastUpdatedAt, requestOperationalReload } = useAdminStore()
  const [, forceTick] = useState(0)
  const [zoneFilter, setZoneFilter] = useState<string>('all')   // 'all' | 'unzoned' | zoneId
  const lastPlayedAt = useRef<Map<string, number>>(new Map())

  // Живой таймер эскалации: пересчитываем подсветку карточек и звеним
  // повторно, пока сессия ждёт подтверждения — независимо от опроса/WS.
  useEffect(() => {
    const checkEscalation = () => {
      const { sessions: curSessions, rest: curRest } = useAdminStore.getState()
      curSessions.forEach(s => {
        if (!awaitingItems(s).length) { lastPlayedAt.current.delete(s.id); return }
        const level = escalationLevel(s, curRest)
        if (level === 'none') return
        const last = lastPlayedAt.current.get(s.id) ?? 0
        const repeatMs = level === 'escalate' ? 15000 : 60000 // reminder — раз, escalate — повторно каждые 15с
        if (Date.now() - last >= repeatMs) {
          playAdminAlertSound()
          lastPlayedAt.current.set(s.id, Date.now())
        }
      })
      forceTick(t => t + 1) // перерисовать карточки (живая подсветка/таймеры)
    }
    checkEscalation()
    const id = setInterval(checkEscalation, 5000)
    return () => clearInterval(id)
  }, [])

  // Фильтр по столам для официанта — гибрид: назначенные зоны целиком ∪ отдельные столы
  const me = staff.find(s => s.id === profile?.id)
  const restrictedByAssignment = !isAdmin && isRestricted(me)
  const myEffectiveIds = effectiveTableIds(me, tables)
  const inMyScope = (s: TableSession) => {
    if (s.tableId && myEffectiveIds.has(s.tableId)) return true
    // Фолбэк по tableNumber — на случай если tableId сессии не матчится с текущим столом
    const t = tables.find(x => x.number === s.tableNumber)
    return t ? myEffectiveIds.has(t.id) : false
  }
  const assignedScope = restrictedByAssignment ? sessions.filter(inMyScope) : sessions

  // Зона стола сессии — живой join (актуальная зона стола на схеме зала, а не
  // зафиксированная в сессии на момент заказа — это фильтр для оперативной работы).
  const sessionZoneId = (s: TableSession): string | null => {
    const t = tables.find((x: Table) => x.id === s.tableId) ?? tables.find((x: Table) => x.number === s.tableNumber)
    return t?.zoneId ?? null
  }

  // Фильтр по зонам (чипы) — только для админа, применяется поверх фильтра по назначению
  const visible = (isAdmin && zoneFilter !== 'all')
    ? assignedScope.filter(s => zoneFilter === 'unzoned' ? !sessionZoneId(s) : sessionZoneId(s) === zoneFilter)
    : assignedScope

  // Сортировка: приоритет → внутри группы по времени (старые вверху)
  const sorted = [...visible].sort((a, b) => {
    const pd = sessionPriority(a) - sessionPriority(b)
    if (pd !== 0) return pd
    return a.createdAt - b.createdAt   // старше = ждёт дольше = вверху
  })

  // Группировка
  const groups: { priority: number; items: TableSession[] }[] = []
  sorted.forEach(s => {
    const p = sessionPriority(s)
    const last = groups[groups.length - 1]
    if (last && last.priority === p) last.items.push(s)
    else groups.push({ priority: p, items: [s] })
  })

  const noSnapshot = operationalLastUpdatedAt === null

  return (
    <div className="px-4 py-4">
      {operationalLoadState === 'loading' && noSnapshot && (
        <div className="adm-card p-4 mb-4 text-sm" style={{ color: 'var(--color-mid)' }}>⏳ Загружаем активные счета…</div>
      )}
      {operationalLoadState === 'error' && (
        <div className="adm-card p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between" style={{ border: '1px solid rgba(255,107,26,.35)' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-soft)' }}>{noSnapshot ? 'Не удалось загрузить счета' : 'Связь с сервером нестабильна'}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-mid)' }}>{operationalLoadError}</p>
            {!noSnapshot && <p className="text-[11px] mt-1" style={{ color: 'var(--color-dim)' }}>Показаны последние данные · {new Date(operationalLastUpdatedAt!).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })}</p>}
          </div>
          <button onClick={requestOperationalReload} className="h-9 px-4 rounded-xl text-xs font-bold" style={{ background: 'var(--color-gold)', color:'#000' }}>Повторить</button>
        </div>
      )}
      {/* ── Заголовок с кнопкой ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] tracking-[3px] uppercase font-medium"
             style={{ color: 'rgba(255,107,26,.6)' }}>Активные счета</p>
          {visible.length > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-dim)' }}>
              {visible.length} {visible.length === 1 ? 'стол' : 'столов'} обслуживается
            </p>
          )}
        </div>
        <button
          onClick={() => setNewOrderOpen(true)}
          className="h-9 px-4 rounded-xl text-xs font-bold text-black transition-all active:scale-95"
          style={{ background: 'var(--color-gold)' }}
        >
          + Новый заказ
        </button>
      </div>

      {/* ── Фильтр по зонам (только админ) ── */}
      {isAdmin && zones.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          <button onClick={() => setZoneFilter('all')}
            className="flex-shrink-0 h-8 px-3 rounded-xl text-xs font-bold transition-all"
            style={zoneFilter === 'all'
              ? { background: 'var(--color-gold)', color: '#000' }
              : { background: 'var(--color-card)', color: 'var(--color-mid)', border: '1px solid var(--card-border)' }}>
            Все
          </button>
          {zones.map(z => (
            <button key={z.id} onClick={() => setZoneFilter(z.id)}
              className="flex-shrink-0 h-8 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              style={zoneFilter === z.id
                ? { background: 'var(--color-gold)', color: '#000' }
                : { background: 'var(--color-card)', color: 'var(--color-mid)', border: '1px solid var(--card-border)' }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: z.color || 'currentColor' }} />
              {z.name}
            </button>
          ))}
          <button onClick={() => setZoneFilter('unzoned')}
            className="flex-shrink-0 h-8 px-3 rounded-xl text-xs font-bold transition-all"
            style={zoneFilter === 'unzoned'
              ? { background: 'var(--color-gold)', color: '#000' }
              : { background: 'var(--color-card)', color: 'var(--color-mid)', border: '1px solid var(--card-border)' }}>
            Без зоны
          </button>
        </div>
      )}

      {/* ── Пусто ── */}
      {visible.length === 0 && !(operationalLoadState === 'loading' && noSnapshot) && !(operationalLoadState === 'error' && noSnapshot) && (
        <div className="flex flex-col items-center py-16 gap-3">
          <span className="text-5xl opacity-20">📋</span>
          <p className="text-sm font-medium" style={{ color: 'var(--color-mid)' }}>
            Нет активных счетов
          </p>
          <p className="text-xs" style={{ color: 'var(--color-dim)' }}>
            Нажмите «+ Новый заказ» чтобы открыть стол
          </p>
        </div>
      )}

      {/* ── Группы ── */}
      {groups.map(({ priority, items }) => (
        <div key={priority} className="mb-4">
          {/* Разделитель группы */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--color-dim)' }}>
              {groupLabel(priority)}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: 'var(--color-card2)', color: 'var(--color-dim)' }}>
              {items.length}
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--color-rim)' }} />
          </div>

          {items.map(s => <SessionCard key={s.id} session={s} />)}
        </div>
      ))}
    </div>
  )
}
