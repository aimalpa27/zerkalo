import React, { useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, ExternalLink, Rocket, X } from 'lucide-react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'

const keyFor = (restId: string) => `plait_onboarding_dismissed_${restId}`

export function shouldShowOnboarding(restId: string, role?: string) {
  if (!restId || !['admin', 'manager'].includes(role ?? '')) return false
  return localStorage.getItem(keyFor(restId)) !== '1'
}

export default function OnboardingWizard() {
  const { djangoRestId, rest, profile, menuItems, tables, staff, setTab, updateRest, showToast } = useAdminStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dismissed, setDismissed] = useState(false)

  const workers = staff.filter(s => ['waiter', 'manager', 'cashier', 'kitchen'].includes(s.role))
  const checks = useMemo(() => [
    { id: 'profile', title: 'Профиль ресторана', detail: rest?.address ? rest.address : 'Добавьте адрес в профиле', done: Boolean(rest?.name && rest?.address), tab: null as any },
    { id: 'menu', title: 'Меню', detail: menuItems.length ? `${menuItems.length} позиций` : 'Добавьте хотя бы одно блюдо', done: menuItems.length > 0, tab: 'menu' as const },
    { id: 'tables', title: 'Столы и QR', detail: tables.length ? `${tables.length} столов готовы к QR` : 'Создайте хотя бы один стол', done: tables.length > 0, tab: 'tables' as const },
    { id: 'staff', title: 'Команда', detail: workers.length ? `${workers.length} сотрудников` : 'Добавьте официанта или кухню', done: workers.length > 0, tab: 'staff' as const },
  ], [rest, menuItems.length, tables.length, workers.length])

  if (!djangoRestId || dismissed || !shouldShowOnboarding(djangoRestId, profile?.role)) return null

  const complete = checks.every(c => c.done)
  const doneCount = checks.filter(c => c.done).length
  const dismiss = () => {
    localStorage.setItem(keyFor(djangoRestId), '1')
    setDismissed(true)
  }
  const go = (tab: 'menu' | 'tables' | 'staff' | null) => {
    if (tab) setTab(tab)
    else useAdminStore.getState().setProfileOpen(true)
  }
  const goLive = async () => {
    if (!complete || saving) return
    setSaving(true); setError('')
    try {
      const updated = await api.updateRestaurantSettings(djangoRestId, { is_public: true })
      updateRest({ isPublic: updated.is_public ?? true } as any)
      localStorage.setItem(keyFor(djangoRestId), '1')
      setDismissed(true)
      showToast('Ресторан готов принимать гостей 🎉')
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось опубликовать ресторан. Попробуйте ещё раз.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Запуск ресторана">
      <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-7" style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,107,26,.14)', color: 'var(--color-gold)' }}><Rocket size={22}/></div>
          <div className="flex-1">
            <p className="text-lg font-extrabold" style={{ color: 'var(--color-soft)' }}>Запустим {rest?.name || 'ресторан'}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-mid)' }}>4 шага до первого заказа по QR. Прогресс сохраняется в реальных данных ресторана.</p>
          </div>
          <button onClick={dismiss} aria-label="Закрыть onboarding" className="p-2 rounded-xl" style={{ color: 'var(--color-dim)' }}><X size={18}/></button>
        </div>

        <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--color-card2)' }}>
          <div className="h-full transition-all" style={{ width: `${doneCount / checks.length * 100}%`, background: 'var(--color-gold)' }}/>
        </div>
        <p className="text-xs mb-5" style={{ color: 'var(--color-dim)' }}>{doneCount} из {checks.length} шагов готовы</p>

        <div className="flex flex-col gap-2">
          {checks.map((item, index) => (
            <button key={item.id} onClick={() => go(item.tab)} className="w-full flex items-center gap-3 p-4 rounded-2xl text-left active:scale-[.99] transition-transform" style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}>
              {item.done ? <CheckCircle2 size={22} style={{ color: 'var(--color-green)' }}/> : <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold" style={{ border: '1px solid var(--color-rim)', color: 'var(--color-mid)' }}>{index + 1}</span>}
              <span className="flex-1 min-w-0"><span className="block text-sm font-bold" style={{ color: 'var(--color-soft)' }}>{item.title}</span><span className="block text-xs mt-0.5 truncate" style={{ color: 'var(--color-dim)' }}>{item.detail}</span></span>
              <ChevronRight size={17} style={{ color: 'var(--color-dim)' }}/>
            </button>
          ))}
        </div>

        {error && <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,.10)', color: 'var(--color-red)' }}>{error}</div>}

        <button disabled={!complete || saving} onClick={goLive} className="w-full mt-5 h-12 rounded-2xl font-extrabold flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: 'var(--color-gold)', color: '#111' }}>
          {saving ? 'Публикуем…' : complete ? <><Rocket size={17}/> Go Live</> : 'Завершите шаги для Go Live'}
        </button>
        {complete && rest?.slug && <a href={`/?slug=${encodeURIComponent(rest.slug)}`} target="_blank" rel="noreferrer" className="mt-3 h-10 flex items-center justify-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-mid)' }}>Предпросмотр гостевого меню <ExternalLink size={13}/></a>}
        <p className="text-[11px] text-center mt-3" style={{ color: 'var(--color-dim)' }}>Официант и кухня не видят мастер настройки. Он доступен только Admin/Manager.</p>
      </div>
    </div>
  )
}
