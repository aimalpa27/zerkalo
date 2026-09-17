import { ArrowLeft, QrCode, Bike, RefreshCw, WifiOff, Utensils } from 'lucide-react'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { useMenu } from '../hooks/useMenu'
import { useT } from '../hooks/useT'
import { MenuCard } from '../components/menu/MenuCard'
import { Spinner } from '../components/ui/Spinner'

export function RestaurantScreen() {
  const { currentRestaurant: r, categories, menuItems, selectedCat, set, prevScreen, clearRestListeners, menuLoadState, menuLoadError, menuLastUpdatedAt } = useStore()
  const t = useT()
  useMenu(r?.id ?? null)

  if (!r) return null

  const goBack = () => {
    clearRestListeners()
    set({ currentScreen: prevScreen, categories: [], menuItems: [], selectedCat: null })
  }

  const items = selectedCat ? menuItems.filter(i => i.categoryId === selectedCat) : menuItems

  return (
    <div className="pb-24 md:pb-10">
      {/* Cover */}
      <div className="h-56 bg-card2 relative overflow-hidden">
        {r.coverImageUrl
          ? <img src={r.coverImageUrl} alt={r.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-6xl font-bold text-gold/30">{r.name?.slice(0,2)?.toUpperCase()}</div>
        }
        <div className="absolute inset-0 bg-hero-gradient" />
        <button onClick={goBack} className="absolute top-4 left-4 w-9 h-9 rounded-full glass flex items-center justify-center">
          <ArrowLeft size={17} className="text-soft" />
        </button>
        {r.logoUrl && (
          <div className="absolute bottom-4 right-4 w-14 h-14 rounded-2xl overflow-hidden border-2 border-card">
            <img src={r.logoUrl} alt={`${r.name} логотип`} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="absolute bottom-4 left-4">
          <h2 className="font-display text-2xl font-bold text-soft">{r.name}</h2>
          {r.workingHours && <p className="text-green text-xs mt-0.5">{r.workingHours}</p>}
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        <button
          onClick={() => set({ selectedCat: null })}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${!selectedCat ? 'bg-gold text-bg' : 'bg-card text-mid border border-rim'}`}
        >
          {t('all_categories')}
        </button>
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => set({ selectedCat: c.id })}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedCat === c.id ? 'bg-gold text-bg' : 'bg-card text-mid border border-rim'}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Menu state + grid */}
      {menuLoadState === 'error' && (
        <div className="mx-4 mb-3 rounded-2xl border border-red/30 bg-red/10 p-3 flex items-start gap-3">
          <WifiOff size={18} className="text-red flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-soft">Не удалось обновить меню</p>
            <p className="text-xs text-mid mt-0.5">{menuLoadError ?? 'Проверьте интернет и попробуйте ещё раз.'}</p>
            {menuItems.length > 0 && menuLastUpdatedAt && <p className="text-[10px] text-dim mt-1">Показываем последнее загруженное меню · {new Date(menuLastUpdatedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</p>}
          </div>
          <button aria-label="Повторить загрузку меню" onClick={() => set({ menuReloadNonce: useStore.getState().menuReloadNonce + 1 })} className="w-9 h-9 rounded-xl bg-card flex items-center justify-center flex-shrink-0">
            <RefreshCw size={15} className="text-gold" />
          </button>
        </div>
      )}
      {menuLoadState === 'loading' && !menuItems.length ? <Spinner /> :
        menuLoadState === 'error' && !menuItems.length ? (
          <div className="px-4 py-10 text-center text-dim"><WifiOff size={34} className="mx-auto mb-3 opacity-40" /><p className="text-sm">Меню временно недоступно</p></div>
        ) : !menuItems.length ? (
          <div className="px-4 py-10 text-center text-dim"><Utensils size={34} className="mx-auto mb-3 opacity-40" /><p className="text-sm">В меню пока нет доступных блюд</p></div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-dim"><p className="text-sm">В этой категории пока нет блюд</p></div>
        ) : (
          <div className="px-3 grid grid-cols-3 gap-2.5 menu-grid">
            {items.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <MenuCard item={item} onPress={() => set({ dishModalItem: item })} />
              </motion.div>
            ))}
          </div>
        )
      }

      {/* QR button */}
      <div className="px-4 mt-6 flex flex-col gap-2.5">
        <button
          onClick={() => set({ prevScreen: 'restaurant', currentScreen: 'qr' })}
          className="w-full bg-gold-gradient rounded-2xl py-4 flex items-center justify-center gap-2 text-bg font-bold text-sm shadow-gold"
        >
          <QrCode size={18} />
          {t('scan_and_order')}
        </button>

        {(r as any).features?.delivery && (
          <button
            onClick={() => set({ prevScreen: 'restaurant', currentScreen: 'checkout' })}
            className="w-full bg-card2 border border-rim/50 rounded-2xl py-4 flex items-center justify-center gap-2 text-soft font-bold text-sm"
          >
            <Bike size={18} className="text-gold" />
            Доставка / Самовывоз
          </button>
        )}
      </div>
    </div>
  )
}
