import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useStore }       from './store/useStore'
import { useRestaurants } from './hooks/useRestaurants'
import { applyPwaUpdate, onPwaUpdate } from './lib/pwa'

import { Toast }       from './components/ui/Toast'
import { BottomNav }   from './components/layout/BottomNav'
import { SidebarNav }  from './components/layout/SidebarNav'
import { CartBar }     from './components/layout/CartBar'
import { CartSheet }   from './components/layout/CartSheet'
import { DishModal }   from './components/menu/DishModal'

import { HomeScreen }          from './screens/HomeScreen'
import { RestaurantScreen }    from './screens/RestaurantScreen'
import { QRScreen }            from './screens/QRScreen'
import { TableScreen }         from './screens/TableScreen'
import { MapScreen }           from './screens/MapScreen'
import { PromosScreen }        from './screens/PromosScreen'
import { OwnersScreen }        from './screens/OwnersScreen'
import { CheckoutScreen }      from './screens/CheckoutScreen'
import { OrderTrackingScreen } from './screens/OrderTrackingScreen'

const SCREENS: Record<string, React.FC> = {
  home:       HomeScreen,
  restaurant: RestaurantScreen,
  qr:         QRScreen,
  table:      TableScreen,
  map:        MapScreen,
  promos:     PromosScreen,
  owners:     OwnersScreen,
  checkout:        CheckoutScreen,
  'order-tracking': OrderTrackingScreen,
}

export default function App() {
  const { currentScreen, theme } = useStore()
  const [pwaUpdate, setPwaUpdate] = useState<ServiceWorkerRegistration | null>(null)

  useRestaurants()

  useEffect(() => onPwaUpdate(setPwaUpdate), [])

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
    localStorage.setItem('cafe_theme', theme)
  }, [theme])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const slug  = params.get('slug')
    const token = params.get('token')
    if (slug && token) useStore.getState().set({ currentScreen: 'qr' })
  }, [])

  const Screen = SCREENS[currentScreen] ?? HomeScreen

  return (
    <div className="app-layout">
      {/* Sidebar — visible only on tablet/desktop via CSS */}
      <SidebarNav />

      {/* Main content */}
      <div className="main-content relative min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
          >
            <Screen />
          </motion.div>
        </AnimatePresence>

        {/* Mobile bottom nav */}
        <BottomNav />
        <CartBar />
        <CartSheet />
        <DishModal />
        {pwaUpdate && (
          <div className="fixed inset-x-3 bottom-24 z-[120] mx-auto max-w-md rounded-2xl border border-white/10 bg-[#21150f] p-4 text-white shadow-2xl" role="status">
            <div className="text-sm font-semibold">Доступно обновление Plait</div>
            <div className="mt-1 text-xs text-white/70">Обновим приложение безопасно. Корзина сохранится.</div>
            <div className="mt-3 flex gap-2">
              <button className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#21150f]" onClick={() => applyPwaUpdate(pwaUpdate)}>Обновить</button>
              <button className="rounded-xl border border-white/15 px-3 py-2 text-sm" onClick={() => setPwaUpdate(null)}>Позже</button>
            </div>
          </div>
        )}
        <Toast />
      </div>
    </div>
  )
}
