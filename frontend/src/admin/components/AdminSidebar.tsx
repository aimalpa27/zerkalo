import React from 'react'
import { Receipt, UtensilsCrossed, Users, BarChart2, LayoutGrid, Bell, Bike, Calendar, MessageCircle } from 'lucide-react'
import { useAdminStore } from '../store'
import type { TabId } from '../store'

const ADMIN_TABS = [
  { id: 'sessions',  Icon: Receipt,          label: 'Счета'     },
  { id: 'menu',      Icon: UtensilsCrossed,   label: 'Меню'      },
  { id: 'staff',     Icon: Users,             label: 'Персонал'  },
  { id: 'analytics', Icon: BarChart2,         label: 'Аналитика' },
] as const

const DELIVERY_TAB = { id: 'delivery', Icon: Bike, label: 'Доставка' } as const
const SCHEDULE_TAB = { id: 'schedule', Icon: Calendar, label: 'График' } as const
const CHAT_TAB = { id: 'chat', Icon: MessageCircle, label: 'Чат' } as const

const WAITER_TABS = [
  { id: 'tables',   Icon: LayoutGrid, label: 'Столы'   },
  { id: 'sessions', Icon: Receipt,    label: 'Счета'   },
  { id: 'calls',    Icon: Bell,       label: 'Вызовы'  },
] as const

export default function AdminSidebar() {
  const { isAdmin, activeTab, calls, chatUnread, setTab, rest } = useAdminStore()
  let tabs: ReadonlyArray<{ id: string; Icon: typeof Receipt; label: string }> = isAdmin
    ? (rest?.features?.delivery ? [...ADMIN_TABS, DELIVERY_TAB] : ADMIN_TABS)
    : WAITER_TABS
  if (rest?.features?.schedule) tabs = [...tabs, SCHEDULE_TAB]
  if (rest?.features?.chat) tabs = [...tabs, CHAT_TAB]

  return (
    <aside className="adm-sidebar">
      {/* Logo */}
      <div className="px-5 py-6 border-b" style={{ borderColor: 'var(--color-rim)' }}>
        <p className="font-extrabold text-xl tracking-tight" style={{ color: 'var(--color-gold)' }}>
          Plait
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-dim)' }}>
          {isAdmin ? 'Администратор' : 'Официант'}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {tabs.map(({ id, Icon, label }) => {
          const active = activeTab === id
          const badge = id === 'calls' ? calls.length : id === 'chat' ? chatUnread : 0
          return (
            <button
              key={id}
              onClick={() => setTab(id as TabId)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all text-left w-full"
              style={{
                background: active ? 'rgba(255,107,26,.12)' : 'transparent',
                color: active ? 'var(--color-gold)' : 'var(--color-mid)',
              }}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.7} />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{ background: 'var(--color-red)' }}>
                  {badge}
                </span>
              )}
              {active && (
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                     style={{ background: 'var(--color-gold)' }} />
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}