import React, { useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, CheckCircle2, ChefHat, QrCode, RotateCcw, ShieldCheck, ShoppingCart, UserRound } from 'lucide-react'
import { useAdminStore } from '../store'

type DemoRole = 'guest' | 'admin' | 'kitchen' | 'waiter' | 'owner'
type DemoStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

const STAGES = [
  'QR открыт', 'Блюда в корзине', 'Заказ создан', 'Подтверждён',
  'Готовится', 'Готово', 'Подано', 'Счёт закрыт',
]

const ROLE_META: Record<DemoRole, { label: string; icon: React.ReactNode; hint: string }> = {
  guest:   { label: 'Guest',   icon: <QrCode size={16}/>,     hint: 'Гость сканирует QR и делает заказ' },
  admin:   { label: 'Admin',   icon: <ShieldCheck size={16}/>,hint: 'Администратор подтверждает заказ' },
  kitchen: { label: 'Kitchen', icon: <ChefHat size={16}/>,    hint: 'Кухня готовит и отмечает готовность' },
  waiter:  { label: 'Waiter',  icon: <UserRound size={16}/>,  hint: 'Официант подаёт блюда и закрывает обслуживание' },
  owner:   { label: 'Owner',   icon: <BarChart3 size={16}/>,  hint: 'Владелец видит результат в аналитике' },
}

const roleForStage = (stage: DemoStage): DemoRole =>
  stage <= 2 ? 'guest' : stage === 3 ? 'admin' : stage <= 5 ? 'kitchen' : stage === 6 ? 'waiter' : 'owner'

