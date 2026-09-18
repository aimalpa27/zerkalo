/**
 * KitchenApp — кухонное табло.
 * Аутентификация — Django JWT.
 */
import React, { useEffect, useState } from 'react'
import { api, tokenStore, type SLAAlert } from '../lib/api'
import { useKitchenStore } from './store'
import { useKitchenSessions } from './hooks/useKitchenSessions'
import KitchenLoginScreen from './screens/KitchenLoginScreen'
import KitchenBoardScreen from './screens/KitchenBoardScreen'
import NewOrderBanner from './components/NewOrderBanner'

export default function KitchenApp() {
  const { screen, sessions, restId, reset, setRest, setScreen } = useKitchenStore()

  useKitchenSessions()

  const [bannerVisible, setBannerVisible] = useState(false)
  const [slaAlerts, setSlaAlerts] = useState<SLAAlert[]>([])
  const prevCountRef = React.useRef(0)

  // SLA warnings are server-authoritative and tenant scoped. Kitchen receives
  // preparation alerts only; polling also materializes durable breach history.
  useEffect(() => {
    if (!restId) return
    let cancelled = false
    const load = async () => {
      const id = restId
      if (!id) return
      try { const d = await api.slaIncidents(id); if (!cancelled) setSlaAlerts(d.alerts) } catch { /* keep last good alerts */ }
    }
    load(); const timer = setInterval(load, 8000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [restId])

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
      {slaAlerts.length > 0 && <div style={{position:'fixed',top:12,left:'50%',transform:'translateX(-50%)',zIndex:120,width:'min(92vw,720px)',padding:'10px 14px',borderRadius:14,background:'rgba(127,29,29,.96)',color:'#fff',boxShadow:'0 8px 30px rgba(0,0,0,.35)'}}>
        <b>⚠ SLA: {slaAlerts.filter(a=>a.severity==='overdue').length} просрочено</b>
        <div style={{fontSize:12,marginTop:4}}>{slaAlerts.slice(0,3).map(a => `Стол ${a.table_number} · ${a.item_name} · ${a.elapsed_minutes}/${a.target_minutes} мин`).join('  •  ')}</div>
      </div>}
      <KitchenBoardScreen />
    </>
  )
}
