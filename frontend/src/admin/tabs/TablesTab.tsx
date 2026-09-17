import React, { useEffect, useState } from 'react'
import { QrCode, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'
import { isRestricted, effectiveTableIds } from '../lib/effectiveTables'
import ZoneManager from '../components/ZoneManager'
import type { Table } from '../../types'

// Ссылка стола: гостевое меню и админка на одном хостинге → берём origin из адресной строки
const tableUrl = (slug: string, table: Table) =>
  `${window.location.origin}/?slug=${slug}&token=${table.token}`

export default function TablesTab() {
  const { tables, zones, sessions, staff, profile, isAdmin, rest, djangoRestId, setSessionDetail } = useAdminStore()
  const [bulkPrinting, setBulkPrinting] = useState(false)

  const me = staff.find(s => s.id === profile?.id)
  const restricted = isRestricted(me)
  const myEffectiveIds = effectiveTableIds(me, tables)
  const visible = restricted ? tables.filter(t => myEffectiveIds.has(t.id)) : tables

  const openTable = (num: number) => {
    const s = sessions.find(x => x.tableNumber === num)
    if (!s) { useAdminStore.getState().showToast(`Стол ${num} свободен`); return }
    useAdminStore.getState().setSessionDetail(s.id)
  }

  const setTableZone = async (tableId: string, zoneId: string) => {
    if (!djangoRestId) return
    try {
      await api.setTableZone(djangoRestId, tableId, zoneId || null)
      const st = useAdminStore.getState()
      st.setTables(st.tables.map(t => (t.id === tableId ? { ...t, zoneId: zoneId || null } : t)) as any)
    } catch (e: any) {
      useAdminStore.getState().showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  // Массовая печать: показываем печатный блок и открываем диалог печати
  useEffect(() => {
    if (!bulkPrinting) return
    const timer = setTimeout(() => window.print(), 60)
    const onAfterPrint = () => setBulkPrinting(false)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [bulkPrinting])

  // ── Один стол на «схеме зала» — вынесено, чтобы переиспользовать в группах по зонам ──
  const renderTableButton = (t: Table) => {
    const sess = sessions.find(x => x.tableNumber === t.number)
    const hasReady = sess && (sess.items ?? []).some(i => i.status === 'ready')
    const hasPending = sess && (sess.items ?? []).some(i => i.status === 'pending')
    const isPaying = sess?.status === 'payment_requested'
    const occupied = !!sess

    let borderColor = 'var(--card-border)'
    let shadow = 'var(--card-shadow)'
    let textColor = 'var(--color-mid)'

    if (hasReady) {
      borderColor = 'rgba(76,175,80,.55)'
      shadow = '0 0 16px rgba(76,175,80,.20), 0 4px 12px rgba(0,0,0,.4)'
      textColor = 'var(--color-green)'
    } else if (hasPending) {
      borderColor = 'rgba(255,107,26,.55)'
      shadow = '0 0 16px rgba(255,107,26,.20), 0 4px 12px rgba(0,0,0,.4)'
      textColor = 'var(--color-gold)'
    } else if (isPaying) {
      borderColor = 'rgba(255,107,26,.55)'
      shadow = '0 0 16px rgba(255,107,26,.18), 0 4px 12px rgba(0,0,0,.4)'
      textColor = 'var(--color-gold)'
    } else if (occupied) {
      borderColor = 'rgba(245,158,11,.40)'
      shadow = '0 4px 12px rgba(0,0,0,.35)'
      textColor = 'var(--color-orange)'
    }

    return (
      <button key={t.id} onClick={() => openTable(t.number)}
        className="h-16 rounded-2xl flex items-center justify-center font-bold text-xl relative transition-all active:scale-90"
        style={{
          background: 'var(--color-card)',
          border: `1.5px solid ${borderColor}`,
          boxShadow: shadow,
          color: textColor,
        }}>
        {t.number}
        {occupied && !hasReady && !hasPending && (
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
               style={{ background: isPaying ? 'var(--color-gold)' : 'var(--color-orange)' }} />
        )}
        {hasPending && !hasReady && (
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full animate-pulse"
               style={{ background: 'var(--color-gold)' }} />
        )}
        {hasReady && (
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
               style={{ background: 'var(--color-green)' }} />
        )}
      </button>
    )
  }

  // ── Группировка «схемы зала» по зонам (+ «Без зоны» в конце) ──
  const zoneSections = [
    ...zones.map(z => ({ key: z.id, name: z.name, color: z.color, items: visible.filter(t => t.zoneId === z.id) })),
    {
      key: '__none__',
      name: 'Без зоны',
      color: undefined as string | undefined,
      items: visible.filter(t => !t.zoneId || !zones.some(z => z.id === t.zoneId)),
    },
  ].filter(sec => sec.items.length > 0)
  const showZoneGroups = zones.length > 0

  return (
    <>
      <div className="px-4 py-5">
        <p className="text-[10px] tracking-[3px] uppercase font-medium mb-5"
           style={{ color: 'rgba(255,107,26,.6)' }}>Схема зала</p>

        <div className="mb-8">
          {showZoneGroups ? (
            zoneSections.map(sec => (
              <div key={sec.key} className="mb-5 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  {sec.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sec.color }} />}
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-mid)' }}>{sec.name}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: 'var(--color-card2)', color: 'var(--color-dim)' }}>
                    {sec.items.length}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--color-rim)' }} />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {sec.items.map(renderTableButton)}
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {visible.map(renderTableButton)}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="adm-card p-4">
          <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--color-dim)' }}>
            Обозначения
          </p>
          <div className="flex flex-col gap-2">
            {[
              { color: 'var(--card-border)',        label: 'Свободен',      text: 'var(--color-mid)' },
              { color: 'rgba(245,158,11,.5)',        label: 'Занят',         text: 'var(--color-orange)' },
              { color: 'rgba(255,107,26,.55)',       label: 'Новые позиции / ожидает оплату', text: 'var(--color-gold)' },
              { color: 'rgba(76,175,80,.55)',        label: 'Блюда готовы',  text: 'var(--color-green)' },
            ].map(({ color, label, text }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-10 h-7 rounded-lg border-2 flex-shrink-0"
                     style={{ borderColor: color, background: 'var(--color-card2)' }} />
                <span className="text-sm font-medium" style={{ color: text }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Зоны — управление (создание/переименование/удаление), только для админа */}
        {isAdmin && (
          <>
            <p className="text-[10px] tracking-[3px] uppercase font-medium mt-8 mb-5"
               style={{ color: 'rgba(255,107,26,.6)' }}>Зоны зала</p>
            <ZoneManager />
          </>
        )}

        {/* QR-коды столов */}
        <div className="flex items-center justify-between mt-8 mb-5">
          <p className="text-[10px] tracking-[3px] uppercase font-medium"
             style={{ color: 'rgba(255,107,26,.6)' }}>QR-коды столов</p>
          {visible.length > 0 && (
            <button onClick={() => setBulkPrinting(true)}
              className="h-9 px-4 rounded-xl text-xs font-bold text-black flex items-center gap-1.5 transition-all active:scale-95"
              style={{ background: 'var(--color-gold)' }}>
              <Printer size={14} /> Печать всех QR
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <span className="text-4xl opacity-30">🍽️</span>
            <p className="text-sm" style={{ color: 'var(--color-dim)' }}>Столов нет</p>
          </div>
        ) : (
          visible.map(t => (
            <div key={t.id} className="adm-card flex items-center gap-3 p-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base flex-shrink-0"
                   style={{ background: 'rgba(255,107,26,.12)', border: '1px solid rgba(255,107,26,.2)',
                            color: 'var(--color-gold)' }}>
                {t.number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-soft)' }}>
                  Стол №{t.number}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-mid)' }}>
                  {t.isActive === false ? 'Неактивен' : 'Активен'}
                </p>
              </div>
              {isAdmin && zones.length > 0 && (
                <select value={t.zoneId ?? ''} onChange={e => setTableZone(t.id, e.target.value)}
                  className="h-9 px-2.5 rounded-xl text-xs font-semibold outline-none flex-shrink-0"
                  style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)',
                           color: 'var(--color-mid)' }}>
                  <option value="">Без зоны</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              )}
              <button onClick={() => useAdminStore.getState().setQrTableId(t.id)}
                className="h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-90"
                style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)',
                         color: 'var(--color-mid)' }}>
                <QrCode size={14} /> QR
              </button>
            </div>
          ))
        )}
      </div>

      {/* Печатная страница — вся сетка QR, скрыта, показывается только через @media print */}
      {bulkPrinting && (
        <div className="adm-qr-print">
          <div className="adm-qr-bulk-grid">
            {visible.map(t => (
              <div key={t.id} className="adm-qr-card">
                <p className="adm-qr-restaurant">{rest?.name ?? ''}</p>
                <QRCodeSVG value={tableUrl(rest?.slug ?? '', t)} size={190} level="H" marginSize={4}
                  fgColor="#000000" bgColor="#ffffff" title={`QR стола №${t.number}`} />
                <p className="adm-qr-tablenum">№{t.number}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
