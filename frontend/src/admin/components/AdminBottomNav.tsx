import React from 'react'
import { Receipt, UtensilsCrossed, LayoutGrid, Bell, Calendar, MessageCircle } from 'lucide-react'
import { useAdminStore } from '../store'
import type { TabId } from '../store'

// Нижняя панель (только мобильная) — сокращённый набор для быстрого доступа.
// Персонал, Касса и Доставка намеренно вынесены только в сайдбар / бургер-меню,
// чтобы таббар не переполнялся. См. AdminSidebar / MobileMenuDrawer.
const ADMIN_TABS = [
  { id: 'sessions',  Icon: Receipt,          label: 'Счета' },
  { id: 'menu',      Icon: UtensilsCrossed,  label: 'Меню'  },
] as const

const SCHEDULE_TAB = { id: 'schedule', Icon: Calendar, label: 'График' } as const
const CHAT_TAB = { id: 'chat', Icon: MessageCircle, label: 'Чат' } as const

const WAITER_TABS = [
  { id: 'tables',   Icon: LayoutGrid, label: 'Столы'  },
  { id: 'sessions', Icon: Receipt,    label: 'Счета'  },
  { id: 'calls',    Icon: Bell,       label: 'Вызовы' },
] as const

export default function AdminBottomNav() {
  const { isAdmin, activeTab, calls, chatUnread, setTab, rest } = useAdminStore()
  let tabs: ReadonlyArray<{ id: string; Icon: typeof Receipt; label: string }> = isAdmin
    ? ADMIN_TABS
    : WAITER_TABS
  if (rest?.features?.schedule) tabs = [...tabs, SCHEDULE_TAB]
  if (rest?.features?.chat) tabs = [...tabs, CHAT_TAB]

  return (
    <nav
      className="adm-bottom-nav fixed bottom-0 left-0 right-0 z-30"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--color-rim)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex">
        {tabs.map(({ id, Icon, label }) => {
          const active = activeTab === id
          const badge  = id === 'calls' ? calls.length : id === 'chat' ? chatUnread : 0
          return (
            <button
              key={id}
              onClick={() => setTab(id as TabId)}
              className="flex-1 flex flex-col items-center py-2.5 gap-1 relative"
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.3 : 1.8}
                  style={{
                    color: active ? 'var(--color-gold)' : 'var(--color-mid)',
                    transition: 'color .2s',
                  }}
                />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                        style={{ background: 'var(--color-red)' }}>
                    {badge}
                  </span>
                )}
              </div>
              {/* Лейбл — font-semibold для читаемости на обеих темах */}
              <span
                className="text-[11px] font-semibold"
                style={{
                  color: active ? 'var(--color-gold)' : 'var(--color-mid)',
                  transition: 'color .2s',
                }}
              >
                {label}
              </span>
              {active && (
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full"
                  style={{ width: '24px', background: 'var(--color-gold)' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
