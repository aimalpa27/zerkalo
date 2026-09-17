import { X, Plus, Minus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { useCart } from '../../hooks/useCart'

export function DishModal() {
  const { dishModalItem: item, set, cart, cartNotes } = useStore()
  const { addItem, decItem } = useCart()

  const close = () => set({ dishModalItem: null })

  const qty = item ? (cart[item.id] ?? 0) : 0

  const price = item
    ? (item.discountPercent ?? 0) > 0
      ? item.price - Math.floor(item.price * item.discountPercent! / 100)
      : item.price
    : 0

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
          />

          {/* Sheet — wrapper centres without conflicting with framer-motion transform */}
          <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="w-full max-w-[480px] bg-card rounded-t-3xl overflow-hidden pointer-events-auto max-h-[90vh] flex flex-col"
          >
            {/* Image */}
            <div className="relative w-full h-56 bg-card2">
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-6xl">{item.emoji ?? '🍽'}</div>
              }
              <button
                onClick={close}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"
              >
                <X size={18} className="text-white" />
              </button>
              {item.badge && (
                <div className="absolute top-4 left-4 bg-gold text-bg text-[10px] font-bold px-2 py-0.5 rounded-lg">
                  {item.badge.toUpperCase()}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto">
              <h3 className="font-display text-xl font-bold text-soft mb-1">{item.name}</h3>

              {item.weight && (
                <p className="text-dim text-xs mb-2 break-words">{item.weight}</p>
              )}

              {item.description && (
                <p className="text-mid text-sm leading-relaxed mb-4">{item.description}</p>
              )}

              {/* Price row */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  {(item.discountPercent ?? 0) > 0 && (
                    <p className="text-dim text-sm line-through">{item.price} ₸</p>
                  )}
                  <p className="text-gold font-bold text-2xl">{price} ₸</p>
                </div>

                {qty === 0 ? (
                  <button
                    onClick={() => addItem(item.id)}
                    className="bg-gold-gradient px-6 py-3 rounded-2xl text-bg font-bold text-sm shadow-gold"
                  >
                    Добавить
                  </button>
                ) : (
                  <div className="flex items-center gap-3 bg-card2 rounded-2xl px-3 py-2">
                    <button
                      onClick={() => decItem(item.id)}
                      className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center"
                    >
                      <Minus size={14} className="text-gold" />
                    </button>
                    <span className="text-soft font-bold text-lg min-w-[24px] text-center">{qty}</span>
                    <button
                      onClick={() => addItem(item.id)}
                      className="w-8 h-8 rounded-full bg-gold flex items-center justify-center"
                    >
                      <Plus size={14} className="text-bg" />
                    </button>
                  </div>
                )}
              </div>

              {qty > 0 && (
                <>
                  <textarea
                    value={cartNotes[item.id] ?? ''}
                    onChange={e => set({ cartNotes: { ...cartNotes, [item.id]: e.target.value } })}
                    placeholder="Пожелание к блюду (без лука, без острого...)"
                    rows={2}
                    className="w-full bg-card2 border border-rim rounded-2xl px-4 py-3 text-soft text-sm outline-none focus:border-gold transition-colors placeholder:text-dim resize-none mb-3"
                  />
                  <button
                    onClick={close}
                    className="w-full bg-gold-gradient rounded-2xl py-3.5 text-bg font-bold text-sm shadow-gold"
                  >
                    В корзине {qty} шт · {(price * qty).toLocaleString('ru')} ₸
                  </button>
                </>
              )}
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
