import React, { useMemo, useState } from 'react'
import { Check, ChevronRight, ExternalLink, Rocket, X } from 'lucide-react'
import { api, mapDjangoRestaurant } from '../../lib/api'
import { useAdminStore, type TabId } from '../store'

type Step = {
  key: string
  title: string
  description: string
  done: boolean
  tab?: TabId
}

export default function OnboardingWizard() {
  const { rest, profile, menuItems, tables, staff, updateRest, setTab, showToast } = useAdminStore()
  const [dismissed, setDismissed] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: rest?.name ?? '', address: rest?.address ?? '', working_hours: rest?.workingHours ?? '' })

  const allowed = profile?.role === 'admin' || profile?.role === 'manager'
  const steps = useMemo<Step[]>(() => {
    const activeMenu = menuItems.filter(i => i.isVisible !== false && i.isAvailable !== false)
    const activeTables = tables.filter(t => (t as any).is_active !== false)
    const operationalStaff = staff.filter(s => ['waiter', 'kitchen', 'cashier', 'manager'].includes(s.role))
    return [
      {
        key: 'profile', title: 'Профиль ресторана',
        description: 'Название, адрес и часы работы заполнены.',
        done: Boolean(rest?.name?.trim() && rest?.address?.trim() && rest?.workingHours?.trim()),
      },
      {
        key: 'menu', title: 'Меню',
        description: 'Добавьте хотя бы одно доступное гостю блюдо.',
        done: activeMenu.length > 0, tab: 'menu',
      },
      {
        key: 'tables', title: 'Столы и QR',
        description: 'Создайте хотя бы один активный стол с QR.',
        done: activeTables.length > 0, tab: 'tables',
      },
      {
        key: 'staff', title: 'Команда',
        description: 'Добавьте сотрудника для обслуживания заказов.',
        done: operationalStaff.length > 0, tab: 'staff',
      },
    ]
  }, [rest, menuItems, tables, staff])

  if (!allowed || !rest || rest.isPublic || dismissed) return null

  const doneCount = steps.filter(s => s.done).length
  const ready = doneCount === steps.length
  const percent = Math.round((doneCount / steps.length) * 100)

  const openStep = (step: Step) => {
    if (step.tab) {
      setTab(step.tab)
      setDismissed(true)
      return
    }
    setProfileForm({ name: rest.name ?? '', address: rest.address ?? '', working_hours: rest.workingHours ?? '' })
    setEditingProfile(true)
  }

  const saveProfile = async () => {
    if (savingProfile) return
    const name = profileForm.name.trim(), address = profileForm.address.trim(), working_hours = profileForm.working_hours.trim()
    if (!name || !address || !working_hours) { setError('Заполните название, адрес и часы работы.'); return }
    setSavingProfile(true); setError('')
    try {
      const updated = await api.updateRestaurantSettings(rest.id, { name, address, working_hours })
      updateRest(mapDjangoRestaurant(updated))
      setEditingProfile(false)
      showToast('Профиль ресторана сохранён')
    } catch (e: any) {
      setError(String(e?.data?.detail || e?.message || 'Не удалось сохранить профиль.'))
    } finally { setSavingProfile(false) }
  }

  const publish = async () => {
    if (!ready || publishing) return
    setPublishing(true)
    setError('')
    try {
      const updated = await api.updateRestaurantSettings(rest.id, { is_public: true })
      updateRest(mapDjangoRestaurant(updated))
      showToast('Ресторан опубликован — QR-меню готово принимать гостей')
    } catch (e: any) {
      const data = e?.data
      const message = data?.is_public?.[0] || data?.detail || e?.message || 'Не удалось опубликовать ресторан.'
      setError(String(message))
    } finally {
      setPublishing(false)
    }
  }

  const guestUrl = `${window.location.origin}/?slug=${encodeURIComponent(rest.slug)}`

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <button className="onboarding-close" onClick={() => setDismissed(true)} aria-label="Закрыть onboarding">
          <X size={20} />
        </button>

        <div className="onboarding-hero">
          <div className="onboarding-icon"><Rocket size={24} /></div>
          <div>
            <div className="onboarding-kicker">Быстрый запуск</div>
            <h2 id="onboarding-title">Подготовим {rest.name} к первому QR-заказу</h2>
            <p>Plait проверяет реальные настройки. Публикация станет доступна, когда ресторан готов принимать гостей.</p>
          </div>
        </div>

        <div className="onboarding-progress-row">
          <strong>{doneCount} из {steps.length} готово</strong>
          <span>{percent}%</span>
        </div>
        <div className="onboarding-progress"><span style={{ width: `${percent}%` }} /></div>

        {editingProfile && (
          <div className="onboarding-profile-form">
            <strong>Профиль ресторана</strong>
            <input value={profileForm.name} onChange={e => setProfileForm(v => ({ ...v, name: e.target.value }))} placeholder="Название ресторана" maxLength={255} />
            <input value={profileForm.address} onChange={e => setProfileForm(v => ({ ...v, address: e.target.value }))} placeholder="Адрес" maxLength={500} />
            <input value={profileForm.working_hours} onChange={e => setProfileForm(v => ({ ...v, working_hours: e.target.value }))} placeholder="Часы работы, например 09:00–23:00" maxLength={255} />
            <div className="onboarding-profile-actions">
              <button onClick={() => setEditingProfile(false)}>Отмена</button>
              <button onClick={saveProfile} disabled={savingProfile}>{savingProfile ? 'Сохраняем…' : 'Сохранить'}</button>
            </div>
          </div>
        )}

        <div className="onboarding-steps">
          {steps.map((step, index) => (
            <button key={step.key} className={`onboarding-step ${step.done ? 'done' : ''}`} onClick={() => openStep(step)}>
              <span className="onboarding-step-status">{step.done ? <Check size={17} /> : index + 1}</span>
              <span className="onboarding-step-copy">
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>

        {error && <div className="onboarding-error" role="alert">{error}</div>}

        <div className="onboarding-actions">
          <a className="onboarding-preview" href={guestUrl} target="_blank" rel="noreferrer">
            Предпросмотр <ExternalLink size={15} />
          </a>
          <button className="onboarding-publish" disabled={!ready || publishing} onClick={publish}>
            {publishing ? 'Публикуем…' : ready ? 'Go Live' : `Ещё ${steps.length - doneCount} шага`}
          </button>
        </div>
      </section>
    </div>
  )
}
