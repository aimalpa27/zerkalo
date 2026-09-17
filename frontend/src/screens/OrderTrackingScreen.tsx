import { ArrowLeft, CheckCircle2, Circle, Bike, ShoppingBag, MapPin, Phone, User } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useSession } from '../hooks/useSession'
import { Spinner } from '../components/ui/Spinner'

const PICKUP_STEPS: Array<{ key: string; label: string }> = [
  { key: 'new',              label: 'Заказ принят' },
  { key: 'confirmed',        label: 'Подтверждён' },
  { key: 'preparing',        label: 'Готовится' },
  { key: 'ready_for_pickup', label: 'Готов к выдаче' },
  { key: 'completed',        label: 'Заказ выдан' },
]

const DELIVERY_STEPS: Array<{ key: string; label: string }> = [
  { key: 'new',        label: 'Заказ принят' },
  { key: 'confirmed',  label: 'Подтверждён' },
  { key: 'preparing',  label: 'Готовится' },
  { key: 'on_the_way', label: 'Курьер в пути' },
  { key: 'completed',  label: 'Доставлен' },
]

export function OrderTrackingScreen() {
  const store = useStore()
  useSession(store.tableRestaurant?.id ?? null, null)

  const sess = store.activeSession

  const leave = () => {
    store.clearListeners()
    store.set({ activeSession: null, tableToken: null, tableRestaurant: null, currentScreen: 'home' })
  }

  if (!sess) {
    return (
      <div className="px-4 pt-5 pb-10 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={leave} className="w-9 h-9 rounded-full bg-card border border-rim flex items-center justify-center">
            <ArrowLeft size={16} className="text-soft" />
          </button>
          <h2 className="text-lg font-bold text-soft">Ваш заказ</h2>
        </div>
        <Spinner />
      </div>
    )
  }

  const isDelivery = sess.orderType === 'delivery'
  const steps = isDelivery ? DELIVERY_STEPS : PICKUP_STEPS
  const cancelled = sess.deliveryStatus === 'cancelled'
  const currentIdx = cancelled ? -1 : steps.findIndex(s => s.key === (sess.deliveryStatus || 'new'))

  return (
    <div className="px-4 pt-5 pb-10 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={leave} className="w-9 h-9 rounded-full bg-card border border-rim flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={16} className="text-soft" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-soft">Ваш заказ</h2>
          <p className="text-xs text-dim flex items-center gap-1">
            {isDelivery ? <Bike size={12} /> : <ShoppingBag size={12} />}
            {isDelivery ? 'Доставка' : 'Самовывоз'}
          </p>
        </div>
      </div>

      {cancelled ? (
        <div className="bg-card2 border border-red-400/30 rounded-2xl p-4 mb-5 text-center">
          <p className="text-red-400 font-bold text-sm">Заказ отменён</p>
          <p className="text-dim text-xs mt-1">Свяжитесь с заведением для уточнения деталей</p>
        </div>
      ) : (
        <div className="bg-card2 rounded-2xl p-4 mb-5">
          <div className="flex flex-col gap-0">
            {steps.map((step, i) => {
              const done = i <= currentIdx
              const isLast = i === steps.length - 1
              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    {done
                      ? <CheckCircle2 size={20} className="text-gold flex-shrink-0" />
                      : <Circle size={20} className="text-dim flex-shrink-0" />
                    }
                    {!isLast && <div className={`w-0.5 flex-1 my-1 ${done ? 'bg-gold' : 'bg-rim'}`} style={{ minHeight: 20 }} />}
                  </div>
                  <p className={`text-sm pb-5 ${done ? 'text-soft font-semibold' : 'text-dim'}`}>{step.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="flex flex-col gap-2 mb-5">
        <p className="text-xs font-bold text-gold/70 tracking-[1.5px] uppercase">Состав заказа</p>
        {sess.items.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-card2 rounded-xl px-3 py-2.5">
            <span className="text-sm text-soft">{item.itemName} <span className="text-dim">×{item.quantity}</span></span>
            <span className="text-sm font-bold text-gold">{(item.price * item.quantity).toLocaleString('ru')} ₸</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="bg-card2 rounded-2xl p-4 mb-5 flex flex-col gap-1.5">
        <div className="flex justify-between text-sm text-mid">
          <span>Сумма заказа</span>
          <span>{sess.subtotalAmount.toLocaleString('ru')} ₸</span>
        </div>
        {(sess.deliveryFee ?? 0) > 0 && (
          <div className="flex justify-between text-sm text-mid">
            <span>Доставка</span>
            <span>{(sess.deliveryFee ?? 0).toLocaleString('ru')} ₸</span>
          </div>
        )}
        <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-rim/50">
          <span className="text-soft text-sm font-semibold">Итого</span>
          <span className="text-gold font-bold text-xl">{sess.totalAmount.toLocaleString('ru')} ₸</span>
        </div>
      </div>

      {/* Customer / delivery info */}
      <div className="bg-card2 rounded-2xl p-4 flex flex-col gap-2">
        <p className="text-xs font-bold text-gold/70 tracking-[1.5px] uppercase mb-1">Информация</p>
        {sess.customerName && (
          <div className="flex items-center gap-2 text-sm text-soft"><User size={14} className="text-dim" /> {sess.customerName}</div>
        )}
        {sess.customerPhone && (
          <div className="flex items-center gap-2 text-sm text-soft"><Phone size={14} className="text-dim" /> {sess.customerPhone}</div>
        )}
        {isDelivery && sess.deliveryAddress && (
          <div className="flex items-center gap-2 text-sm text-soft"><MapPin size={14} className="text-dim" /> {sess.deliveryAddress}</div>
        )}
        {sess.deliveryComment && (
          <p className="text-xs text-dim mt-1">💬 {sess.deliveryComment}</p>
        )}
      </div>
    </div>
  )
}
