import React, { useEffect, useState } from 'react'
import { Building2, RefreshCw, TrendingUp } from 'lucide-react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'
import NetworkMenuPanel from './NetworkMenuPanel'

type NetworkData = Awaited<ReturnType<typeof api.networkAnalytics>>
const money = (n: number) => `${Number(n || 0).toLocaleString('ru')} ₸`

export default function NetworkTab() {
  const { profile, rest } = useAdminStore()
  const [networkId, setNetworkId] = useState('')
  const [data, setData] = useState<NetworkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState(rest?.name ? `${rest.name} Group` : '')
  const [creating, setCreating] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (profile?.role !== 'admin') { setLoading(false); return }
    setLoading(true); setError('')
    api.networks().then(async nets => {
      const n = nets[0]
      if (!n) { setNetworkId(''); setData(null); return }
      setNetworkId(n.id)
      setData(await api.networkAnalytics(n.id))
    }).catch(e => setError(String(e?.message ?? e))).finally(() => setLoading(false))
  }, [profile?.role, nonce])

  const create = async () => {
    if (!name.trim() || creating) return
    setCreating(true); setError('')
    try { await api.createNetwork(name.trim()); setNonce(x => x + 1) }
    catch (e: any) { setError(String(e?.message ?? e)) }
    finally { setCreating(false) }
  }

  if (profile?.role !== 'admin') return <div className="adm-card p-6"><b>Сеть филиалов</b><p className="text-sm mt-2" style={{color:'var(--color-mid)'}}>Сводная аналитика сети доступна только владельцу (Admin).</p></div>
  if (loading) return <div className="adm-card p-8 text-center"><RefreshCw className="animate-spin mx-auto mb-3"/><p>Загружаем филиалы…</p></div>
  if (error) return <div className="adm-card p-6"><p className="font-bold">Не удалось загрузить сеть</p><p className="text-sm mt-2" style={{color:'var(--color-red)'}}>{error}</p><button className="adm-btn mt-4" onClick={()=>setNonce(x=>x+1)}>Повторить</button></div>
  if (!networkId) return <div className="adm-card p-6 max-w-xl"><Building2 size={28}/><h2 className="text-xl font-bold mt-3">Объедините филиалы</h2><p className="text-sm mt-2" style={{color:'var(--color-mid)'}}>Создайте сеть для основного ресторана. Поддержка Plait безопасно подключит остальные филиалы после проверки владения.</p><input value={name} onChange={e=>setName(e.target.value)} className="w-full mt-5 px-4 py-3 rounded-xl" style={{background:'var(--color-card2)',border:'1px solid var(--color-rim)'}} placeholder="Название сети"/><button disabled={!name.trim()||creating} onClick={create} className="adm-btn mt-3">{creating?'Создаём…':'Создать сеть'}</button></div>
  if (!data) return <div className="adm-card p-6">В сети пока нет данных.</div>

  return <div className="pb-24">
    <div className="flex items-center justify-between mb-5"><div><p className="text-xs uppercase tracking-widest" style={{color:'var(--color-mid)'}}>Owner · сеть</p><h1 className="text-2xl font-bold">{data.network.name}</h1></div><button onClick={()=>setNonce(x=>x+1)} className="p-3 rounded-xl" style={{background:'var(--color-card)'}}><RefreshCw size={18}/></button></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {[['Общая выручка',money(data.totals.revenue)],['Закрыто счетов',data.totals.sessions_count],['Средний чек',money(data.totals.avg_check)],['Допродажи Plait',money(data.totals.upsell_revenue)]].map(([k,v])=><div className="adm-card p-4" key={String(k)}><p className="text-xs" style={{color:'var(--color-mid)'}}>{k}</p><p className="text-xl font-bold mt-2">{v}</p></div>)}
    </div>
    <div className="adm-card overflow-hidden"><div className="p-5 border-b" style={{borderColor:'var(--color-rim)'}}><h2 className="font-bold flex items-center gap-2"><TrendingUp size={18}/>Рейтинг филиалов</h2></div>{data.branches.length===0?<p className="p-6 text-sm">Филиалы ещё не подключены.</p>:data.branches.map((b,i)=><div key={b.id} className="p-4 flex items-center gap-3 border-b last:border-0" style={{borderColor:'var(--color-rim)'}}><div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold" style={{background:'var(--color-card2)'}}>#{i+1}</div><div className="min-w-0 flex-1"><p className="font-bold truncate">{b.name} {b.is_owner_branch&&<span className="text-xs" style={{color:'var(--color-gold)'}}>· основной</span>}</p><p className="text-xs mt-1" style={{color:'var(--color-mid)'}}>{b.sessions_count} счетов · средний {money(b.avg_check)} · upsell {money(b.upsell_revenue)}</p></div><p className="font-bold whitespace-nowrap">{money(b.revenue)}</p></div>)}</div><NetworkMenuPanel networkId={networkId}/></div>
}
