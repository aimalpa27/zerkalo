import { useState, useEffect } from 'react'
import { ArrowLeft, Bell, ShoppingCart, Receipt, X, ChevronRight, RefreshCw, WifiOff, Utensils } from 'lucide-react'
import { api } from '../lib/api'
import { useStore } from '../store/useStore'
import { useMenu } from '../hooks/useMenu'
import { useSession } from '../hooks/useSession'
import { useCart } from '../hooks/useCart'
import { MenuCard } from '../components/menu/MenuCard'
import { showToast } from '../components/ui/Toast'
import { Spinner } from '../components/ui/Spinner'
import { applyRestaurantTheme, resetRestaurantTheme } from '../lib/restaurantTheme'
import { useT } from '../hooks/useT'

// label — канонический текст на русском, который уходит официанту в панель;
// tKey — ключ перевода для отображения гостю на его языке
const WAITER_REASONS = [
  { tKey: 'reason_menu' as const,    label: 'Принесите меню',           emoji: '📋' },
  { tKey: 'reason_napkins' as const, label: 'Нужны салфетки / приборы', emoji: '🧻' },
  { tKey: 'reason_clean' as const,   label: 'Уберите со стола',         emoji: '🗑️' },
  { tKey: 'reason_bill' as const,    label: 'Запросить счёт',           emoji: '💳' },
  { tKey: 'reason_other' as const,   label: 'Другое',                   emoji: '🔔' },
]

