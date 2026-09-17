/**
 * SuperAdminApp — точка входа тех-панели Plait.
 * Доступ только для пользователей с ролью `superadmin`.
 * Аутентификация: тот же Django JWT, что и у обычной админки.
 */
import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, tokenStore } from '../lib/api'
import { useSAStore } from './store'
import AuthScreen from './screens/AuthScreen'
import RestaurantsListScreen from './screens/RestaurantsListScreen'
import RestaurantDetailScreen from './screens/RestaurantDetailScreen'
import Toast from './components/Toast'

export default function SuperAdminApp() {
  const { theme, screen, setScreen, setProfile, reset, loadingMsg, loadingErr, setLoading } = useSAStore()
  const [bootDone, setBootDone] = useState(false)

  // ── Тема ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
  }, [theme])

  // ── Восстановление сессии ───────────────────────────────────────────────
  useEffect(() => {
    if (!tokenStore.hasSession()) {
      setScreen('auth')
      setBootDone(true)
      return
    }

    setScreen('loading')
    setLoading('Восстановление сессии...')

    api.me()
      .then((user) => {
        if (user.role !== 'superadmin') {
          tokenStore.clear()
          reset()
          setScreen('auth')
          return
        }
        setProfile({ id: user.id, email: user.email, name: user.name, role: user.role })
        setScreen('list')
      })
      .catch(() => {
        tokenStore.clear()
        setScreen('auth')
      })
      .finally(() => setBootDone(true))
  }, [])

  if (!bootDone && screen === 'loading') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4"
           style={{ background: 'var(--color-bg)' }}>
        <div className="w-10 h-10 rounded-full border-4 animate-spin"
             style={{ borderColor: 'var(--color-rim)', borderTopColor: 'var(--color-gold)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--color-mid)' }}>{loadingMsg}</p>
        {loadingErr && (
          <p className="text-sm font-semibold" style={{ color: 'var(--color-red)' }}>{loadingErr}</p>
        )}
      </div>
    )
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {screen === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AuthScreen />
          </motion.div>
        )}
        {screen === 'list' && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RestaurantsListScreen />
          </motion.div>
        )}
        {screen === 'detail' && (
          <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RestaurantDetailScreen />
          </motion.div>
        )}
      </AnimatePresence>
      <Toast />
    </>
  )
}
