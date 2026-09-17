import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ShieldCheck, Moon, Sun } from 'lucide-react'
import { api, tokenStore } from '../../lib/api'
import { useSAStore } from '../store'

export default function AuthScreen() {
  const { theme, toggleTheme, setScreen, setProfile, showToast } = useSAStore()
  const [email, setEmail]       = useState('')
  const [pass, setPass]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showPass, setShowPass] = useState(false)

  const doLogin = async () => {
    if (!email.trim()) { setError('Введите email'); return }
    if (!pass)         { setError('Введите пароль'); return }
    setLoading(true)
    setError('')

    try {
      const jwt = await api.login(email.trim(), pass)

      if (jwt.user.role !== 'superadmin') {
        setError('Доступ только для тех-команды Plait')
        setLoading(false)
        return
      }

      tokenStore.setTokens(jwt.access, jwt.refresh)
      setProfile({ id: jwt.user.id, email: jwt.user.email, name: jwt.user.name, role: jwt.user.role })
      showToast(`С возвращением, ${jwt.user.name || 'команда'}!`)
      setScreen('list')
    } catch (e: any) {
      const msg = e?.data?.detail ?? e?.message ?? 'Ошибка входа'
      setError(
        msg.includes('No active account') || msg.includes('credentials')
          ? 'Неверный email или пароль'
          : msg
      )
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-5"
         style={{ background: 'var(--color-bg)' }}>

      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 w-10 h-10 rounded-2xl flex items-center justify-center transition-colors"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
        title="Сменить тему"
      >
        {theme === 'dark' ? <Sun size={18} style={{ color: 'var(--color-mid)' }} /> : <Moon size={18} style={{ color: 'var(--color-mid)' }} />}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(255,107,26,.1)', border: '1px solid rgba(255,107,26,.2)' }}
        >
          <ShieldCheck size={28} style={{ color: 'var(--color-gold)' }} />
        </div>

        <h1 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--color-soft)' }}>
          Plait Tech
        </h1>
        <p className="text-sm font-medium text-center mb-8" style={{ color: 'var(--color-mid)' }}>
          Панель тех-поддержки и настройки ресторанов
        </p>

        <div className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full px-4 py-4 rounded-2xl text-sm outline-none transition-all"
            style={{ background: 'var(--color-card)', border: '1.5px solid var(--color-rim)', color: 'var(--color-soft)' }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-gold)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--color-rim)')}
            onKeyDown={e => e.key === 'Enter' && doLogin()}
          />

          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="Пароль"
              className="w-full px-4 py-4 pr-12 rounded-2xl text-sm outline-none transition-all"
              style={{ background: 'var(--color-card)', border: '1.5px solid var(--color-rim)', color: 'var(--color-soft)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-gold)')}
              onBlur={e  => (e.target.style.borderColor = 'var(--color-rim)')}
              onKeyDown={e => e.key === 'Enter' && doLogin()}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ color: 'var(--color-dim)' }}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl text-sm font-semibold text-center"
                 style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--color-red)' }}>
              {error}
            </div>
          )}

          <button
            onClick={doLogin}
            disabled={loading}
            className="w-full h-14 rounded-2xl font-bold text-sm tracking-wider transition-all active:scale-[.98] flex items-center justify-center gap-2"
            style={{ background: loading ? 'var(--color-dim)' : 'var(--color-gold)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Входим...
              </>
            ) : 'ВОЙТИ'}
          </button>

          <p className="text-xs text-center font-medium" style={{ color: 'var(--color-dim)' }}>
            Аккаунт тех-поддержки создаётся командой Plait через management-команду
          </p>
        </div>
      </motion.div>
    </div>
  )
}
