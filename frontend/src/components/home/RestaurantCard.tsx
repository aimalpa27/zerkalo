import { Star, Clock, MapPin } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Restaurant } from '../../types'

interface Props {
  restaurant: Restaurant
  onClick: () => void
}

export function RestaurantCard({ restaurant: r, onClick }: Props) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="rounded-3xl overflow-hidden cursor-pointer card-glow"
      style={{ background: 'var(--color-card)' }}
    >
      {/* Cover */}
      <div className="h-44 relative overflow-hidden flex items-center justify-center"
        style={{ background: 'var(--color-card2)' }}
      >
        {r.coverImageUrl
          ? <img src={r.coverImageUrl} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
          : (
            <span className="text-5xl font-bold tracking-widest" style={{ color: 'var(--glow-border)' }}>
              {r.name?.slice(0,2)?.toUpperCase()}
            </span>
          )
        }
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.65) 100%)' }} />

        {r.logoUrl && (
          <div
            className="absolute bottom-3 right-3 w-12 h-12 rounded-2xl overflow-hidden border-2"
            style={{ borderColor: 'var(--color-card)', background: 'var(--color-card2)' }}
          >
            <img src={r.logoUrl} alt={`${r.name} логотип`} className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}

        {r.rating && r.rating > 0 && (
          <div
            className="absolute top-3 right-3 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-xl"
            style={{ background: 'var(--color-gold)', color: '#1A0F08' }}
          >
            <Star size={10} fill="currentColor" />
            {r.rating.toFixed(1)}
          </div>
        )}

        {r.tags && r.tags.length > 0 && (
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            {r.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-[9px] px-2 py-0.5 rounded-md backdrop-blur-sm"
                style={{ background: 'rgba(0,0,0,0.65)', color: 'var(--color-mid)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-base mb-1" style={{ color: 'var(--color-soft)' }}>{r.name}</h3>
        {r.address && (
          <div className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: 'var(--color-mid)' }}>
            <MapPin size={11} />
            <span>{r.address}</span>
          </div>
        )}
        {r.workingHours && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-green)' }}>
            <Clock size={11} />
            <span>{r.workingHours}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
