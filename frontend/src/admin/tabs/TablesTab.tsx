import React, { useEffect, useState } from 'react'
import { Download, QrCode, Printer, Plus, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'
import { isRestricted, effectiveTableIds } from '../lib/effectiveTables'
import ZoneManager from '../components/ZoneManager'
import type { Table } from '../../types'
import { downloadBulkQrPdf } from '../lib/qrPdf'

// Ссылка стола: гостевое меню и админка на одном хостинге → берём origin из адресной строки
const tableUrl = (slug: string, table: Table) =>
  `${window.location.origin}/?slug=${slug}&token=${table.token}`

export default function TablesTab() {
  const { tables, zones, sessions, staff, profile, isAdmin, rest, djangoRestId, setSessionDetail } = useAdminStore()
  const [bulkPrinting, setBulkPrinting] = useState(false)
  const [pdfExporting, setPdfExporting] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkStart, setBulkStart] = useState('1')
  const [bulkEnd, setBulkEnd] = useState('10')
  const [bulkZone, setBulkZone] = useState('')
  const [bulkCreating, setBulkCreating] = useState(false)
  const [bulkError, setBulkError] = useState('')

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

  const createBulkTables = async () => {
    if (!djangoRestId || bulkCreating) return
    const start = Number(bulkStart)
    const end = Number(bulkEnd)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
      setBulkError('Укажите корректный диапазон, например 1–30.')
      return
    }
    if (end - start + 1 > 200) {
      setBulkError('За одну операцию можно создать не более 200 столов.')
      return
    }
    setBulkCreating(true)
    setBulkError('')
    try {
      const created = await api.createTablesBulk(djangoRestId, {
        start, end, zone: bulkZone || null,
      })
      const normalized = created.map(t => ({ ...t, zoneId: t.zone ?? null }))
      const st = useAdminStore.getState()
      st.setTables([...st.tables, ...normalized].sort((a: any, b: any) => a.number - b.number) as any)
      st.showToast(`Создано столов: ${created.length}`)
      setBulkOpen(false)
    } catch (e: any) {
      const duplicates = e?.data?.numbers
      setBulkError(
        Array.isArray(duplicates) && duplicates.length
          ? `Уже существуют столы: ${duplicates.join(', ')}. Ничего не создано.`
          : (e?.data?.detail ?? e?.message ?? 'Не удалось создать столы. Попробуйте ещё раз.')
      )
    } finally {
      setBulkCreating(false)
    }
  }

  const exportPdf = async () => {
    if (pdfExporting || visible.length === 0) return
    setPdfExporting(true)
    setPdfError('')
    try {
      const cards = visible.map(t => {
        const svg = document.querySelector<SVGSVGElement>(`[data-pdf-qr="${t.id}"] svg`)
        if (!svg) throw new Error(`QR стола №${t.number} ещё не готов. Повторите попытку.`)
        return { tableNumber: t.number, qrSvg: svg }
      })
      const safeName = (rest?.name || 'restaurant').replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, '-').replace(/^-+|-+$/g, '')
      await downloadBulkQrPdf(rest?.name ?? 'Plait', cards, `${safeName || 'restaurant'}-qr-tables.pdf`)
      useAdminStore.getState().showToast(`PDF готов: ${visible.length} QR`)
    } catch (e: any) {
      setPdfError(e?.message ?? 'Не удалось создать PDF. Попробуйте ещё раз.')
    } finally {
      setPdfExporting(false)
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

        {isAdmin && (
          <div className="mt-8 adm-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--color-soft)' }}>Быстро создать столы</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-mid)' }}>Создайте диапазон 1–N одной операцией без частичных результатов.</p>
              </div>
              <button onClick={() => { setBulkOpen(v => !v); setBulkError('') }}
                className="h-10 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
                style={{ background: 'var(--color-gold)', color: '#000' }}>
                {bulkOpen ? <X size={15} /> : <Plus size={15} />} {bulkOpen ? 'Закрыть' : 'Столы 1–N'}
              </button>
            </div>
            {bulkOpen && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs" style={{ color: 'var(--color-mid)' }}>
                    От
                    <input inputMode="numeric" value={bulkStart} onChange={e => setBulkStart(e.target.value)} disabled={bulkCreating}
                      className="mt-1 w-full h-11 px-3 rounded-xl outline-none"
                      style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)', color: 'var(--color-soft)' }} />
                  </label>
                  <label className="text-xs" style={{ color: 'var(--color-mid)' }}>
                    До
                    <input inputMode="numeric" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} disabled={bulkCreating}
                      className="mt-1 w-full h-11 px-3 rounded-xl outline-none"
                      style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)', color: 'var(--color-soft)' }} />
                  </label>
                </div>
                {zones.length > 0 && (
                  <label className="text-xs" style={{ color: 'var(--color-mid)' }}>
                    Зона (необязательно)
                    <select value={bulkZone} onChange={e => setBulkZone(e.target.value)} disabled={bulkCreating}
                      className="mt-1 w-full h-11 px-3 rounded-xl outline-none"
                      style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)', color: 'var(--color-soft)' }}>
                      <option value="">Без зоны</option>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </label>
                )}
                {bulkError && <p className="text-xs rounded-xl p-3" style={{ color: 'var(--color-red)', background: 'rgba(239,68,68,.08)' }}>{bulkError}</p>}
                <button onClick={createBulkTables} disabled={bulkCreating}
                  className="h-11 rounded-xl text-sm font-bold disabled:opacity-60"
                  style={{ background: 'var(--color-gold)', color: '#000' }}>
                  {bulkCreating ? 'Создаём…' : `Создать столы ${bulkStart || '?'}–${bulkEnd || '?'}`}
                </button>
              </div>
            )}
          </div>
        )}

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
          {visible.length > 0 && isAdmin && (
            <div className="flex items-center gap-2">
              <button onClick={() => setBulkPrinting(true)} disabled={pdfExporting}
                className="h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)', color: 'var(--color-mid)' }}>
                <Printer size={14} /> Печать
              </button>
              <button onClick={exportPdf} disabled={pdfExporting}
                className="h-9 px-3 rounded-xl text-xs font-bold text-black flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60"
                style={{ background: 'var(--color-gold)' }}>
                <Download size={14} /> {pdfExporting ? 'PDF…' : 'Скачать PDF'}
              </button>
            </div>
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

      {pdfError && isAdmin && (
        <div className="mx-4 mb-4 rounded-xl p-3 text-xs" style={{ color: 'var(--color-red)', background: 'rgba(239,68,68,.08)' }}>
          {pdfError}
        </div>
      )}

      {/* Hidden SVG source for dependency-free PDF rasterization. */}
      {isAdmin && visible.length > 0 && (
        <div aria-hidden="true" style={{ position: 'fixed', left: '-10000px', top: 0, width: 1, height: 1, overflow: 'hidden' }}>
          {visible.map(t => (
            <div key={t.id} data-pdf-qr={t.id}>
              <QRCodeSVG value={tableUrl(rest?.slug ?? '', t)} size={420} level="H" marginSize={4} fgColor="#000000" bgColor="#ffffff" />
            </div>
          ))}
        </div>
      )}

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
