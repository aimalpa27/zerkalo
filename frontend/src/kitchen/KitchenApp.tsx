/**
 * KitchenApp — кухонное табло.
 * Аутентификация — Django JWT.
 */
import React, { useEffect, useState } from 'react'
import { api, tokenStore } from '../lib/api'
import { useKitchenStore } from './store'
import { useKitchenSessions } from './hooks/useKitchenSessions'
import KitchenLoginScreen from './screens/KitchenLoginScreen'
import KitchenBoardScreen from './screens/KitchenBoardScreen'
import NewOrderBanner from './components/NewOrderBanner'

export default function KitchenApp() {
  const { screen, sessions, reset, setRest, setScreen } = useKitchenStore()

  useKitchenSessions()

  const [bannerVisible, setBannerVisible] = useState(false)
  const prevCountRef = React.useRef(0)

  // Баннер при новых заказах
  useEffect(() => {
    const cur = sessions.length
    if (cur > prevCountRef.current) {
      setBannerVisible(true)
      const t = setTimeout(() => setBannerVisible(false), 3500)
      return () => clearTimeout(t)
    }
    prevCountRef.current = cur
  }, [sessions.length])

  // Восстановление сессии при перезагрузке страницы (refresh-токен есть —
  // пробуем восстановить ресторан, не отправляя обратно на экран входа)
  useEffect(() => {
    if (!tokenStore.hasSession()) {
      reset()
      return
    }

    setScreen('loading')
    api.me()
      .then(async (user) => {
        if (user.role !== 'kitchen') {
          tokenStore.clear()
          reset()
          return
        }
        const restId = user.restaurant_id
        if (!restId) {
          tokenStore.clear()
          reset()
          return
        }
        const restName = await api.restaurantById(restId).then(r => r.name).catch(() => '')
        setRest(restId, restName)
      })
      .catch(() => {
        tokenStore.clear()
        reset()
      })
  }, [])

  if (screen === 'login') return <KitchenLoginScreen />

  if (screen === 'loading') {
    return (
      <div className="kitchen-loading">
        <div className="spin" />
        <p className="kitchen-loading__text">Подключение...</p>
      </div>
    )
  }

  return (
    <>
      <NewOrderBanner visible={bannerVisible} />
      <KitchenBoardScreen />
    </>
  )
}
