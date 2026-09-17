import { Tag } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useT } from '../hooks/useT'

export function PromosScreen() {
  const { promos } = useStore()
  const t = useT()

  return (
    <div className="px-4 pt-5 pb-24">
      <h2 className="font-bold text-lg text-soft mb-4">{t('promos_title')}</h2>
      {!promos.length
        ? (
          <div className="flex flex-col items-center py-16 text-dim">
            <Tag size={40} className="mb-3 opacity-30" />
            <p className="text-sm">{t('promos_empty')}</p>
          </div>
        )
        : (
          <div className="flex flex-col gap-3">
            {promos.map(p => (
              <div key={p.id} className="bg-card border border-rim/50 rounded-2xl p-4">
                <p className="text-[10px] text-gold uppercase tracking-widest mb-1">{p.restaurantName}</p>
                <h3 className="font-bold text-soft text-base mb-1">{p.title}</h3>
                {p.description && <p className="text-mid text-sm leading-relaxed mb-2">{p.description}</p>}
                {p.validUntil && <p className="text-[11px] text-dim">До: {p.validUntil}</p>}
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}