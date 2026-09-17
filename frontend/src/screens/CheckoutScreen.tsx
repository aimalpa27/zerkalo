import { useState } from 'react'
import { ArrowLeft, Plus, Minus, Loader, Bike, ShoppingBag, Banknote, CreditCard, ShoppingCart } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useCart } from '../hooks/useCart'
import { showToast } from '../components/ui/Toast'

export function CheckoutScreen() {
  const store = useStore()
  const { addItem, decItem, cartTotal, placeDeliveryOrder } = useCart()
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const r = store.currentRestaurant as any

  const cartItems = Object.entries(store.cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const item = store.menuItems.find(i => i.id === id)
      if (!item) return null
      const price = (item.discountPercent ?? 0) > 0
        ? item.price - Math.floor(item.price * item.discountPercent! / 100)
        : item.price
      return { ...item, qty, price }
    })
    .filter(Boolean) as Array<{ id: string; name: string; price: number; qty: number; imageUrl?: string; emoji?: string }>

  const goBack = () => store.set({ currentScreen: store.prevScreen })

  const orderType = store.checkoutOrderType
  const deliveryFee = orderType === 'delivery' ? Number(r?.delivery_fee ?? 0) : 0
  const minOrder = Number(r?.delivery_min_order ?? 0)
  const subtotal = cartTotal()
  const total = subtotal + deliveryFee
  const belowMin = orderType === 'delivery' && minOrder > 0 && subtotal < minOrder

  const submit = async () => {
    if (loading) return
    if (!cartItems.length) { showToast('Корзина пуста'); return }
    setSubmitError(null)
    setLoading(true)
    const result = await placeDeliveryOrder({
      orderType,
      customerName: store.customerName,
      customerPhone: store.customerPhone,
      deliveryAddress: store.deliveryAddress,
      deliveryComment: store.deliveryComment,
      paymentMethod: store.paymentMethod,
    })
    setLoading(false)

    if (result?.error) {
      setSubmitError(result.error)
      showToast(result.error)
      return
    }

    const session: any = result?.session
    if (session?.table_token) {
      store.set({
        tableRestaurant: store.currentRestaurant,
        tableId: null,
        tableNumber: null,
        tableToken: session.table_token,
        currentScreen: 'order-tracking',
        prevScreen: 'restaurant',
      })
    }
    showToast('Заказ оформлен!')
  }

  if (!r) return null

  return (
    <div className="px-4 pt-5 pb-32 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={goBack} className="w-9 h-9 rounded-full bg-card border border-rim flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={16} className="text-soft" />
        </button>
        <h2 className="text-lg font-bold text-soft">Оформление заказа</h2>
      </div>

      {/* Order type */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => store.set({ checkoutOrderType: 'pickup' })}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border transition-colors ${
            orderType === 'pickup' ? 'bg-gold/15 border-gold/50 text-gold' : 'bg-card2 border-rim/40 text-mid'
          }`}
        >
          <ShoppingBag size={16} /> Самовывоз
        </button>
        <button
          onClick={() => store.set({ checkoutOrderType: 'delivery' })}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border transition-colors ${
            orderType === 'delivery' ? 'bg-gold/15 border-gold/50 text-gold' : 'bg-card2 border-rim/40 text-mid'
          }`}
        >
          <Bike size={16} /> Доставка
        </button>
      </div>

      {/* Cart items */}
      {cartItems.length === 0 ? (
        <div className="py-12 flex flex-col items-center text-dim">
          <ShoppingCart size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Корзина пуста — вернитесь в меню и добавьте блюда</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-5">
          {cartItems.map(item => (
            <div key={item.id} className="flex items-center gap-3 bg-card2 rounded-2xl p-3">
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
          ))}
        </div>
      )}

      {/* Customer info */}
      <div className="flex flex-col gap-3 mb-5">
        <p className="text-xs font-bold text-gold/70 tracking-[1.5px] uppercase">Контактные данные</p>
        <input
          value={store.customerName}
          onChange={e => store.set({ customerName: e.target.value })}
          placeholder="Ваше имя"
          className="w-full bg-card border border-rim rounded-2xl px-4 py-3.5 text-soft text-sm outline-none focus:border-gold transition-colors placeholder:text-dim"
        />
        <input
          value={store.customerPhone}
          onChange={e => store.set({ customerPhone: e.target.value })}
          placeholder="Номер телефона"
          type="tel"
          className="w-full bg-card border border-rim rounded-2xl px-4 py-3.5 text-soft text-sm outline-none focus:border-gold transition-colors placeholder:text-dim"
        />

        {orderType === 'delivery' && (
          <>
            <textarea
              value={store.deliveryAddress}
              onChange={e => store.set({ deliveryAddress: e.target.value })}
              placeholder="Адрес доставки (улица, дом, квартира, подъезд)"
              rows={2}
              className="w-full bg-card border border-rim rounded-2xl px-4 py-3.5 text-soft text-sm outline-none focus:border-gold transition-colors placeholder:text-dim resize-none"
            />
            {minOrder > 0 && (
              <p className={`text-xs ${belowMin ? 'text-red-400' : 'text-dim'}`}>
                Минимальная сумма заказа для доставки — {minOrder.toLocaleString('ru')} ₸
              </p>
            )}
            {deliveryFee > 0 && (
              <p className="text-xs text-dim">Стоимость доставки — {deliveryFee.toLocaleString('ru')} ₸</p>
            )}
          </>
        )}

        <textarea
          value={store.deliveryComment}
          onChange={e => store.set({ deliveryComment: e.target.value })}
          placeholder="Комментарий к заказу (необязательно)"
          rows={2}
          className="w-full bg-card border border-rim rounded-2xl px-4 py-3.5 text-soft text-sm outline-none focus:border-gold transition-colors placeholder:text-dim resize-none"
        />
      </div>

      {/* Payment method */}
      <div className="mb-5">
        <p className="text-xs font-bold text-gold/70 tracking-[1.5px] uppercase mb-2">Способ оплаты</p>
        <div className="flex gap-2">
          <button
            onClick={() => store.set({ paymentMethod: 'cash' })}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
              store.paymentMethod === 'cash' ? 'bg-gold/15 border-gold/50 text-gold' : 'bg-card2 border-rim/40 text-mid'
            }`}
          >
            <Banknote size={14} /> Наличные
          </button>
          <button
            onClick={() => store.set({ paymentMethod: 'card' })}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
              store.paymentMethod === 'card' ? 'bg-gold/15 border-gold/50 text-gold' : 'bg-card2 border-rim/40 text-mid'
            }`}
          >
            <CreditCard size={14} /> Карта
          </button>
        </div>
      </div>

      {submitError && (
        <div role="alert" className="mb-4 rounded-2xl border border-red/30 bg-red/10 px-4 py-3">
          <p className="text-sm font-bold text-soft">Заказ не отправлен</p>
          <p className="text-xs text-mid mt-1">{submitError}</p>
          <p className="text-[11px] text-dim mt-1">Корзина и введённые данные сохранены. Исправьте данные или повторите отправку.</p>
          <button onClick={submit} disabled={loading || belowMin} className="mt-2 text-xs font-bold text-gold disabled:opacity-50">Повторить отправку</button>
        </div>
      )}

      {/* Footer total + submit */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 border-t border-rim/50 bg-card max-w-lg mx-auto md:relative md:px-0 md:pb-0 md:border-0 md:bg-transparent">
          <div className="flex flex-col gap-1 mb-3">
            <div className="flex justify-between text-sm text-mid">
              <span>Сумма заказа</span>
              <span>{subtotal.toLocaleString('ru')} ₸</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-mid">
                <span>Доставка</span>
                <span>{deliveryFee.toLocaleString('ru')} ₸</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-1">
              <span className="text-mid text-sm">Итого</span>
              <span className="text-gold font-bold text-xl">{total.toLocaleString('ru')} ₸</span>
            </div>
          </div>
          <button
            onClick={submit}
            disabled={loading || belowMin}
            className="w-full bg-gold-gradient rounded-2xl py-4 text-bg font-bold text-sm shadow-gold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader size={16} className="animate-spin" /> : null}
            {loading ? 'Отправка...' : `Оформить заказ · ${total.toLocaleString('ru')} ₸`}
          </button>
        </div>
      )}
    </div>
  )
}