export default function SalesDemoScreen() {
  const { setScreen } = useAdminStore()
  const [stage, setStage] = useState<DemoStage>(0)
  const [role, setRole] = useState<DemoRole>('guest')
  const [notice, setNotice] = useState('')

  const total = 7392
  const canAdvance = stage < 7
  const expectedRole = roleForStage(stage)
  const progress = Math.round(((stage + 1) / STAGES.length) * 100)

  const next = () => {
    if (!canAdvance) return
    const nextStage = (stage + 1) as DemoStage
    setStage(nextStage)
    setRole(roleForStage(nextStage))
    setNotice(nextStage === 7 ? 'Цикл завершён — выручка сразу попала в аналитику.' : '')
  }

  const reset = () => { setStage(0); setRole('guest'); setNotice('') }

  const headline = useMemo(() => {
    if (stage === 0) return 'Стол №12 · QR подключён'
    if (stage === 1) return 'Корзина готова к заказу'
    if (stage === 2) return 'Новый заказ в реальном времени'
    if (stage === 3) return 'Заказ подтверждён'
    if (stage === 4) return 'Кухня готовит позиции'
    if (stage === 5) return 'Официанту: можно подавать'
    if (stage === 6) return 'Гость обслужен'
    return 'Счёт закрыт · аналитика обновлена'
  }, [stage])

  return (
    <div className="min-h-screen px-4 py-4 md:px-8 md:py-7" style={{ background:'var(--color-bg)', color:'var(--color-soft)' }}>
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between gap-3 mb-5">
          <button onClick={() => setScreen('mode')} className="h-10 px-3 rounded-xl flex items-center gap-2 text-xs font-bold"
            style={{ background:'var(--color-card)', border:'1px solid var(--color-rim)', color:'var(--color-mid)' }}>
            <ArrowLeft size={16}/> Назад
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2"><span className="font-black text-lg">Plait</span><span className="text-[9px] font-black px-2 py-1 rounded-full" style={{background:'var(--color-gold)',color:'#fff'}}>SALES DEMO</span></div>
            <p className="text-[10px] mt-1" style={{color:'var(--color-dim)'}}>Изолированная демонстрация · production данные не изменяются</p>
          </div>
          <button onClick={reset} className="w-10 h-10 rounded-xl flex items-center justify-center" title="Сначала"
            style={{ background:'var(--color-card)', border:'1px solid var(--color-rim)', color:'var(--color-mid)' }}><RotateCcw size={16}/></button>
        </header>

        <div className="adm-card p-4 mb-4">
          <div className="flex items-center justify-between text-xs mb-2"><span style={{color:'var(--color-mid)'}}>Полный путь заказа</span><b style={{color:'var(--color-gold)'}}>{progress}%</b></div>
          <div className="h-2 rounded-full overflow-hidden" style={{background:'var(--color-card2)'}}><div className="h-full rounded-full transition-all duration-500" style={{width:`${progress}%`,background:'var(--color-gold)'}}/></div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-1 mt-3">
            {STAGES.map((x,i)=><div key={x} className="text-center"><div className="h-1 rounded-full mb-1" style={{background:i<=stage?'var(--color-gold)':'var(--color-rim)'}}/><span className="text-[9px] leading-tight" style={{color:i===stage?'var(--color-soft)':'var(--color-dim)'}}>{x}</span></div>)}
          </div>
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-4">
          <aside className="adm-card p-3 h-fit">
            <p className="text-[10px] font-black uppercase tracking-widest px-2 py-2" style={{color:'var(--color-dim)'}}>Посмотреть роль</p>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {(Object.keys(ROLE_META) as DemoRole[]).map(r => <button key={r} onClick={()=>setRole(r)} className="p-3 rounded-xl text-left transition-all"
                style={{background:role===r?'rgba(255,107,26,.12)':'var(--color-card2)',border:`1px solid ${role===r?'rgba(255,107,26,.45)':'transparent'}`}}>
                <div className="flex items-center gap-2 font-bold text-xs" style={{color:role===r?'var(--color-gold)':'var(--color-soft)'}}>{ROLE_META[r].icon}{ROLE_META[r].label}{expectedRole===r && <span className="ml-auto text-[8px]">СЕЙЧАС</span>}</div>
                <p className="hidden lg:block text-[10px] mt-1 leading-relaxed" style={{color:'var(--color-dim)'}}>{ROLE_META[r].hint}</p>
              </button>)}
            </div>
          </aside>

          <main className="adm-card overflow-hidden">
            <div className="p-5 border-b" style={{borderColor:'var(--color-rim)'}}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-widest" style={{color:'var(--color-gold)'}}>{ROLE_META[role].label} VIEW</p><h1 className="text-xl md:text-2xl font-black mt-1">{headline}</h1><p className="text-xs mt-1" style={{color:'var(--color-mid)'}}>{ROLE_META[role].hint}</p></div>
                <div className="px-3 py-2 rounded-xl text-right" style={{background:'var(--color-card2)'}}><p className="text-[9px]" style={{color:'var(--color-dim)'}}>Сумма заказа</p><b>{total.toLocaleString('ru-RU')} ₸</b></div>
              </div>
            </div>

            <div className="p-5 min-h-[330px]">
              {role === 'guest' && <div className="grid md:grid-cols-2 gap-3"><DemoDish name="Бургер Plait" price={3490} qty={1}/><DemoDish name="Картофель фри" price={1490} qty={1}/><DemoDish name="Лимонад манго" price={1740} qty={1}/><div className="p-4 rounded-2xl" style={{background:'rgba(34,197,94,.08)',border:'1px solid rgba(34,197,94,.2)'}}><ShoppingCart size={20}/><b className="block mt-2">Без ожидания официанта</b><p className="text-xs mt-1" style={{color:'var(--color-mid)'}}>QR уже знает ресторан и стол №12.</p></div></div>}
              {role === 'admin' && <RolePanel title="Новый заказ · стол №12" status={stage>=3?'Подтверждён':'Ожидает подтверждения'} bullets={['3 позиции · 7 392 ₸','Комментарий гостя виден персоналу','Событие приходит через realtime','Admin/Manager контролируют подтверждение']}/>} 
              {role === 'kitchen' && <RolePanel title="Kitchen board · стол №12" status={stage>=5?'ГОТОВО':stage>=4?'ГОТОВИТСЯ':'В очереди'} bullets={['Бургер Plait · Kitchen','Картофель фри · Kitchen','Лимонад манго автоматически идёт на Bar','Kitchen не имеет доступа к оплате и настройкам']}/>} 
              {role === 'waiter' && <RolePanel title="Стол №12 · готово к подаче" status={stage>=6?'ПОДАНО':'ГОТОВО'} bullets={['Официант получает realtime-сигнал о готовности','Позиции отмечаются поданными','Вызовы гостя видны отдельно','Least-privilege: только операционные действия']}/>} 
              {role === 'owner' && <div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5"><Metric label="Выручка сегодня" value={stage>=7?'487 240 ₸':'479 848 ₸'}/><Metric label="Средний чек" value="8 406 ₸"/><Metric label="Закрыто счетов" value={stage>=7?'58':'57'}/><Metric label="Топ блюдо" value="Бургер"/></div><RolePanel title="Результат для владельца" status={stage>=7?'+7 392 ₸':'LIVE'} bullets={['Продажи обновляются после закрытия счёта','Видны топ-блюда и средний чек','Можно сравнивать периоды и зоны','Данные изолированы по ресторану']}/></div>}
            </div>

            <div className="p-4 border-t flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between" style={{borderColor:'var(--color-rim)',background:'var(--color-card2)'}}>
              <div><p className="text-xs font-bold">Шаг {stage+1}/8 · {STAGES[stage]}</p>{notice && <p className="text-[10px] mt-1" style={{color:'rgb(34 197 94)'}}>{notice}</p>}</div>
              <button onClick={next} disabled={!canAdvance} className="h-11 px-5 rounded-xl font-black text-xs disabled:opacity-40" style={{background:'var(--color-gold)',color:'#fff'}}>{canAdvance ? `Дальше → ${STAGES[stage+1]}` : '✓ Демо завершено'}</button>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function DemoDish({name,price,qty}:{name:string;price:number;qty:number}) { return <div className="p-4 rounded-2xl" style={{background:'var(--color-card2)',border:'1px solid var(--color-rim)'}}><p className="text-2xl mb-3">🍽️</p><b>{name}</b><div className="flex justify-between mt-2 text-xs"><span style={{color:'var(--color-mid)'}}>× {qty}</span><span>{price.toLocaleString('ru-RU')} ₸</span></div></div> }
function RolePanel({title,status,bullets}:{title:string;status:string;bullets:string[]}) { return <div><div className="p-4 rounded-2xl mb-4 flex items-center justify-between gap-3" style={{background:'var(--color-card2)',border:'1px solid var(--color-rim)'}}><div><p className="text-xs" style={{color:'var(--color-mid)'}}>Активный заказ</p><b>{title}</b></div><span className="text-[10px] font-black px-3 py-1.5 rounded-full" style={{background:'rgba(34,197,94,.12)',color:'rgb(34 197 94)'}}>{status}</span></div><div className="grid sm:grid-cols-2 gap-2">{bullets.map(x=><div key={x} className="p-3 rounded-xl flex gap-2 text-xs" style={{background:'var(--color-card2)'}}><CheckCircle2 size={15} style={{color:'var(--color-gold)',flex:'0 0 auto'}}/><span>{x}</span></div>)}</div></div> }
function Metric({label,value}:{label:string;value:string}) { return <div className="p-3 rounded-xl" style={{background:'var(--color-card2)'}}><p className="text-[9px] uppercase font-bold" style={{color:'var(--color-dim)'}}>{label}</p><p className="font-black mt-1">{value}</p></div> }
