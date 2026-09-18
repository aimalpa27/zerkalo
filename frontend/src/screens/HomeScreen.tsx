import { useState } from 'react'
import { Search, QrCode, ChevronRight, Utensils, Clock, Shield, Star, Sun, Moon, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import { useT } from '../hooks/useT'
import { RestaurantCard } from '../components/home/RestaurantCard'
import { Spinner } from '../components/ui/Spinner'
import { LANGS } from '../i18n/translations'
import type { Lang } from '../types'

const HERO_IMAGE = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80'

export function HomeScreen() {
  const { restaurants, promos, set, theme, lang } = useStore()
  const t = useT()
  const [query, setQuery]       = useState('')
  const [langOpen, setLangOpen] = useState(false)

  const filtered = restaurants.filter(r =>
    !query ||
    r.name?.toLowerCase().includes(query.toLowerCase()) ||
    r.address?.toLowerCase().includes(query.toLowerCase())
  )

  const openRestaurant = (id: string) => {
    const rest = restaurants.find(r => r.id === id)
    if (!rest) return
    set({ currentRestaurant: rest, prevScreen: 'home', currentScreen: 'restaurant', cart: {}, categories: [], menuItems: [], selectedCat: null })
  }

  const toggleTheme = () => set({ theme: theme === 'dark' ? 'light' : 'dark' })
  const pickLang = (code: Lang) => {
    localStorage.setItem('cafe_lang', code)
    set({ lang: code })
    setLangOpen(false)
  }

  return (
    <div className="pb-24 md:pb-10">

      {/* ── TOP BAR — over hero, outside overflow-hidden ── */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-start px-4 pt-8 z-[999] pointer-events-none">

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={{ pointerEvents: 'all' }}
          className="w-12 h-12 rounded-2xl glass border border-white/20 flex items-center justify-center shadow-deep"
        >
          {theme === 'dark'
            ? <Sun  size={22} className="text-gold" />
            : <Moon size={22} className="text-gold" />
          }
        </button>

        {/* Lang button + dropdown */}
        <div className="relative" style={{ pointerEvents: 'all' }}>
          <button
            onClick={() => setLangOpen(v => !v)}
            className="w-12 h-12 glass border border-white/20 rounded-2xl flex items-center justify-center shadow-deep"
          >
            <Globe size={22} className="text-gold" />
          </button>

          <AnimatePresence>
            {langOpen && (
              <>
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={() => setLangOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-14 w-48 rounded-2xl overflow-hidden z-[9999]"
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--glow-border)',
                    boxShadow: '0 0 20px var(--glow-color), 0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  {LANGS.map(l => (
                    <button
                      key={l.code}
                      onClick={() => pickLang(l.code)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={{
                        background: l.code === lang ? 'var(--glow-color)' : 'transparent',
                        color: l.code === lang ? 'var(--color-gold)' : 'var(--color-soft)',
                      }}
                    >
                      <span className="text-xl">{l.flag}</span>
                      <span className="text-sm font-semibold">{l.name}</span>
                      {l.code === lang && (
                        <span className="ml-auto w-2 h-2 rounded-full" style={{ background: 'var(--color-gold)' }} />
                      )}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── HERO ── */}
      <div className="relative h-[340px] md:h-[420px] overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt="restaurant"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.6) 55%, var(--color-bg) 100%)',
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-7 z-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-[10px] font-bold tracking-[3px] uppercase mb-2" style={{ color: 'var(--color-gold)' }}>
              {t('hero_welcome')}
            </p>
            <h1 className="font-display text-3xl font-bold text-white leading-tight mb-4 drop-shadow-lg">
              {t('hero_title1')}<br />
              <span className="gold-text">{t('hero_title2')}</span>
            </h1>
            <button
              onClick={() => set({ prevScreen: 'home', currentScreen: 'qr' })}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm shadow-gold"
              style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold2))', color: '#1A0F08' }}
            >
              <QrCode size={16} />
              {t('hero_cta')}
            </button>
          </motion.div>
        </div>
      </div>

      {/* ── SEARCH ── */}
      <div className="px-4 pt-4 pb-2 relative z-10">
        <div
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--glow-border)',
            boxShadow: '0 0 12px var(--glow-color)',
          }}
        >
          <Search size={17} style={{ color: 'var(--color-gold)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="bg-transparent border-none outline-none text-sm w-full"
            style={{ color: 'var(--color-soft)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: 'var(--color-dim)', fontSize: 12 }}>✕</button>
          )}
        </div>
      </div>

      {/* ── КАК ЭТО РАБОТАЕТ ── */}
      {!query && (
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] font-bold tracking-[2px] uppercase mb-3" style={{ color: 'var(--color-gold)' }}>
            {t('how_it_works_title')}
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: QrCode,   step: '01', titleKey: 'step1_title' as const, descKey: 'step1_desc' as const },
              { icon: Utensils, step: '02', titleKey: 'step2_title' as const, descKey: 'step2_desc' as const },
              { icon: Clock,    step: '03', titleKey: 'step3_title' as const, descKey: 'step3_desc' as const },
            ].map(({ icon: Icon, step, titleKey, descKey }) => (
              <motion.div
                key={step}
                whileTap={{ scale: 0.95 }}
                className="rounded-2xl p-3 flex flex-col gap-2 card-glow"
                style={{ background: 'var(--color-card)' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--glow-color)' }}
                >
                  <Icon size={17} style={{ color: 'var(--color-gold)' }} />
                </div>
                <div>
                  <p className="text-[9px] font-mono mb-0.5" style={{ color: 'var(--color-dim)' }}>{step}</p>
                  <p className="text-[11px] font-bold" style={{ color: 'var(--color-soft)' }}>{t(titleKey)}</p>
                  <p className="text-[10px] leading-tight" style={{ color: 'var(--color-mid)' }}>{t(descKey)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── АКЦИИ ── */}
      {!query && promos.length > 0 && (
        <div className="pt-5 pb-2">
          <div className="flex justify-between items-center px-4 mb-3">
            <p className="font-bold text-sm" style={{ color: 'var(--color-soft)' }}>{t('promos_section')}</p>
            <button
              onClick={() => set({ currentScreen: 'promos' })}
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: 'var(--color-gold)' }}
            >
              {t('view_all')} <ChevronRight size={13} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-1">
            {promos.slice(0, 5).map(p => (
              <div
                key={p.id}
                className="flex-shrink-0 w-52 rounded-2xl p-3.5 card-glow"
                style={{ background: 'var(--color-card)' }}
              >
                <p className="text-[9px] uppercase tracking-widest mb-1 font-bold" style={{ color: 'var(--color-gold)' }}>
                  {p.restaurantName}
                </p>
                <p className="text-sm font-bold line-clamp-2 mb-1" style={{ color: 'var(--color-soft)' }}>{p.title}</p>
                {p.validUntil && <p className="text-[10px]" style={{ color: 'var(--color-dim)' }}>До {p.validUntil}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── РЕСТОРАНЫ ── */}
      <div className="px-4 pt-5">
        <div className="flex justify-between items-center mb-4">
          <p className="font-bold text-sm" style={{ color: 'var(--color-soft)' }}>
            {query ? `${filtered.length}` : t('restaurants_title')}
          </p>
          {!query && (
            <div className="flex items-center gap-1 text-xs">
              <Star size={11} style={{ color: 'var(--color-gold)', fill: 'var(--color-gold)' }} />
              <span className="font-bold" style={{ color: 'var(--color-gold)' }}>4.9</span>
              <span style={{ color: 'var(--color-mid)' }}>· 12+</span>
            </div>
          )}
        </div>

        {!restaurants.length
          ? <Spinner />
          : filtered.length === 0
            ? <p className="text-center py-12 text-sm" style={{ color: 'var(--color-dim)' }}>{t('empty_search')}</p>
            : (
              <div className="restaurant-grid flex flex-col gap-4">
                {filtered.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <RestaurantCard restaurant={r} onClick={() => openRestaurant(r.id)} />
                  </motion.div>
                ))}
              </div>
            )
        }
      </div>

      {/* ── ДЛЯ БИЗНЕСА ── */}
      {!query && (
        <div
          className="mx-4 mt-8 mb-4 relative overflow-hidden rounded-3xl p-5 card-glow"
          style={{ background: 'var(--color-card)' }}
        >
          <div
            className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl pointer-events-none"
            style={{ background: 'var(--glow-color)' }}
          />
          <Shield size={26} style={{ color: 'var(--color-gold)' }} className="mb-3" />
          <h3 className="font-display text-lg font-bold mb-1" style={{ color: 'var(--color-soft)' }}>
            {t('for_owners_title')}
          </h3>
          <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--color-mid)' }}>
            {t('for_owners_desc')}
          </p>
          <button
            onClick={() => set({ prevScreen: 'home', currentScreen: 'owners' })}
            className="flex items-center gap-1.5 text-xs font-bold"
            style={{ color: 'var(--color-gold)' }}
          >
            {t('for_owners_cta')} <ChevronRight size={13} />
          </button>
        </div>
      )}

    </div>
  )
}
