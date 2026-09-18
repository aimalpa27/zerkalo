import React from 'react'
import { ArrowLeft, LogOut, Moon, Sun, ShieldCheck } from 'lucide-react'
import { api, tokenStore } from '../../lib/api'
import { useSAStore } from '../store'

export default function TopBar({ title, subtitle, showBack }: { title: string; subtitle?: string; showBack?: boolean }) {
  const { theme, toggleTheme, setScreen, selectRestaurant, reset } = useSAStore()

  const logout = async () => {
    await api.logout().catch(() => {})
    tokenStore.clear()
    reset()
    setScreen('auth')
  }

  return (
    <div className="flex items-center gap-3 px-4 py-4 sticky top-0 z-10"
         style={{ background: 'var(--glass-bg)', borderBottom: '1px solid var(--color-rim)', backdropFilter: 'blur(8px)' }}>
      {showBack ? (
        <button
          onClick={() => { selectRestaurant(null); setScreen('list') }}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
        >
          <ArrowLeft size={16} style={{ color: 'var(--color-mid)' }} />
        </button>
      ) : (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
             style={{ background: 'rgba(255,107,26,.1)', border: '1px solid rgba(255,107,26,.2)' }}>
          <ShieldCheck size={16} style={{ color: 'var(--color-gold)' }} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-base sm:text-lg truncate" style={{ color: 'var(--color-gold)' }}>{title}</h1>
        {subtitle && <p className="text-xs truncate" style={{ color: 'var(--color-mid)' }}>{subtitle}</p>}
      </div>

      <button
        onClick={toggleTheme}
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
        title="Сменить тему"
      >
        {theme === 'dark' ? <Sun size={16} style={{ color: 'var(--color-mid)' }} /> : <Moon size={16} style={{ color: 'var(--color-mid)' }} />}
      </button>

      <button
        onClick={logout}
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
        title="Выйти"
      >
        <LogOut size={16} style={{ color: 'var(--color-mid)' }} />
      </button>
    </div>
  )
}
