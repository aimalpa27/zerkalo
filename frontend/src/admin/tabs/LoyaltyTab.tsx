import React, { useEffect, useState } from 'react'
import { RefreshCw, Users, Repeat2, WalletCards, Star, Gift, Save } from 'lucide-react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'

type Data = Awaited<ReturnType<typeof api.loyaltyDashboard>>
export default function LoyaltyTab() {
  const { djangoRestId } = useAdminStore()
  const [data,setData]=useState<Data|null>(null), [loading,setLoading]=useState(true), [error,setError]=useState(''), [saving,setSaving]=useState(false)
  const [form,setForm]=useState({is_enabled:true,points_per_1000:1,reward_points:10,reward_discount_amount:1000})
  const load=async()=>{ if(!djangoRestId)return; setLoading(true);setError('');try{const d=await api.loyaltyDashboard(djangoRestId);setData(d);setForm({...d.program,reward_discount_amount:Number(d.program.reward_discount_amount)})}catch(e:any){setError(e?.data?.detail||e?.message||'Не удалось загрузить CRM')}finally{setLoading(false)} }
  const save=async()=>{if(!djangoRestId||saving)return;setSaving(true);setError('');try{await api.updateLoyaltyProgram(djangoRestId,form);await load()}catch(e:any){setError(e?.data?.detail||e?.message||'Не удалось сохранить программу')}finally{setSaving(false)}}
  useEffect(()=>{load()},[djangoRestId])
  if(loading&&!data)return <div className="py-16 text-center text-mid">Загружаем постоянных гостей…</div>
  if(error&&!data)return <div className="p-5 rounded-2xl bg-card2"><p className="text-soft font-bold">CRM временно недоступна</p><p className="text-mid text-sm mt-1">{error}</p><button onClick={load} className="mt-4 px-4 py-2 rounded-xl bg-gold text-bg font-bold">Повторить</button></div>
  if(!data)return null
  const cards=[['Гостей',data.members_count,Users],['Вернулись',`${data.repeat_rate}%`,Repeat2],['Визитов',data.visits_count,Star],['Выручка гостей',`${Number(data.member_spend).toLocaleString('ru')} ₸`,WalletCards],['Наград использовано',data.redemptions_count,Gift],['Скидок выдано',`${Number(data.discount_given).toLocaleString('ru')} ₸`,WalletCards]] as const
  return <div className="space-y-5">
    <div className="flex items-center justify-between"><div><h2 className="text-xl font-extrabold text-soft">Loyalty / CRM</h2><p className="text-xs text-mid mt-1">Без обязательной регистрации, телефона и email</p></div><button onClick={load} disabled={loading} className="p-2.5 rounded-xl bg-card2 text-gold"><RefreshCw size={17} className={loading?'animate-spin':''}/></button></div>
    {error&&<div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-xs text-mid">{error}</div>}
    <div className="bg-card2 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between"><div><p className="font-bold text-soft">Правила программы</p><p className="text-xs text-mid">Детерминированно, без AI</p></div><label className="flex items-center gap-2 text-xs text-mid"><input type="checkbox" checked={form.is_enabled} onChange={e=>setForm({...form,is_enabled:e.target.checked})}/> Включена</label></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs text-mid">Баллов за 1 000 ₸<input type="number" min="1" value={form.points_per_1000} onChange={e=>setForm({...form,points_per_1000:Number(e.target.value)})} className="mt-1 w-full bg-card border border-rim rounded-xl px-3 py-2 text-soft"/></label>
        <label className="text-xs text-mid">Баллов для награды<input type="number" min="1" value={form.reward_points} onChange={e=>setForm({...form,reward_points:Number(e.target.value)})} className="mt-1 w-full bg-card border border-rim rounded-xl px-3 py-2 text-soft"/></label>
        <label className="text-xs text-mid">Скидка, ₸<input type="number" min="1" value={form.reward_discount_amount} onChange={e=>setForm({...form,reward_discount_amount:Number(e.target.value)})} className="mt-1 w-full bg-card border border-rim rounded-xl px-3 py-2 text-soft"/></label>
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-2.5 rounded-xl bg-gold text-bg font-bold text-sm flex items-center gap-2 disabled:opacity-60"><Save size={15}/>{saving?'Сохраняем…':'Сохранить правила'}</button>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{cards.map(([l,v,I])=><div key={l} className="bg-card2 rounded-2xl p-4"><I size={18} className="text-gold"/><p className="text-xs text-mid mt-3">{l}</p><p className="text-lg font-extrabold text-soft mt-1">{v}</p></div>)}</div>
    {data.members.length===0?<div className="py-12 text-center bg-card2 rounded-2xl"><Users className="mx-auto text-dim"/><p className="text-soft font-bold mt-3">Пока нет данных</p><p className="text-xs text-mid mt-1">Первый QR-заказ автоматически создаст анонимный профиль гостя.</p></div>:<div className="bg-card2 rounded-2xl overflow-hidden"><div className="p-4 border-b border-rim/40"><p className="font-bold text-soft">Лучшие постоянные гости</p></div>{data.members.map((m,i)=><div key={m.id} className="flex items-center gap-3 px-4 py-3 border-b border-rim/20 last:border-0"><span className="text-xs text-dim w-6">#{i+1}</span><div className="flex-1"><p className="text-sm font-semibold text-soft">Анонимный гость</p><p className="text-xs text-mid">{m.visits_count} визитов · {m.points} баллов</p></div><p className="text-sm font-bold text-gold">{Number(m.lifetime_spend).toLocaleString('ru')} ₸</p></div>)}</div>}
  </div>
}
