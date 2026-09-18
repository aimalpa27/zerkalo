import React from 'react'
import { motion } from 'framer-motion'
import { useAdminStore } from '../store'

interface Props {
  loading?: boolean
  loadingMsg?: string
  loadingErr?: string
  onRetry?: () => void
}

export default function ModeScreen({ loading, loadingMsg = 'Загрузка...', loadingErr, onRetry }: Props) {
  const { setMode, setScreen } = useAdminStore()

  const pick = (m: 'admin' | 'waiter') => {
    setMode(m)
    setScreen('auth')
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-5"
         style={{ background: 'var(--color-bg)' }}>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center mb-12"
      >
        <img src="/icon_512.png" alt="Plait" className="mb-4" style={{ width: 80, height: 80, objectFit: 'contain' }} />
        <p className="text-2xl font-extrabold tracking-tight"
           style={{ color: 'var(--color-soft)' }}>Plait</p>
        <p className="text-xs mt-1"
           style={{ color: 'var(--color-mid)' }}>QR-меню для кафе</p>
      </motion.div>

      {/* Loading state */}
      {loading && !loadingErr && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
               style={{ borderColor: 'var(--color-gold)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--color-mid)' }}>{loadingMsg}</p>
        </div>
      )}

      {/* Error state */}
      {loadingErr && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm p-5 rounded-2xl text-center"
          style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)' }}
        >
          <p className="text-2xl mb-3">⚠️</p>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-red)' }}>
            Не удалось войти
          </p>
          <p className="text-xs whitespace-pre-line mb-4" style={{ color: 'var(--color-mid)' }}>
            {loadingErr}
          </p>
          <button
            onClick={onRetry}
            className="w-full h-11 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: 'var(--color-gold)', color: '#000' }}
          >
            Вернуться к выбору роли
          </button>
        </motion.div>
      )}

      {/* Role picker */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm flex flex-col gap-3"
        >
          {/* Admin role */}
          <button onClick={() => pick('admin')}
            className="flex items-center gap-4 p-5 rounded-2xl border text-left transition-all active:scale-[.98]"
            style={{ background: 'var(--color-card)', borderColor: 'rgba(255,107,26,.3)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                 style={{ background: 'rgba(255,107,26,.1)' }}>👑</div>
            <div className="flex-1">
              <p className="font-bold" style={{ color: 'var(--color-soft)' }}>Администратор</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-mid)' }}>
                Меню · Счета · Персонал · Аналитика
              </p>
            </div>
            <span style={{ color: 'var(--color-dim)', fontSize: 20 }}>›</span>
          </button>

          {/* Sales demo — isolated from production data */}
          <button onClick={() => setScreen('demo')}
            className="flex items-center gap-4 p-5 rounded-2xl border text-left transition-all active:scale-[.98]"
            style={{ background: 'linear-gradient(135deg, rgba(255,107,26,.12), rgba(139,92,246,.10))', borderColor: 'rgba(255,107,26,.38)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                 style={{ background: 'rgba(255,107,26,.12)' }}>🚀</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold" style={{ color: 'var(--color-soft)' }}>Демо для ресторана</p>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background:'var(--color-gold)', color:'#fff' }}>DEMO</span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--color-mid)' }}>QR → заказ → кухня → официант → аналитика</p>
            </div>
            <span style={{ color: 'var(--color-gold)', fontSize: 20 }}>›</span>
          </button>

          {/* Waiter role */}
          <button onClick={() => pick('waiter')}
            className="flex items-center gap-4 p-5 rounded-2xl border text-left transition-all active:scale-[.98]"
            style={{ background: 'var(--color-card)', borderColor: 'rgba(74,158,255,.25)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                 style={{ background: 'rgba(74,158,255,.1)' }}>🧑‍💼</div>
            <div className="flex-1">
              <p className="font-bold" style={{ color: 'var(--color-soft)' }}>Официант</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-mid)' }}>
                Столы · Счета · Вызовы
              </p>
            </div>
            <span style={{ color: 'var(--color-dim)', fontSize: 20 }}>›</span>
          </button>
        </motion.div>
      )}
    </div>
  )
}
