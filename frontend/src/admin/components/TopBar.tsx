import React from 'react'
import { LogOut, Bell, Sun, Moon, User, Menu } from 'lucide-react'
import { api, tokenStore } from '../../lib/api'
import { useAdminStore } from '../store'

export default function TopBar() {
  const { rest, profile, isAdmin, calls, chatUnread, theme, toggleTheme, reset, setScreen, setProfileOpen, setMobileMenuOpen } = useAdminStore()
  const newCalls = calls.length

  const doLogout = async () => {
    try {
      await api.logout()
    } catch {}
    tokenStore.clear()
    reset()
    setScreen('mode')
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-3 sticky top-0 z-30"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--color-rim)',
      }}
    >
      {/* Бургер (моб.) + название ресторана + роль */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => setMobileMenuOpen(true)}
          title="Меню"
          className="md:hidden relative w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
          style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}
        >
          <Menu size={18} style={{ color: 'var(--color-mid)' }} />
          {(calls.length + chatUnread) > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                  style={{ background: 'var(--color-red)' }} />
          )}
        </button>
        <div className="min-w-0">
          <p className="font-bold text-[15px] leading-tight truncate" style={{ color: 'var(--color-soft)' }}>
            {rest?.name ?? 'Ресторан'}
          </p>
          <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: 'var(--color-gold)' }}>
            {profile?.name ?? profile?.email ?? '—'} · {isAdmin ? 'Администратор' : 'Официант'}
          </p>
        </div>
      </div>

      {/* Кнопки */}
      <div className="flex items-center gap-2">

        {/* Тема */}
        <button
          onClick={toggleTheme}
          title="Сменить тему"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}
        >
          {theme === 'dark'
            ? <Sun  size={16} style={{ color: 'var(--color-gold)' }} />
            : <Moon size={16} style={{ color: 'var(--color-mid)' }} />}
        </button>

        {/* Вызовы */}
        <div className="relative">
          <button
            onClick={() => useAdminStore.getState().setTab('calls')}
            title="Вызовы"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}
          >
            <Bell size={16}
              style={{ color: newCalls > 0 ? 'var(--color-gold)' : 'var(--color-mid)' }} />
          </button>
          {newCalls > 0 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                 style={{ background: 'var(--color-red)' }}>
              {newCalls}
            </div>
          )}
        </div>

        {/* Профиль */}
        <button
          onClick={() => setProfileOpen(true)}
          title="Мой профиль"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}
        >
          <User size={16} style={{ color: 'var(--color-mid)' }} />
        </button>

        {/* Выход */}
        <button
          onClick={doLogout}
          title="Выйти"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}
        >
          <LogOut size={16} style={{ color: 'var(--color-mid)' }} />
        </button>
      </div>
    </div>
  )
}
