import React, { useCallback, useEffect, useState } from 'react'
import { Activity, RefreshCw, AlertTriangle, CheckCircle2, Database, Radio, HardDrive, ShieldCheck } from 'lucide-react'
import { api, type RestaurantDiagnostics } from '../../lib/api'
import { useAdminStore } from '../store'

const Check = ({ label, ok, Icon }: { label: string; ok: boolean; Icon: typeof Database }) => (
  <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}>
    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: ok ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)' }}>
      <Icon size={19} style={{ color: ok ? '#22c55e' : '#ef4444' }} />
    </div>
    <div className="min-w-0"><p className="font-semibold" style={{ color: 'var(--color-soft)' }}>{label}</p><p className="text-xs" style={{ color: ok ? '#22c55e' : '#ef4444' }}>{ok ? 'Работает' : 'Недоступно'}</p></div>
  </div>
)

export default function DiagnosticsTab() {
  const { djangoRestId, profile } = useAdminStore()
  const [data, setData] = useState<RestaurantDiagnostics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!djangoRestId) { setError('Ресторан не определён.'); setLoading(false); return }
    setLoading(true); setError('')
    try { setData(await api.restaurantDiagnostics(djangoRestId)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось получить диагностику.') }
    finally { setLoading(false) }
  }, [djangoRestId])

  useEffect(() => { void load() }, [load])

  if (profile?.role !== 'admin' && profile?.role !== 'manager') return <div className="p-5">Нет доступа.</div>

  return <div className="max-w-5xl mx-auto pb-24">
    <div className="flex items-start justify-between gap-3 mb-5">
      <div><h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-soft)' }}>Диагностика</h1><p className="text-sm mt-1" style={{ color: 'var(--color-dim)' }}>Безопасный статус ресторана и систем Plait без секретов и данных гостей.</p></div>
      <button onClick={() => void load()} disabled={loading} className="rounded-xl px-3 py-2 flex items-center gap-2 text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)', color: 'var(--color-mid)' }}><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>Обновить</button>
    </div>
    {loading && !data && <div className="rounded-2xl p-8 text-center" style={{ background:'var(--color-card)', color:'var(--color-dim)' }}><Activity className="animate-pulse mx-auto mb-3"/>Проверяем Plait…</div>}
    {error && <div className="rounded-2xl p-5 mb-4 flex gap-3" style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.25)', color:'#ef4444' }}><AlertTriangle/><div className="flex-1"><b>Диагностика недоступна</b><p className="text-sm mt-1">{error}</p><button className="underline text-sm mt-2" onClick={() => void load()}>Повторить</button></div></div>}
    {data && <>
      <div className="rounded-2xl p-4 mb-4 flex items-center gap-3" style={{ background: data.status === 'ok' ? 'rgba(34,197,94,.08)' : 'rgba(245,158,11,.08)', border: `1px solid ${data.status === 'ok' ? 'rgba(34,197,94,.25)' : 'rgba(245,158,11,.25)'}` }}>
        {data.status === 'ok' ? <CheckCircle2 style={{color:'#22c55e'}}/> : <AlertTriangle style={{color:'#f59e0b'}}/>}<div><b style={{color:'var(--color-soft)'}}>{data.status === 'ok' ? 'Ресторан работает штатно' : 'Требуется внимание'}</b><p className="text-xs" style={{color:'var(--color-dim)'}}>Проверено {new Date(data.generated_at).toLocaleString()}</p></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4"><Check label="База данных" ok={data.dependencies.database} Icon={Database}/><Check label="Cache" ok={data.dependencies.cache} Icon={HardDrive}/><Check label="Realtime" ok={data.dependencies.realtime} Icon={Radio}/></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">{[
        ['Активные столы', data.counts.active_tables], ['Блюда в меню', data.counts.available_menu_items], ['Сотрудники', data.counts.active_staff], ['Открытые счета', data.counts.open_sessions], ['Все столы', data.counts.tables], ['Все блюда', data.counts.menu_items],
      ].map(([label,value]) => <div key={String(label)} className="rounded-2xl p-4" style={{background:'var(--color-card)',border:'1px solid var(--color-rim)'}}><p className="text-xs" style={{color:'var(--color-dim)'}}>{label}</p><p className="text-2xl font-extrabold mt-1" style={{color:'var(--color-soft)'}}>{value}</p></div>)}</div>
      <div className="rounded-2xl p-5 mb-4" style={{background:'var(--color-card)',border:'1px solid var(--color-rim)'}}><div className="flex items-center gap-2 mb-3"><ShieldCheck size={18} style={{color:'var(--color-gold)'}}/><b style={{color:'var(--color-soft)'}}>Интеграции и подписка</b></div><p className="text-sm" style={{color:'var(--color-mid)'}}>iiko: {data.integration.iiko_enabled ? (data.integration.iiko_configured ? 'включён и настроен' : 'включён, нужна настройка') : 'выключен'}</p><p className="text-sm mt-1" style={{color:'var(--color-mid)'}}>Подписка: {data.subscription.status}</p></div>
      {data.warnings.length > 0 ? <div className="space-y-2">{data.warnings.map(w => <div key={w.code} className="rounded-xl p-3 flex gap-2 text-sm" style={{background:'rgba(245,158,11,.08)',color:'var(--color-mid)'}}><AlertTriangle size={17} style={{color:'#f59e0b'}}/>{w.message}</div>)}</div> : <div className="rounded-xl p-4 text-sm flex gap-2" style={{background:'rgba(34,197,94,.08)',color:'#22c55e'}}><CheckCircle2 size={18}/>Проблем не обнаружено.</div>}
    </>}
  </div>
}
