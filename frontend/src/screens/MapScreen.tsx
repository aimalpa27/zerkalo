import { MapPin, ExternalLink } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useT } from '../hooks/useT'

export function MapScreen() {
  const { restaurants } = useStore()
  const t = useT()
  const rests = restaurants.filter(r => r.address)

  const open2gis   = (r: any) => window.open(r.latitude && r.longitude
    ? `https://2gis.kz/almaty?m=${r.longitude},${r.latitude}/17`
    : `https://2gis.kz/search/${encodeURIComponent(r.address)}`, '_blank')

  const openYandex = (r: any) => window.open(r.latitude && r.longitude
    ? `https://yandex.kz/maps/?pt=${r.longitude},${r.latitude}&z=17`
    : `https://yandex.kz/maps/?text=${encodeURIComponent(r.address)}`, '_blank')

  const openTaxi   = (r: any) => window.open(r.latitude && r.longitude
    ? `https://3.yandex.kz/route?end-lat=${r.latitude}&end-lon=${r.longitude}&tariff=econom`
    : `https://3.yandex.kz/`, '_blank')

  return (
    <div className="px-4 pt-5 pb-24">
      <h2 className="font-bold text-lg text-soft mb-4">{t('map_title')}</h2>
      <div className="flex flex-col gap-4">
        {rests.map(r => (
          <div key={r.id} className="bg-card border border-rim/50 rounded-3xl overflow-hidden">
            <div className="h-32 bg-card2 flex items-center justify-center text-3xl font-bold text-gold/30 relative overflow-hidden">
              {r.coverImageUrl
                ? <img src={r.coverImageUrl} alt={r.name} className="w-full h-full object-cover" />
                : r.name?.slice(0,2)?.toUpperCase()
              }
            </div>
            <div className="p-4">
              <h3 className="font-bold text-soft mb-1">{r.name}</h3>
              <div className="flex items-start gap-1.5 text-mid text-xs mb-3">
                <MapPin size={11} className="mt-0.5 flex-shrink-0" />
                <span>{r.address}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => open2gis(r)} className="flex-1 py-2 rounded-xl border border-green/40 text-green text-xs font-bold flex items-center justify-center gap-1">
                  <ExternalLink size={11} /> 2ГИС
                </button>
                <button onClick={() => openYandex(r)} className="flex-1 py-2 rounded-xl border border-gold/40 text-gold text-xs font-bold flex items-center justify-center gap-1">
                  <ExternalLink size={11} /> Яндекс
                </button>
                <button onClick={() => openTaxi(r)} className="flex-1 py-2 rounded-xl border border-mid/30 text-mid text-xs font-bold flex items-center justify-center gap-1">
                  <ExternalLink size={11} /> Такси
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}