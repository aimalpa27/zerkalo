import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'
import { normalizeStatus } from '../../lib/itemStatus'

export default function SessionDetailModal() {
  const { allSessions, sessionDetailId, djangoRestId, isAdmin, rest,
          setSessionDetail, showToast, showConfirm } = useAdminStore()

  const s = allSessions.find(x => x.id === sessionDetailId)
  const [timeline, setTimeline] = useState<any[]>([])
  const [quality, setQuality] = useState<any>(null)
  const [recoverySources, setRecoverySources] = useState<any[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState('')
  const [recoveries,setRecoveries]=useState<any[]>([])
  const [recoveryOpen,setRecoveryOpen]=useState(false)
  const [recoverySaving,setRecoverySaving]=useState(false)
  const [recoveryForm,setRecoveryForm]=useState({reason:'delay',note:'',compensation_type:'',compensation_amount:'',source:''})
  useEffect(() => {
    let live = true
    if (!djangoRestId || !sessionDetailId) return
    setTimelineLoading(true); setTimelineError('')
    Promise.all([api.sessionTimeline(djangoRestId, sessionDetailId), api.serviceRecoveries(djangoRestId, sessionDetailId).catch(()=>[])]).then(([r,recs]) => { if(live) { setTimeline(r.events); setQuality(r.quality_summary); setRecoverySources(r.recovery_sources||[]); setRecoveries(recs) } })
      .catch((e:any) => { if(live) setTimelineError(e?.message || 'Не удалось загрузить историю') })
      .finally(() => { if(live) setTimelineLoading(false) })
    return () => { live = false }
  }, [djangoRestId, sessionDetailId])
  const saveRecovery=async()=>{ if(!djangoRestId||!sessionDetailId||!recoveryForm.note.trim()) return; setRecoverySaving(true); try { const [source_type,source_id]=recoveryForm.source?recoveryForm.source.split(':'):['','']; const r=await api.createServiceRecovery(djangoRestId,sessionDetailId,{reason:recoveryForm.reason,note:recoveryForm.note,compensation_type:recoveryForm.compensation_type,compensation_amount:Number(recoveryForm.compensation_amount||0),source_type:source_type||undefined,source_id:source_id||undefined}); setRecoveries(x=>[r,...x]); setRecoveryForm({reason:'delay',note:'',compensation_type:'',compensation_amount:'',source:''}); setRecoveryOpen(false); showToast('Service recovery сохранён ✓'); const t=await api.sessionTimeline(djangoRestId,sessionDetailId); setTimeline(t.events); setRecoverySources(t.recovery_sources||[]) } catch(e:any){showToast('Ошибка: '+(e?.message||'не удалось сохранить'))} finally{setRecoverySaving(false)} }

  if (!s) return null

  const items = (s.items ?? []).filter(i => i.status !== 'cancelled')
  const isPaying = s.status === 'payment_requested'
  const canClose = isPaying && (isAdmin || !!rest?.allowWaiterClose)

  // Пер-item подтверждение: awaiting_confirmation → confirmed. Бэкенд проставит
  // confirmed_at и пересчитает итоги (позиция входит в счёт).
  const acceptItem = async (itemId: string) => {
    if (!djangoRestId) return
    try {
      await api.updateItemStatus(djangoRestId, s.id, itemId, 'confirmed')
      useAdminStore.getState().updateItemsStatus(s.id, [itemId], 'confirmed')
      showToast('Принято ✓')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const rejectItem = async (itemId: string) => {
    if (!djangoRestId) return
    try {
      await api.updateItemStatus(djangoRestId, s.id, itemId, 'rejected')
      useAdminStore.getState().updateItemsStatus(s.id, [itemId], 'rejected')
      showToast('Отклонено')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const markItemServed = async (itemId: string) => {
    if (!djangoRestId) return
    try {
      await api.updateItemStatus(djangoRestId, s.id, itemId, 'served')
      useAdminStore.getState().updateItemsStatus(s.id, [itemId], 'served')
      showToast('Подано ✓')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const reqPay = async () => {
    if (!djangoRestId) return
    try {
      await api.patchSessionStatus(djangoRestId, s.id, 'payment_requested')
      showToast('Запрос оплаты отправлен')
      setSessionDetail(null)
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const closeS = () => {
    showConfirm('Закрыть счёт?', async () => {
      if (!djangoRestId) return
      try {
        await api.closeSession(djangoRestId, s.id, s.paymentMethod || 'cash')
        showToast('Счёт закрыт')
        setSessionDetail(null)
      } catch (e: any) {
        showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
      }
    })
  }

  const stStyle = (rawStatus: string) => {
    const n = normalizeStatus(rawStatus)
    if (n === 'ready')                 return { bg: 'rgba(76,175,80,.12)',  color: 'var(--color-green)' }
    if (n === 'served')                return { bg: 'rgba(255,107,26,.1)',  color: 'var(--color-gold2)' }
    if (n === 'awaiting_confirmation') return { bg: 'rgba(255,107,26,.15)', color: 'var(--color-gold)' }
    if (n === 'rejected')              return { bg: 'rgba(239,68,68,.12)',  color: 'var(--color-red)' }
    return                                    { bg: 'rgba(245,158,11,.12)', color: 'var(--color-orange)' }
  }
  const stLabel = (rawStatus: string) => {
    const n = normalizeStatus(rawStatus)
    if (n === 'ready')                 return 'Готово'
    if (n === 'served')                return 'Подано'
    if (n === 'awaiting_confirmation') return 'Ждёт подтверждения'
    if (n === 'rejected')              return 'Отклонён'
    return 'Готовится'
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={() => setSessionDetail(null)} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl max-h-[85vh] flex flex-col"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <p className="text-lg font-bold" style={{ color: 'var(--color-soft)' }}>
            Стол №{s.tableNumber}
          </p>
          <button onClick={() => setSessionDetail(null)}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-card2)' }}>
            <X size={16} style={{ color: 'var(--color-mid)' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5">
          {items.map((it, i) => {
            const c = stStyle(it.status)
            const n = normalizeStatus(it.status)
            const awaiting = n === 'awaiting_confirmation'
            const readyToServe = n === 'ready'
            return (
              <div key={i} className="flex items-start py-3 gap-2"
                   style={{ borderBottom: i < items.length - 1 ? '1px solid var(--color-rim)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--color-soft)' }}>
                    {it.itemName} ×{it.quantity}
                  </p>
                  {it.note && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-gold2)' }}>
                      📝 {it.note}
                    </p>
                  )}
                  {awaiting && (
                    <p className="text-[10px] mt-0.5 font-semibold" style={{ color: 'var(--color-gold)' }}>
                      не входит в счёт
                    </p>
                  )}
                  {n === 'rejected' && it.rejectReason && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-red)' }}>
                      {it.rejectReason}
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg mx-3"
                      style={{ background: c.bg, color: c.color }}>
                  {stLabel(it.status)}
                </span>
                {awaiting && it.id && (
                  <div className="flex gap-1.5 mr-2 flex-shrink-0">
                    <button onClick={() => rejectItem(it.id!)}
                      className="h-7 px-2 rounded-lg text-[10px] font-bold"
                      style={{ background: 'rgba(239,68,68,.12)', color: 'var(--color-red)' }}>
                      ✕
                    </button>
                    <button onClick={() => acceptItem(it.id!)}
                      className="h-7 px-2 rounded-lg text-[10px] font-bold text-black"
                      style={{ background: 'var(--color-gold)' }}>
                      ✓
                    </button>
                  </div>
                )}
                {readyToServe && it.id && (
                  <button onClick={() => markItemServed(it.id!)}
                    className="h-7 px-2.5 rounded-lg text-[10px] font-bold mr-2 flex-shrink-0"
                    style={{ background: 'var(--color-card2)', color: 'var(--color-mid)',
                             border: '1px solid var(--color-rim)' }}>
                    Подано
                  </button>
                )}
                <span className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--color-soft)' }}>
                  {(it.price * it.quantity).toLocaleString('ru')} ₸
                </span>
              </div>
            )
          })}

          {/* Table service quality — server-derived lifecycle timings, no AI/score. */}
          {!timelineLoading && !timelineError && quality && (
            <div className="py-4 mt-2 rounded-2xl px-4" style={{ background: 'var(--color-card2)' }}>
              <div className="flex items-center justify-between mb-3"><p className="text-sm font-bold" style={{color:'var(--color-soft)'}}>Качество обслуживания</p><span className="text-[10px]" style={{color:'var(--color-dim)'}}>{quality.scope === 'kitchen' ? 'кухня' : 'по столу'}</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quality.avg_order_to_confirm_minutes != null && <div><p className="text-[10px]" style={{color:'var(--color-dim)'}}>Заказ → принят</p><p className="text-sm font-bold" style={{color:'var(--color-soft)'}}>{quality.avg_order_to_confirm_minutes} мин</p></div>}
                {quality.avg_confirm_to_ready_minutes != null && <div><p className="text-[10px]" style={{color:'var(--color-dim)'}}>Принят → готов</p><p className="text-sm font-bold" style={{color:'var(--color-soft)'}}>{quality.avg_confirm_to_ready_minutes} мин</p></div>}
                {quality.avg_ready_to_served_minutes != null && <div><p className="text-[10px]" style={{color:'var(--color-dim)'}}>Готов → подан</p><p className="text-sm font-bold" style={{color:'var(--color-soft)'}}>{quality.avg_ready_to_served_minutes} мин</p></div>}
                <div><p className="text-[10px]" style={{color:'var(--color-dim)'}}>SLA нарушений</p><p className="text-sm font-bold" style={{color:quality.sla_breaches?'var(--color-red)':'var(--color-green)'}}>{quality.sla_breaches}</p></div>
                {quality.waiter_calls != null && <div><p className="text-[10px]" style={{color:'var(--color-dim)'}}>Вызовов</p><p className="text-sm font-bold" style={{color:'var(--color-soft)'}}>{quality.waiter_calls}</p></div>}
                {quality.operational_exceptions != null && <div><p className="text-[10px]" style={{color:'var(--color-dim)'}}>Проблем</p><p className="text-sm font-bold" style={{color:quality.operational_exceptions?'var(--color-gold)':'var(--color-green)'}}>{quality.operational_exceptions}</p></div>}
              </div>
              {quality.scope === 'full' && <p className="text-[10px] mt-3" style={{color:'var(--color-dim)'}}>Подано {quality.items_completed}/{quality.items_total}{quality.items_rejected ? ` · отклонено ${quality.items_rejected}` : ''}{quality.service_duration_minutes != null ? ` · обслуживание ${quality.service_duration_minutes} мин${quality.is_closed ? '' : ' (идёт)'}` : ''}</p>}
            </div>
          )}

          {/* Service recovery — factual manager note + real compensation, no AI. */}
          {isAdmin && <div className="py-4 mt-2 rounded-2xl px-4" style={{background:'var(--color-card2)'}}>
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold" style={{color:'var(--color-soft)'}}>Восстановление сервиса</p><p className="text-[10px] mt-0.5" style={{color:'var(--color-dim)'}}>Фактическая причина и компенсация гостю</p></div><button onClick={()=>setRecoveryOpen(x=>!x)} className="text-xs font-bold px-3 py-2 rounded-xl" style={{background:'var(--color-card)',color:'var(--color-gold)'}}>+ Запись</button></div>
            {recoveryOpen && <div className="grid gap-2 mt-3"><select value={recoveryForm.source} onChange={e=>setRecoveryForm({...recoveryForm,source:e.target.value})} className="h-10 rounded-xl px-3 text-xs" style={{background:'var(--color-card)',color:'var(--color-soft)',border:'1px solid var(--color-rim)'}}><option value="">Без привязки к проблеме</option>{recoverySources.map((x:any)=><option key={`${x.type}:${x.id}`} value={`${x.type}:${x.id}`}>{x.label}</option>)}</select><select value={recoveryForm.reason} onChange={e=>setRecoveryForm({...recoveryForm,reason:e.target.value})} className="h-10 rounded-xl px-3 text-xs" style={{background:'var(--color-card)',color:'var(--color-soft)',border:'1px solid var(--color-rim)'}}><option value="delay">Задержка</option><option value="quality">Качество</option><option value="wrong_order">Ошибка заказа</option><option value="service">Сервис</option><option value="payment">Оплата</option><option value="other">Другое</option></select><textarea maxLength={1000} value={recoveryForm.note} onChange={e=>setRecoveryForm({...recoveryForm,note:e.target.value})} placeholder="Что произошло и что сделали?" className="rounded-xl p-3 text-xs min-h-20" style={{background:'var(--color-card)',color:'var(--color-soft)',border:'1px solid var(--color-rim)'}}/><div className="grid grid-cols-2 gap-2"><input value={recoveryForm.compensation_type} onChange={e=>setRecoveryForm({...recoveryForm,compensation_type:e.target.value})} placeholder="Компенсация" className="h-10 rounded-xl px-3 text-xs min-w-0" style={{background:'var(--color-card)',color:'var(--color-soft)',border:'1px solid var(--color-rim)'}}/><input type="number" min="0" value={recoveryForm.compensation_amount} onChange={e=>setRecoveryForm({...recoveryForm,compensation_amount:e.target.value})} placeholder="₸" className="h-10 rounded-xl px-3 text-xs min-w-0" style={{background:'var(--color-card)',color:'var(--color-soft)',border:'1px solid var(--color-rim)'}}/></div><button disabled={recoverySaving||!recoveryForm.note.trim()} onClick={saveRecovery} className="h-10 rounded-xl text-xs font-bold text-black disabled:opacity-50" style={{background:'var(--color-gold)'}}>{recoverySaving?'Сохранение…':'Сохранить'}</button></div>}
            {recoveries.length===0&&!recoveryOpen&&<p className="text-xs mt-3" style={{color:'var(--color-mid)'}}>Компенсаций и recovery-записей нет.</p>}
            {recoveries.map((r:any)=><div key={r.id} className="mt-3 pt-3" style={{borderTop:'1px solid var(--color-rim)'}}><div className="flex justify-between gap-2"><p className="text-xs font-semibold" style={{color:'var(--color-soft)'}}>{r.note}</p><span className="text-[10px] shrink-0" style={{color:'var(--color-dim)'}}>{new Date(r.created_at).toLocaleDateString('ru')}</span></div>{(Number(r.compensation_amount)>0||r.compensation_type)&&<p className="text-[11px] mt-1" style={{color:'var(--color-gold)'}}>{r.compensation_type||'Компенсация'}{Number(r.compensation_amount)>0?` · ${Number(r.compensation_amount).toLocaleString('ru')} ₸`:''}</p>}</div>)}
          </div>}

          {/* Operations timeline — authoritative server timestamps, no AI. */}
          <div className="py-4 mt-2 mb-4 rounded-2xl px-4" style={{ background: 'var(--color-card2)' }}>
            <div className="flex items-center justify-between mb-3"><p className="text-sm font-bold" style={{color:'var(--color-soft)'}}>История обслуживания</p><span className="text-[10px]" style={{color:'var(--color-dim)'}}>audit trail</span></div>
            {timelineLoading && <p className="text-xs py-3" style={{color:'var(--color-mid)'}}>Загрузка истории…</p>}
            {!timelineLoading && timelineError && <div className="py-2"><p className="text-xs" style={{color:'var(--color-red)'}}>{timelineError}</p><button className="text-xs font-bold mt-2" style={{color:'var(--color-gold)'}} onClick={() => { if(!djangoRestId||!sessionDetailId)return; setTimelineLoading(true); setTimelineError(''); api.sessionTimeline(djangoRestId,sessionDetailId).then(r=>{setTimeline(r.events);setQuality(r.quality_summary)}).catch((e:any)=>setTimelineError(e?.message||'Ошибка')).finally(()=>setTimelineLoading(false)) }}>Повторить</button></div>}
            {!timelineLoading && !timelineError && timeline.length === 0 && <p className="text-xs py-3" style={{color:'var(--color-mid)'}}>Событий пока нет</p>}
            {!timelineLoading && !timelineError && timeline.map((e:any, idx:number) => <div key={`${e.at}-${e.kind}-${idx}`} className="flex gap-3 py-2.5" style={{borderTop:idx?'1px solid var(--color-rim)':'none'}}><div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{background:e.severity==='critical'?'#fb7185':e.severity==='warning'?'#fbbf24':e.severity==='success'?'#4ade80':'var(--color-mid)'}}/><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="text-xs font-semibold" style={{color:'var(--color-soft)'}}>{e.title}</p><time className="text-[10px] shrink-0" style={{color:'var(--color-dim)'}}>{new Date(e.at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}</time></div>{e.detail && <p className="text-[11px] mt-0.5 truncate" style={{color:'var(--color-mid)'}}>{e.detail}</p>}</div></div>)}
          </div>

          {/* Totals */}
          <div className="py-4 mt-2 rounded-2xl px-4 mb-4"
               style={{ background: 'var(--color-card2)' }}>
            {[
              { l: 'Подитог', v: s.subtotalAmount },
              { l: `Сервис ${s.serviceChargePercent}%`, v: s.serviceChargeAmount },
            ].map(({ l, v }) => (
              <div key={l} className="flex justify-between text-sm py-1">
                <span style={{ color: 'var(--color-mid)' }}>{l}</span>
                <span style={{ color: 'var(--color-mid)' }}>{(v ?? 0).toLocaleString('ru')} ₸</span>
              </div>
            ))}
            <div className="h-px my-2" style={{ background: 'var(--color-rim)' }} />
            <div className="flex justify-between font-bold">
              <span style={{ color: 'var(--color-soft)' }}>Итого</span>
              <span className="text-lg" style={{ color: 'var(--color-gold)' }}>
                {(s.totalAmount ?? 0).toLocaleString('ru')} ₸
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0"
             style={{ borderTop: '1px solid var(--color-rim)' }}>
          {!isPaying ? (
            <button onClick={reqPay}
              className="flex-1 h-14 rounded-2xl text-sm font-bold text-black"
              style={{ background: 'var(--color-gold)' }}>
              Запросить оплату
            </button>
          ) : canClose ? (
            <button onClick={closeS}
              className="flex-1 h-14 rounded-2xl text-sm font-bold"
              style={{ background: 'rgba(76,175,80,.15)', color: 'var(--color-green)',
                       border: '1px solid rgba(76,175,80,.25)' }}>
              ✓ Закрыть счёт
            </button>
          ) : (
            <p className="flex-1 text-center text-sm py-4" style={{ color: 'var(--color-mid)' }}>
              Ожидание оплаты...
            </p>
          )}
        </div>
      </motion.div>
    </>
  )
}
