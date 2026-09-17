import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Receipt, UtensilsCrossed, Users, BarChart2, LayoutGrid, Bell, Bike, Calendar, MessageCircle,
  X, Sun, Moon, User, LogOut,
} from 'lucide-react'
import { api, tokenStore } from '../../lib/api'
import { useAdminStore } from '../store'
import type { TabId } from '../store'

type TabDef = { id: string; Icon: typeof Receipt; label: string }

const ADMIN_TABS: readonly TabDef[] = [
  { id: 'sessions',  Icon: Receipt,         label: 'Счета'     },
  { id: 'menu',      Icon: UtensilsCrossed, label: 'Меню'      },
  { id: 'staff',     Icon: Users,           label: 'Персонал'  },
  { id: 'analytics', Icon: BarChart2,       label: 'Касса'     },
]
const DELIVERY_TAB: TabDef = { id: 'delivery', Icon: Bike, label: 'Доставка' }
const SCHEDULE_TAB: TabDef = { id: 'schedule', Icon: Calendar, label: 'График' }
const CHAT_TAB: TabDef     = { id: 'chat', Icon: MessageCircle, label: 'Чат' }

const WAITER_TABS: readonly TabDef[] = [
  { id: 'tables',   Icon: LayoutGrid, label: 'Столы'  },
  { id: 'sessions', Icon: Receipt,    label: 'Счета'  },
  { id: 'calls',    Icon: Bell,       label: 'Вызовы' },
]

export default function MobileMenuDrawer() {
  const {
    mobileMenuOpen, setMobileMenuOpen,
    isAdmin, activeTab, calls, chatUnread, rest, profile,
    theme, toggleTheme, setTab, setProfileOpen, reset, setScreen,
  } = useAdminStore()

  let tabs: TabDef[] = isAdmin
    ? (rest?.features?.delivery ? [...ADMIN_TABS, DELIVERY_TAB] : [...ADMIN_TABS])
    : [...WAITER_TABS]
  if (rest?.features?.schedule) tabs = [...tabs, SCHEDULE_TAB]
  if (rest?.features?.chat) tabs = [...tabs, CHAT_TAB]

  const doLogout = async () => {
    try { await api.logout() } catch {}
    tokenStore.clear()
    reset()
    setScreen('mode')
  }

  return (
    <AnimatePresence>
      {mobileMenuOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <motion.aside
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.22 }}
            className="fixed top-0 left-0 bottom-0 z-[301] w-[78%] max-w-[300px] flex flex-col md:hidden"
            style={{ background: 'var(--color-card)', borderRight: '1px solid var(--color-rim)' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-5 border-b" style={{ borderColor: 'var(--color-rim)' }}>
              <div className="min-w-0">
                <p className="font-extrabold text-xl tracking-tight" style={{ color: 'var(--color-gold)' }}>Plait</p>
                <p className="text-sm font-bold mt-1 truncate" style={{ color: 'var(--color-soft)' }}>
                  {rest?.name ?? 'Ресторан'}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-dim)' }}>
                  {profile?.name ?? profile?.email ?? '—'} · {isAdmin ? 'Администратор' : 'Официант'}
                </p>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90"
                style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}
              >
                <X size={16} style={{ color: 'var(--color-mid)' }} />
              </button>
            </div>

            {/* Sections */}
            <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
              {tabs.map(({ id, Icon, label }) => {
                const active = activeTab === id
                const badge = id === 'calls' ? calls.length : id === 'chat' ? chatUnread : 0
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id as TabId)}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-left w-full transition-all"
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
                  </button>
                )
              })}
            </nav>

            {/* Footer actions */}
            <div className="flex flex-col gap-1 p-3 border-t" style={{ borderColor: 'var(--color-rim)' }}>
              <button
                onClick={() => { setProfileOpen(true); setMobileMenuOpen(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-left w-full"
                style={{ color: 'var(--color-mid)' }}
              >
                <User size={18} strokeWidth={1.7} />
                <span className="flex-1">Профиль</span>
              </button>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-left w-full"
                style={{ color: 'var(--color-mid)' }}
              >
                {theme === 'dark' ? <Sun size={18} strokeWidth={1.7} /> : <Moon size={18} strokeWidth={1.7} />}
                <span className="flex-1">{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
              </button>
              <button
                onClick={doLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-left w-full"
                style={{ color: 'var(--color-red)' }}
              >
                <LogOut size={18} strokeWidth={1.7} />
                <span className="flex-1">Выйти</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
