import { useEffect, useRef, useState } from 'react'
import { X, Plus, Minus, Loader, ShoppingCart, CreditCard, Banknote } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { useCart } from '../../hooks/useCart'
import { useT } from '../../hooks/useT'
import { showToast } from '../ui/Toast'
import { api } from '../../lib/api'


export function CartSheet() {
  const { cartOpen, cart, cartNotes, menuItems, upsellRules, upsellAttribution, tableToken, set, currentScreen, paymentMethod } = useStore()
  const { addItem, decItem, cartTotal, cartCount, placeOrder } = useCart()
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [loyalty, setLoyalty] = useState<Awaited<ReturnType<typeof api.guestLoyalty>> | null>(null)
  const [redeemLoyalty, setRedeemLoyalty] = useState(false)

  const close = () => set({ cartOpen: false })

  useEffect(() => {
    if (!cartOpen || !tableToken) return
    const restId = useStore.getState().tableRestaurant?.id
    if (!restId) return
    const token = localStorage.getItem(`plait_loyalty_${restId}`)
    if (!token) { setLoyalty(null); return }
    api.guestLoyalty(tableToken, token).then(v => { setLoyalty(v); if (!v.can_redeem) setRedeemLoyalty(false) }).catch(() => setLoyalty(null))
  }, [cartOpen, tableToken])

  // Build cart items list
  const cartItems = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const item = menuItems.find(i => i.id === id)
      if (!item) return null
      const price = (item.discountPercent ?? 0) > 0
        ? item.price - Math.floor(item.price * item.discountPercent! / 100)
        : item.price
      return { ...item, qty, price }
    })
    .filter(Boolean) as Array<{ id: string; name: string; price: number; qty: number; imageUrl?: string; emoji?: string; categoryId?: string }>

  // Deterministic upsell: only active backend rules whose trigger is already in the cart.
  // No AI and no arbitrary fallback: restaurant controls exactly what is recommended.
  const cartIds = new Set(Object.keys(cart).filter(id => (cart[id] ?? 0) > 0))
  const recommendedIds = upsellRules
    .filter(rule => cartIds.has(rule.trigger_item_id) && !cartIds.has(rule.recommended_item_id))
    .sort((a, b) => a.priority - b.priority)
    .map(rule => rule.recommended_item_id)
  const crossSell = [...new Set(recommendedIds)]
    .map(id => menuItems.find(item => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 8)

  const visibleRules = crossSell.map(item => upsellRules.find(rule => rule.recommended_item_id === item.id && cartIds.has(rule.trigger_item_id))).filter(Boolean) as typeof upsellRules
  const impressed = useRef(new Set<string>())
  useEffect(() => {
    if (!cartOpen || !tableToken) return
    visibleRules.forEach(rule => {
      if (impressed.current.has(rule.id)) return
      impressed.current.add(rule.id)
      api.trackUpsell(tableToken, rule.id, 'impression').catch(() => impressed.current.delete(rule.id))
    })
  }, [cartOpen, tableToken, visibleRules.map(r => r.id).join(',')])

  const addUpsell = (itemId: string) => {
    const rule = visibleRules.find(r => r.recommended_item_id === itemId)
    addItem(itemId)
    if (!rule) return
    set({ upsellAttribution: { ...upsellAttribution, [itemId]: rule.id } })
    if (tableToken) api.trackUpsell(tableToken, rule.id, 'add').catch(() => undefined)
  }

  const handleOrder = async () => {
    if (loading) return
    setOrderError(null)
    setLoading(true)
    const result = await placeOrder(paymentMethod, redeemLoyalty)
    setLoading(false)
    if (result?.error) {
      setOrderError(result.error)
      showToast(result.error)
    } else {
      showToast(t('order_placed'))
      close()
    }
  }

  const isTableScreen = currentScreen === 'table'

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
          />

          {/* Sheet wrapper — centres without conflicting with framer-motion transform */}
          <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="w-full max-w-[480px] bg-card rounded-t-3xl max-h-[90vh] flex flex-col pointer-events-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-rim/50 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className="text-gold" />
                  <h3 className="font-bold text-soft text-base">{t('cart_title')}</h3>
                  <span className="bg-gold/20 text-gold text-xs font-bold px-2 py-0.5 rounded-full">{cartCount()}</span>
                </div>
                <button onClick={close} className="w-8 h-8 rounded-full bg-card2 flex items-center justify-center">
                  <X size={16} className="text-soft" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-5 py-3">
                {cartItems.length === 0 ? (
                  <div className="py-12 flex flex-col items-center text-dim">
                    <ShoppingCart size={40} className="mb-3 opacity-30" />
                    <p className="text-sm">{t('cart_empty_msg')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {cartItems.map(item => (
                      <div key={item.id} className="flex flex-col bg-card2 rounded-2xl p-3 gap-2">
                        <div className="flex items-center gap-3">
                          {item.imageUrl
                            ? <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                            : <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center text-2xl flex-shrink-0">{item.emoji ?? '🍽'}</div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-soft truncate">{item.name}</p>
                            <p className="text-gold text-sm font-bold">{item.price.toLocaleString('ru')} ₸</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => decItem(item.id)} className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center">
                              <Minus size={12} className="text-gold" />
                            </button>
                            <span className="text-soft font-bold text-sm min-w-[20px] text-center">{item.qty}</span>
                            <button onClick={() => addItem(item.id)} className="w-7 h-7 rounded-full bg-gold flex items-center justify-center">
                              <Plus size={12} className="text-bg" />
                            </button>
                          </div>
                        </div>
                        {openNoteId === item.id ? (
                          <input
                            autoFocus
                            value={cartNotes[item.id] ?? ''}
                            onChange={e => set({ cartNotes: { ...cartNotes, [item.id]: e.target.value } })}
                            onBlur={() => setOpenNoteId(null)}
                            placeholder="Пожелание к блюду..."
                            className="w-full bg-card border border-rim rounded-xl px-3 py-2 text-soft text-xs outline-none focus:border-gold transition-colors placeholder:text-dim"
                          />
                        ) : (
                          <button
                            onClick={() => setOpenNoteId(item.id)}
                            className="text-left text-xs px-2 py-1 rounded-lg transition-colors"
                            style={{ color: cartNotes[item.id] ? 'var(--color-gold)' : 'var(--color-dim)' }}
                          >
                            {cartNotes[item.id] ? `📝 ${cartNotes[item.id]}` : '+ пожелание к блюду'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Cross-sell: drinks */}
                {crossSell.length > 0 && cartItems.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-gold/70 tracking-[1.5px] uppercase mb-2">{t('cart_upsell')}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {crossSell.map(item => {
                        const price = (item.discountPercent ?? 0) > 0
                          ? item.price - Math.floor(item.price * item.discountPercent! / 100)
                          : item.price
                        return (
                          <button
                            key={item.id}
                            onClick={() => addUpsell(item.id)}
                            className="flex-shrink-0 w-28 bg-card2 border border-rim/40 rounded-2xl p-2.5 text-left hover:border-gold/40 transition-colors"
                          >
                            {item.imageUrl
                              ? <img src={item.imageUrl} alt={item.name} className="w-full h-16 object-cover rounded-xl mb-1.5" />
                              : <div className="w-full h-16 rounded-xl bg-card flex items-center justify-center text-2xl mb-1.5">{item.emoji ?? '🥤'}</div>
                            }
                            <p className="text-[11px] text-soft font-medium leading-tight line-clamp-2">{item.name}</p>
                            <p className="text-[11px] text-gold font-bold mt-0.5">{price.toLocaleString('ru')} ₸</p>
                            <div className="mt-1.5 w-full bg-gold/20 rounded-lg py-1 flex items-center justify-center">
                              <Plus size={10} className="text-gold" />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {cartItems.length > 0 && (
                <div className="px-5 pb-8 pt-3 border-t border-rim/50 flex-shrink-0">

                  {isTableScreen && loyalty?.program.is_enabled && (
                    <div className="mb-3 rounded-2xl border border-gold/30 bg-gold/10 p-3">
                      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-soft">🎁 {loyalty.points} баллов</p><p className="text-[11px] text-mid mt-0.5">{loyalty.can_redeem ? `Доступна скидка ${Number(loyalty.program.reward_discount_amount).toLocaleString('ru')} ₸` : `Ещё ${loyalty.points_to_reward} балл. до награды`}</p></div>{loyalty.can_redeem && <label className="flex items-center gap-2 text-xs font-bold text-gold"><input type="checkbox" checked={redeemLoyalty} onChange={e=>setRedeemLoyalty(e.target.checked)}/> Использовать</label>}</div>
                    </div>
                  )}

                  {/* Payment method */}
                  {isTableScreen && (
                    <div className="mb-3">
                      <p className="text-xs text-mid mb-1.5">{t('payment_method_label')}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => set({ paymentMethod: 'cash' })}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                            paymentMethod === 'cash'
                              ? 'bg-gold/15 border-gold/50 text-gold'
                              : 'bg-card2 border-rim/40 text-mid'
                          }`}
                        >
                          <Banknote size={14} />
                          {t('pay_cash')}
                        </button>
                        <button
                          onClick={() => set({ paymentMethod: 'card' })}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                            paymentMethod === 'card'
                              ? 'bg-gold/15 border-gold/50 text-gold'
                              : 'bg-card2 border-rim/40 text-mid'
                          }`}
                        >
                          <CreditCard size={14} />
                          {t('pay_card')}
                        </button>
                      </div>
                    </div>
                  )}

                  {orderError && isTableScreen && (
                    <div role="alert" className="mb-3 rounded-xl border border-red/30 bg-red/10 px-3 py-2.5">
                      <p className="text-xs font-bold text-soft">Заказ не отправлен</p>
                      <p className="text-[11px] text-mid mt-0.5">{orderError}</p>
                      <p className="text-[10px] text-dim mt-1">Корзина сохранена — можно повторить отправку.</p>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-mid text-sm">{t('cart_total_label')}</span>
                    <span className="text-gold font-bold text-xl">{Math.max(0, cartTotal() - (redeemLoyalty && loyalty ? Number(loyalty.program.reward_discount_amount) : 0)).toLocaleString('ru')} ₸</span>
                  </div>

                  {isTableScreen ? (
                    <button
                      onClick={handleOrder}
                      disabled={loading}
                      className="w-full bg-gold-gradient rounded-2xl py-4 text-bg font-bold text-sm shadow-gold disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader size={16} className="animate-spin" /> : null}
                      {loading ? t('order_sending') : `${t('checkout_btn')} · ${Math.max(0, cartTotal() - (redeemLoyalty && loyalty ? Number(loyalty.program.reward_discount_amount) : 0)).toLocaleString('ru')} ₸`}
                    </button>
                  ) : (
                    <button
                      onClick={() => { close(); set({ prevScreen: 'restaurant', currentScreen: 'qr' }) }}
                      className="w-full bg-gold-gradient rounded-2xl py-4 text-bg font-bold text-sm shadow-gold"
                    >
                      {t('scan_to_order')}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
