import React, { useEffect, useState } from 'react'
import { Palette, CreditCard, Armchair, Users, UtensilsCrossed, Plug } from 'lucide-react'
import { api, type DjangoRestaurant, type SuperAdminRestaurant } from '../../lib/api'
import { useSAStore } from '../store'
import TopBar from '../components/TopBar'
import BrandingTab from '../tabs/BrandingTab'
import SubscriptionTab from '../tabs/SubscriptionTab'
import TablesTab from '../tabs/TablesTab'
import StaffTab from '../tabs/StaffTab'
import MenuTab from '../tabs/MenuTab'
import IikoTab from '../tabs/IikoTab'

const TABS = [
  { id: 'branding',     label: 'Оформление', Icon: Palette },
  { id: 'subscription', label: 'Подписка',   Icon: CreditCard },
  { id: 'menu',         label: 'Меню',       Icon: UtensilsCrossed },
  { id: 'tables',       label: 'Столы',      Icon: Armchair },
  { id: 'staff',        label: 'Персонал',   Icon: Users },
  { id: 'iiko',         label: 'iiko',       Icon: Plug },
] as const

export default function RestaurantDetailScreen() {
  const { selectedRestaurantId, activeTab, setTab, updateRestaurantInList, showToast } = useSAStore()
  const [settings, setSettings] = useState<DjangoRestaurant | null>(null)
  const [saRest, setSaRest]     = useState<SuperAdminRestaurant | null>(null)
  const [loading, setLoading]   = useState(true)

  const restId = selectedRestaurantId

  const reload = async () => {
    if (!restId) return
    setLoading(true)
    try {
      const [s, sa] = await Promise.all([
        api.restaurantSettings(restId),
        api.superadminRestaurant(restId),
      ])
      setSettings(s)
      setSaRest(sa)
    } catch {
      showToast('Не удалось загрузить ресторан')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [restId])

  const onSettingsUpdate = (s: DjangoRestaurant) => {
    setSettings(s)
    if (restId) updateRestaurantInList(restId, {
      name: s.name, logo_url: s.logo_url ?? '', cover_image_url: s.cover_image_url,
      theme: (s.theme as 'dark' | 'light') ?? 'dark', accent_color: s.accent_color ?? '#FF6B1A',
      is_public: s.is_public, kaspi_pay_url: s.kaspi_pay_url ?? '',
    })
  }

  const onSaRestUpdate = (sa: SuperAdminRestaurant) => {
    setSaRest(sa)
    if (restId) updateRestaurantInList(restId, sa)
  }

  if (!restId) return null

  return (
    <div className="adm-layout min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="adm-main" style={{ marginLeft: 0 }}>
        <TopBar title={settings?.name ?? 'Ресторан'} subtitle={settings ? `/${settings.slug}` : undefined} showBack />

        {/* Tabs */}
        <div className="px-4 pt-3 sticky z-[5]" style={{ top: '64px', background: 'var(--color-bg)' }}>
          <div className="flex gap-2 p-1 rounded-2xl overflow-x-auto"
               style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}>
            {TABS.map(({ id, label, Icon }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap min-w-fit"
                  style={{
                    background: active ? 'var(--color-gold)' : 'transparent',
                    color: active ? '#fff' : 'var(--color-mid)',
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="adm-content px-4 pt-4 max-w-3xl mx-auto w-full">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-4 animate-spin"
                   style={{ borderColor: 'var(--color-rim)', borderTopColor: 'var(--color-gold)' }} />
              <p className="text-sm" style={{ color: 'var(--color-mid)' }}>Загрузка...</p>
            </div>
          )}

          {!loading && settings && saRest && (
            <>
              {activeTab === 'branding' && (
                <BrandingTab restId={restId} settings={settings} onUpdate={onSettingsUpdate} />
              )}
              {activeTab === 'subscription' && (
                <SubscriptionTab restId={restId} restaurant={saRest} onUpdate={onSaRestUpdate} />
              )}
              {activeTab === 'menu' && (
                <MenuTab restId={restId} />
              )}
              {activeTab === 'tables' && (
                <TablesTab restId={restId} restaurant={saRest} />
              )}
              {activeTab === 'staff' && (
                <StaffTab restId={restId} restaurant={saRest} />
              )}
              {activeTab === 'iiko' && (
                <IikoTab restId={restId} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
