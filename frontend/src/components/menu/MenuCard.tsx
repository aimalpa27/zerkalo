import { Plus, Minus } from 'lucide-react'
import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { useCart } from '../../hooks/useCart'
import type { MenuItem } from '../../types'

interface Props {
  item: MenuItem
  onPress?: () => void
}

export function MenuCard({ item, onPress }: Props) {
  const { cart } = useStore()
  const { addItem, decItem } = useCart()
  const qty = cart[item.id] ?? 0

  const price = (item.discountPercent ?? 0) > 0
    ? item.price - Math.floor(item.price * item.discountPercent! / 100)
    : item.price

  const badgeColors: Record<string, string> = {
    hit:  'bg-gold/15 text-gold',
    new:  'bg-green/15 text-green',
    sale: 'bg-red/15 text-red',
  }

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onPress}
      className="bg-card rounded-2xl overflow-hidden flex flex-col cursor-pointer card-glow"
    >
      {/* Image */}
      <div className="relative w-full aspect-square overflow-hidden bg-card2">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-4xl">{item.emoji ?? '🍽'}</div>
        }
        {item.badge && (
          <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[9px] font-bold ${badgeColors[item.badge] ?? ''}`}>
            {item.badge.toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2 flex flex-col gap-1 flex-1">
        <p className="text-[12px] font-semibold text-soft leading-tight line-clamp-2">{item.name}</p>
        {item.weight && <p className="text-[10px] text-dim break-words">{item.weight}</p>}
      </div>

      {/* Price + controls */}
      <div className="px-2 pb-2 flex items-center justify-between gap-1">
        <div>
          {(item.discountPercent ?? 0) > 0 && (
            <p className="text-[10px] text-dim line-through">{item.price} ₸</p>
          )}
          <p className="text-[13px] font-bold text-gold">{price} ₸</p>
        </div>

        {qty === 0 ? (
          <button
            onClick={e => { e.stopPropagation(); addItem(item.id) }}
            className="w-7 h-7 rounded-full bg-gold-gradient flex items-center justify-center shadow-gold animate-pulse-gold"
          >
            <Plus size={16} className="text-bg" strokeWidth={2.5} />
          </button>
        ) : (
          <div className="flex items-center gap-1 bg-card2 rounded-full px-1 py-0.5">
            <button onClick={e => { e.stopPropagation(); decItem(item.id) }} className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center">
              <Minus size={12} className="text-gold" />
            </button>
            <span className="text-xs font-bold text-soft min-w-[16px] text-center">{qty}</span>
            <button onClick={e => { e.stopPropagation(); addItem(item.id) }} className="w-6 h-6 rounded-full bg-gold flex items-center justify-center">
              <Plus size={12} className="text-bg" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}