export function TableScreen() {
  const store = useStore()
  const { cartCount } = useCart()
  const [tab, setTab] = useState<'menu' | 'bill'>('menu')
  const [waiterOpen, setWaiterOpen] = useState(false)
  const [callingReason, setCallingReason] = useState<string | null>(null)
  const t = useT()

  useMenu(store.tableRestaurant?.id ?? null, store.tableToken)
  useSession(store.tableRestaurant?.id ?? null, store.tableId)

  // Apply per-restaurant color theme
  useEffect(() => {
    applyRestaurantTheme(
      store.tableRestaurant?.slug ?? null,
      store.tableRestaurant?.name ?? null
    )
    return () => resetRestaurantTheme()
  }, [store.tableRestaurant?.id])

  const leave = () => {
    resetRestaurantTheme()
    store.clearListeners()
    store.set({ cart: {}, activeSession: null, tableId: null, tableRestaurant: null, currentScreen: 'home' })
  }

  const callWaiter = async (reason: string) => {
    if (!store.tableToken) {
      showToast('Ошибка: токен стола не найден')
      return
    }
    setCallingReason(reason)
    try {
      await api.waiterCall(store.tableToken, reason)
      showToast(t('waiter_called'))
    } catch (e: any) {
      showToast('Ошибка вызова: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
    setCallingReason(null)
    setWaiterOpen(false)
  }

  const requestBill = async () => {
    if (!store.tableToken) { showToast('Ошибка: токен стола не найден'); return }
    try {
      await api.requestPaymentByToken(store.tableToken)
      showToast('Запрос счёта отправлен!')
    } catch (e: any) {
      showToast('Ошибка запроса счёта: ' + (e?.message ?? ''))
    }
  }

  // Гость может отменить СВОЮ позицию, пока она ждёт подтверждения официанта.
  const cancelItem = async (item: any) => {
    if (!store.tableToken) return
    try {
      await api.cancelGuestItem(store.tableToken, item.id)
      // Оптимистично помечаем позицию отменённой — счёт скрывает cancelled;
      // полное обновление подтянет useSession (polling каждые 8с + WebSocket).
      const cur = store.activeSession
      if (cur) {
        store.set({
          activeSession: {
            ...cur,
            items: (cur.items ?? []).map((i: any) =>
              i.id === item.id ? { ...i, status: 'cancelled' } : i
            ),
          },
        })
      }
    } catch (e: any) {
      showToast('Ошибка отмены: ' + (e?.message ?? ''))
    }
  }

  const sess = store.activeSession
  const items = store.selectedCat
    ? store.menuItems.filter(i => i.categoryId === store.selectedCat)
    : store.menuItems

  return (
    <div className="pb-24 md:pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button onClick={leave} className="w-9 h-9 rounded-full bg-card border border-rim flex items-center justify-center">
          <ArrowLeft size={16} className="text-soft" />
        </button>
        <div className="text-center">
          <p className="font-bold text-sm text-soft">{store.tableRestaurant?.name}</p>
          <p className="text-xs text-gold">Стол №{store.tableNumber}</p>
        </div>
        {cartCount() > 0
          ? <div className="flex items-center gap-1 bg-gold/15 border border-gold/30 rounded-xl px-3 py-1.5">
              <ShoppingCart size={13} className="text-gold" />
              <span className="text-gold text-xs font-bold">{cartCount()}</span>
            </div>
          : <div className="w-9" />
        }
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 mb-3">
        {(['menu', 'bill'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === tabKey ? 'bg-gold text-bg' : 'bg-card text-dim border border-rim'}`}>
            {tabKey === 'menu' ? t('tab_menu') : t('tab_bill')}
          </button>
        ))}
      </div>

      {tab === 'menu' && (
        <>
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-2">
            <button onClick={() => store.set({ selectedCat: null })}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold ${!store.selectedCat ? 'bg-gold text-bg' : 'bg-card text-mid border border-rim'}`}>
              Все
            </button>
            {store.categories.map(c => (
              <button key={c.id} onClick={() => store.set({ selectedCat: c.id })}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold ${store.selectedCat === c.id ? 'bg-gold text-bg' : 'bg-card text-mid border border-rim'}`}>
                {c.name}
              </button>
            ))}
          </div>

          {store.menuLoadState === 'error' && (
            <div className="mx-4 mb-3 rounded-2xl border border-red/30 bg-red/10 p-3 flex items-start gap-3">
              <WifiOff size={18} className="text-red flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-soft">Связь с меню прервана</p>
                <p className="text-xs text-mid mt-0.5">{store.menuLoadError ?? 'Проверьте интернет и повторите.'}</p>
                {store.menuItems.length > 0 && store.menuLastUpdatedAt && <p className="text-[10px] text-dim mt-1">Корзина сохранена · меню на {new Date(store.menuLastUpdatedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</p>}
              </div>
              <button aria-label="Повторить загрузку меню" onClick={() => store.set({ menuReloadNonce: store.menuReloadNonce + 1 })} className="w-9 h-9 rounded-xl bg-card flex items-center justify-center flex-shrink-0">
                <RefreshCw size={15} className="text-gold" />
              </button>
            </div>
          )}
          {store.menuLoadState === 'loading' && !store.menuItems.length ? <Spinner /> :
            store.menuLoadState === 'error' && !store.menuItems.length ? (
              <div className="px-4 py-10 text-center text-dim"><WifiOff size={34} className="mx-auto mb-3 opacity-40" /><p className="text-sm">Меню временно недоступно. Корзина не будет очищена.</p></div>
            ) : !store.menuItems.length ? (
              <div className="px-4 py-10 text-center text-dim"><Utensils size={34} className="mx-auto mb-3 opacity-40" /><p className="text-sm">В меню пока нет доступных блюд</p></div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-dim"><p className="text-sm">В этой категории пока нет блюд</p></div>
            ) : <div className="px-3 grid grid-cols-3 gap-2.5 menu-grid">
                {items.map(item => <MenuCard key={item.id} item={item} onPress={() => store.set({ dishModalItem: item })} />)}
              </div>
          }

          {/* Waiter call button */}
          <div className="px-4 mt-5">
            <button
              onClick={() => setWaiterOpen(true)}
              className="w-full border border-gold/40 text-gold rounded-2xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 hover:bg-gold/10 transition-colors"
            >
              <Bell size={16} />
              {t('call_waiter')}
            </button>
          </div>
        </>
      )}

      {tab === 'bill' && (
        <div className="px-4 flex flex-col gap-3">
          {!sess && Object.keys(store.cart).length === 0 ? (
            <p className="text-center text-dim py-12 text-sm">Добавьте блюда из меню</p>
          ) : (
            <>
              {/* ── Статус-баннер ── */}
              {sess && (() => {
                const activeItems = (sess.items ?? []).filter((i: any) => i.status !== 'cancelled' && i.status !== 'rejected')
                const allServed = activeItems.length > 0 && activeItems.every((i: any) => i.status === 'served' || i.status === 'delivered')
                const allReady  = activeItems.length > 0 && activeItems.every((i: any) => ['ready','served','delivered'].includes(i.status))
                const someReady = activeItems.some((i: any) => ['ready','served','delivered'].includes(i.status))
                if (sess.status === 'awaiting_payment' || sess.status === 'payment_requested')
                  return <div className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,107,26,0.12)' }}><p className="font-bold text-gold">💳 Запрошена оплата</p><p className="text-xs text-mid mt-0.5">Официант принесёт счёт</p></div>
                if (allServed)
                  return <div className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,107,26,0.12)' }}><p className="font-bold text-gold">🎉 Всё подано!</p><p className="text-xs text-mid mt-0.5">Приятного аппетита</p></div>
                if (allReady)
                  return <div className="rounded-2xl p-3 text-center" style={{ background: 'rgba(76,175,80,0.12)' }}><p className="font-bold text-green">✓ Заказ готов!</p><p className="text-xs text-mid mt-0.5">Официант несёт блюда</p></div>
                if (someReady)
                  return <div className="rounded-2xl p-3 text-center" style={{ background: 'rgba(76,175,80,0.08)' }}><p className="font-bold text-green">Часть заказа готова</p><p className="text-xs text-mid mt-0.5">Остальное скоро будет</p></div>
                return <div className="rounded-2xl p-3 text-center bg-card"><p className="font-bold text-soft">⏳ Готовится</p><p className="text-xs text-mid mt-0.5">Кухня уже работает над заказом</p></div>
              })()}

              {/* ── Позиции счёта ── */}
              {sess && (
                <div className="bg-card border border-rim/50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-gold tracking-[2px] uppercase mb-3">{t('bill_title')}</p>
                  {(sess.items ?? []).filter((i: any) => i.status !== 'cancelled').map((item: any, i: number) => {
                    const STATUS_MAP: Record<string, { label: string; color: string }> = {
                      pending:               { label: '⏳ Готовится',  color: 'var(--color-gold)' },
                      waiter_confirmed:      { label: '✅ Принят',     color: 'var(--color-green)' },
                      sent_to_kitchen:       { label: '🔥 На кухне',   color: '#FF8C00' },
                      sent_to_bar:           { label: '🍹 В баре',     color: '#00BFFF' },
                      awaiting_confirmation: { label: `⏳ ${t('item_status_awaiting')}`, color: 'var(--color-gold)' },
                      confirmed:             { label: `✅ ${t('item_status_confirmed')}`, color: 'var(--color-green)' },
                      ready:                 { label: '🔔 Готово!',    color: 'var(--color-green)' },
                      served:                { label: '🍽️ Подано',    color: 'var(--color-mid)' },
                      rejected:              { label: `❌ ${t('item_status_rejected')}`, color: 'var(--color-red)' },
                      cancelled:             { label: '❌ Отменён',    color: 'var(--color-red)' },
                    }
                    const st = STATUS_MAP[item.status] ?? { label: item.status, color: 'var(--color-mid)' }
                    const canCancel = item.status === 'awaiting_confirmation' && item.addedBy === 'guest'
                    return (
                      <div key={item.id ?? i} className="flex justify-between items-center py-2 border-b border-rim/50">
                        <div className="flex-1">
                          <p className="text-sm text-soft">{item.itemName} ×{item.quantity}</p>
                          <p className="text-[10px] mt-0.5 font-semibold" style={{ color: st.color }}>
                            {st.label}{item.status === 'rejected' && item.rejectReason ? ` · ${item.rejectReason}` : ''}
                          </p>
                        </div>
                        {canCancel && (
                          <button
                            onClick={() => cancelItem(item)}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg border border-red/40 text-red mr-2 active:scale-95 transition-transform"
                          >
                            {t('cancel_item_btn')}
                          </button>
                        )}
                        <p className="text-sm font-bold text-gold">{(item.price * item.quantity).toLocaleString('ru')} ₸</p>
                      </div>
                    )
                  })}
                  <div className="flex justify-between py-2 text-xs text-mid border-t border-rim/30 mt-1">
                    <span>{t('bill_subtotal')}</span><span>{(sess.subtotalAmount ?? 0).toLocaleString('ru')} ₸</span>
                  </div>
                  <div className="flex justify-between py-1 text-xs text-mid">
                    <span>Сервис {sess.serviceChargePercent}%</span>
                    <span>{(sess.serviceChargeAmount ?? 0).toLocaleString('ru')} ₸</span>
                  </div>
                  {sess.paymentMethod && (
                    <div className="flex justify-between py-1 text-xs text-mid">
                      <span>Оплата</span>
                      <span>{sess.paymentMethod === 'card' ? '💳 Карта' : '💵 Наличные'}</span>
                    </div>
                  )}
                  <div className="h-px bg-gold/20 my-2" />
                  <div className="flex justify-between font-bold">
                    <span className="text-soft">{t('bill_total')}</span>
                    <span className="text-gold text-lg">{(sess.totalAmount ?? 0).toLocaleString('ru')} ₸</span>
                  </div>
                </div>
              )}

              {/* ── Кнопка запросить счёт ── */}
              {sess && sess.status === 'open' && (
                <button
                  onClick={requestBill}
                  className="w-full border border-gold/40 text-gold rounded-2xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 hover:bg-gold/10 transition-colors"
                >
                  <Receipt size={16} />
                  Запросить счёт
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Waiter reason bottom sheet ── */}
      {waiterOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
            onClick={() => setWaiterOpen(false)}
          />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-card rounded-t-3xl z-50 pb-8">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-rim" />
            </div>

            <div className="flex items-center justify-between px-5 pb-3">
              <div>
                <p className="font-bold text-soft">{t('call_waiter')}</p>
                <p className="text-xs text-mid mt-0.5">{t('waiter_choose_reason')}</p>
              </div>
              <button
                onClick={() => setWaiterOpen(false)}
                className="w-8 h-8 rounded-full bg-card2 flex items-center justify-center"
              >
                <X size={16} className="text-soft" />
              </button>
            </div>

            <div className="px-4 flex flex-col gap-2">
              {WAITER_REASONS.map(({ tKey, label, emoji }) => (
                <button
                  key={label}
                  onClick={() => callWaiter(label)}
                  disabled={callingReason === label}
                  className="flex items-center justify-between px-4 py-3.5 bg-card2 border border-rim/40 rounded-2xl hover:border-gold/40 hover:bg-gold/5 transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{emoji}</span>
                    <span className="text-sm font-medium text-soft">{t(tKey)}</span>
                  </div>
                  <ChevronRight size={16} className="text-dim" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
