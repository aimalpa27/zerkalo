/**
 * AdminApp — точка входа панели управления.
 * Аутентификация: только Django JWT.
 * После логина токен содержит restaurant_id — сразу используем.
 */
import React, { useEffect, useState } from 'react'
import { api, tokenStore } from '../lib/api'
import { useAdminStore } from './store'
import ModeScreen   from './screens/ModeScreen'
import AuthScreen   from './screens/AuthScreen'
import AppScreen    from './screens/AppScreen'
import AdminToast   from './components/AdminToast'
import CallBanner   from './components/CallBanner'
import ConfirmModal from './components/ConfirmModal'
import AlertModal   from './components/AlertModal'

export default function AdminApp() {
  const {
    theme, screen,
    setScreen, setAuth, setIsAdmin,
    setRestaurant, setDjangoRestId, reset,
  } = useAdminStore()

  const [loadingMsg, setLoadingMsg] = useState('Загрузка...')
  const [loadingErr, setLoadingErr] = useState('')

  // ── Тема ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
  }, [theme])

  // ── Восстановление сессии при перезагрузке страницы ───────────────────────
  useEffect(() => {
    if (!tokenStore.hasSession()) {
      setScreen('mode')
      return
    }

    // refresh-токен есть в sessionStorage — пробуем восстановить
    setScreen('loading')
    setLoadingMsg('Восстановление сессии...')

    api.me()
      .then(async (user) => {
        const isAdminRole = user.role === 'admin' || user.role === 'manager'
        setAuth({ uid: user.id, email: user.email }, {
          id: user.id,
          uid: user.id,
          email: user.email,
          name: user.name,
          role: user.role as any,
          restaurantId: user.restaurant_id ?? '',
          assignedTables: user.assigned_tables ?? [],
          assignedZones: user.assigned_zones ?? [],
          createdAt: 0,
        })
        setIsAdmin(isAdminRole)

        if (user.restaurant_id) {
          setLoadingMsg('Загрузка ресторана...')
          try {
            const rest = await api.restaurantById(user.restaurant_id)
            setRestaurant(rest.id, {
              ...rest,
              orderConfirmation: {
                enabled: rest.order_confirmation_enabled ?? false,
                reminderAfterSec: rest.order_reminder_after_sec ?? 60,
                escalateAfterSec: rest.order_escalate_after_sec ?? 180,
                autoAction: rest.order_auto_action ?? 'none',
              },
            } as any)
            setDjangoRestId(rest.id)
          } catch {
            // ресторан не найден — продолжаем без него
          }
        }

        setScreen('app')
      })
      .catch(() => {
        // токен протух — идём на экран входа
        tokenStore.clear()
        setScreen('mode')
      })
  }, [])

  return (
    <>
      {(screen === 'mode' || screen === 'loading') && (
        <ModeScreen
          loading={screen === 'loading'}
          loadingMsg={loadingMsg}
          loadingErr={loadingErr}
          onRetry={() => {
            setLoadingErr('')
            tokenStore.clear()
            reset()
            setScreen('mode')
          }}
        />
      )}
      {screen === 'auth' && <AuthScreen />}
      {screen === 'app'  && <AppScreen />}
      <AdminToast />
      <CallBanner />
      <ConfirmModal />
      <AlertModal />
    </>
  )
}
