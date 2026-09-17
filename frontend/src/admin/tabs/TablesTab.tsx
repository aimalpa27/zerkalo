import React, { useEffect, useState } from 'react'
import { QrCode, Printer, Plus } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { api, apiRequest } from '../../lib/api'
import { useAdminStore } from '../store'
import { isRestricted, effectiveTableIds } from '../lib/effectiveTables'
import ZoneManager from '../components/ZoneManager'
import type { Table } from '../../types'

const tableUrl = (slug: string, table: Table) => `${window.location.origin}/?slug=${slug}&token=${table.token}`

export default function TablesTab() {
  const { tables, zones, sessions, staff, profile, isAdmin, rest, djangoRestId } = useAdminStore()
  const [bulkPrinting, setBulkPrinting] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [start, setStart] = useState(1)
  const [end, setEnd] = useState(10)
  const [zoneId, setZoneId] = useState('')
  const [creating, setCreating] = useState(false)
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

  const setTableZone = async (tableId: string, nextZoneId: string) => {
    if (!djangoRestId) return
    try {
      await api.setTableZone(djangoRestId, tableId, nextZoneId || null)
      const st = useAdminStore.getState()
      st.setTables(st.tables.map(t => t.id === tableId ? { ...t, zoneId: nextZoneId || null } : t) as any)
    } catch (e: any) { useAdminStore.getState().showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз')) }
  }

  const createBulk = async () => {
    if (!djangoRestId || creating) return
    setBulkError('')
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end - start + 1 > 200) {
      setBulkError('Проверьте диапазон: от 1, не более 200 столов за раз.')
      return
    }
    setCreating(true)
    try {
      const result = await apiRequest<{ created: any[]; count: number }>(`/restaurants/${djangoRestId}/tables/bulk/`, {
        method: 'POST', body: JSON.stringify({ start, end, zone: zoneId || null }),
      })
      const fresh = await api.tables(djangoRestId)
      useAdminStore.getState().setTables(fresh.map((t: any) => ({ id: t.id, number: t.number, token: t.token, isActive: t.is_active, zoneId: t.zone ?? null })) as any)
      useAdminStore.getState().showToast(`Создано столов: ${result.count}`)
      setShowBulk(false)
    } catch (e: any) {
      const duplicates = e?.data?.duplicates
      setBulkError(duplicates?.length ? `Уже существуют столы: ${duplicates.join(', ')}` : (e?.message ?? 'Не удалось создать столы'))
    } finally { setCreating(false) }
  }

  useEffect(() => {
    if (!bulkPrinting) return
    const timer = setTimeout(() => window.print(), 60)
    const onAfterPrint = () => setBulkPrinting(false)
    window.addEventListener('afterprint', onAfterPrint)
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', onAfterPrint) }
  }, [bulkPrinting])

  const renderTableButton = (t: Table) => {
    const sess = sessions.find(x => x.tableNumber === t.number)
    const hasReady = sess && (sess.items ?? []).some(i => i.status === 'ready')
    const hasPending = sess && (sess.items ?? []).some(i => i.status === 'pending')
    const isPaying = sess?.status === 'payment_requested'
    const occupied = !!sess
    let borderColor = 'var(--card-border)', shadow = 'var(--card-shadow)', textColor = 'var(--color-mid)'
    if (hasReady) { borderColor='rgba(76,175,80,.55)'; shadow='0 0 16px rgba(76,175,80,.20)'; textColor='var(--color-green)' }
    else if (hasPending || isPaying) { borderColor='rgba(255,107,26,.55)'; shadow='0 0 16px rgba(255,107,26,.20)'; textColor='var(--color-gold)' }
    else if (occupied) { borderColor='rgba(245,158,11,.40)'; textColor='var(--color-orange)' }
    return <button key={t.id} onClick={() => openTable(t.number)} className="h-16 rounded-2xl flex items-center justify-center font-bold text-xl relative transition-all active:scale-90" style={{background:'var(--color-card)',border:`1.5px solid ${borderColor}`,boxShadow:shadow,color:textColor}}>{t.number}{occupied && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{background:hasReady?'var(--color-green)':hasPending||isPaying?'var(--color-gold)':'var(--color-orange)'}} />}</button>
  }

  const zoneSections = [...zones.map(z => ({key:z.id,name:z.name,color:z.color,items:visible.filter(t=>t.zoneId===z.id)})),{key:'__none__',name:'Без зоны',color:undefined as string|undefined,items:visible.filter(t=>!t.zoneId||!zones.some(z=>z.id===t.zoneId))}].filter(s=>s.items.length)

  return <>
    <div className="px-4 py-5">
      <div className="flex items-center justify-between mb-5"><p className="text-[10px] tracking-[3px] uppercase font-medium" style={{color:'rgba(255,107,26,.6)'}}>Схема зала</p>{isAdmin&&<button onClick={()=>{setBulkError('');setShowBulk(v=>!v)}} className="h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5" style={{background:'var(--color-gold)',color:'#000'}}><Plus size={14}/> Столы 1–N</button>}</div>
      {showBulk&&isAdmin&&<div className="adm-card p-4 mb-5"><p className="font-semibold mb-3">Массовое создание столов</p><div className="grid grid-cols-2 gap-3"><label className="text-xs">С номера<input type="number" min={1} value={start} onChange={e=>setStart(Number(e.target.value))} className="w-full mt-1 h-10 px-3 rounded-xl" style={{background:'var(--color-card2)',border:'1px solid var(--color-rim)'}}/></label><label className="text-xs">По номер<input type="number" min={1} value={end} onChange={e=>setEnd(Number(e.target.value))} className="w-full mt-1 h-10 px-3 rounded-xl" style={{background:'var(--color-card2)',border:'1px solid var(--color-rim)'}}/></label></div>{zones.length>0&&<select value={zoneId} onChange={e=>setZoneId(e.target.value)} className="w-full h-10 px-3 rounded-xl mt-3" style={{background:'var(--color-card2)',border:'1px solid var(--color-rim)'}}><option value="">Без зоны</option>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select>}{bulkError&&<p className="text-xs mt-3" style={{color:'#ef4444'}}>{bulkError}</p>}<button disabled={creating} onClick={createBulk} className="w-full h-11 rounded-xl mt-3 font-bold disabled:opacity-50" style={{background:'var(--color-gold)',color:'#000'}}>{creating?'Создаём…':`Создать ${Math.max(0,end-start+1)} столов`}</button></div>}
      <div className="mb-8">{zones.length>0?zoneSections.map(sec=><div key={sec.key} className="mb-5"><div className="flex items-center gap-2 mb-2">{sec.color&&<span className="w-2.5 h-2.5 rounded-full" style={{background:sec.color}}/>}<span className="text-xs font-semibold">{sec.name}</span><span className="text-[10px]">{sec.items.length}</span></div><div className="grid grid-cols-4 gap-3">{sec.items.map(renderTableButton)}</div></div>):<div className="grid grid-cols-4 gap-3">{visible.map(renderTableButton)}</div>}</div>
      {isAdmin&&<><p className="text-[10px] tracking-[3px] uppercase font-medium mt-8 mb-5" style={{color:'rgba(255,107,26,.6)'}}>Зоны зала</p><ZoneManager/></>}
      <div className="flex items-center justify-between mt-8 mb-5"><p className="text-[10px] tracking-[3px] uppercase font-medium" style={{color:'rgba(255,107,26,.6)'}}>QR-коды столов</p>{visible.length>0&&<button onClick={()=>setBulkPrinting(true)} className="h-9 px-4 rounded-xl text-xs font-bold text-black flex items-center gap-1.5" style={{background:'var(--color-gold)'}}><Printer size={14}/> Печать всех QR</button>}</div>
      {visible.length===0?<div className="flex flex-col items-center py-12 gap-3"><span className="text-4xl opacity-30">🍽️</span><p className="text-sm" style={{color:'var(--color-dim)'}}>Столов нет. Администратор может создать диапазон 1–N.</p></div>:visible.map(t=><div key={t.id} className="adm-card flex items-center gap-3 p-4"><div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold" style={{background:'rgba(255,107,26,.12)',color:'var(--color-gold)'}}>{t.number}</div><div className="flex-1"><p className="text-sm font-semibold">Стол №{t.number}</p><p className="text-xs" style={{color:'var(--color-mid)'}}>{t.isActive===false?'Неактивен':'Активен'}</p></div>{isAdmin&&zones.length>0&&<select value={t.zoneId??''} onChange={e=>setTableZone(t.id,e.target.value)} className="h-9 px-2 rounded-xl text-xs" style={{background:'var(--color-card2)'}}><option value="">Без зоны</option>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select>}<button onClick={()=>useAdminStore.getState().setQrTableId(t.id)} className="h-9 px-3 rounded-xl text-xs flex items-center gap-1"><QrCode size={14}/> QR</button></div>)}
    </div>
    {bulkPrinting&&<div className="adm-qr-print"><div className="adm-qr-bulk-grid">{visible.map(t=><div key={t.id} className="adm-qr-card"><p className="adm-qr-restaurant">{rest?.name??''}</p><QRCodeSVG value={tableUrl(rest?.slug??'',t)} size={190} level="H" marginSize={4}/><p className="adm-qr-tablenum">№{t.number}</p></div>)}</div></div>}
  </>
}
