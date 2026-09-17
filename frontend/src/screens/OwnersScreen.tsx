import { ArrowLeft, QrCode, BarChart3, Utensils, Bell, Zap, Globe, Shield, CheckCircle, ChevronRight, Smartphone } from 'lucide-react'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { ownersContent, OWNERS_CONTACTS } from '../i18n/ownersContent'

// Иконки фич — порядок соответствует ownersContent.features
const FEATURE_ICONS = [QrCode, Bell, Utensils, BarChart3, Globe, Smartphone]

const PLAN_STYLE = [
  { color: 'var(--color-mid)',   highlight: false },
  { color: 'var(--color-gold)',  highlight: true },
  { color: 'var(--color-green)', highlight: false },
]

export function OwnersScreen() {
  const { set, prevScreen, lang } = useStore()
  const c = ownersContent(lang)

  const back = () => set({ currentScreen: prevScreen ?? 'home' })

  return (
    <div className="pb-24 md:pb-10">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button onClick={back} className="w-9 h-9 rounded-full bg-card border border-rim flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={16} className="text-soft" />
        </button>
        <h1 className="font-bold text-soft">{c.page_title}</h1>
      </div>

      {/* Hero */}
      <div className="mx-4 mb-6 rounded-3xl overflow-hidden relative card-glow" style={{ background: 'var(--color-card)', minHeight: 220 }}>
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ background: 'var(--glow-color)' }} />
        <div className="absolute -left-8 -bottom-8 w-36 h-36 rounded-full blur-3xl pointer-events-none" style={{ background: 'var(--glow-color)', opacity: 0.5 }} />
        <div className="relative z-10 p-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-4"
              style={{ background: 'var(--glow-color)', color: 'var(--color-gold)', border: '1px solid var(--glow-border)' }}>
              <Zap size={10} /> {c.hero_badge}
            </div>
            <h2 className="font-display text-2xl font-bold leading-tight mb-3" style={{ color: 'var(--color-soft)' }}>
              {c.hero_title1}<br />
              <span className="gold-text">{c.hero_title2}</span>
            </h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--color-mid)' }}>
              {c.hero_desc}
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={`mailto:${OWNERS_CONTACTS.email}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs shadow-gold"
                style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold2))', color: '#1A0F08' }}
              >
                {c.cta_apply} <ChevronRight size={13} />
              </a>
              <a href={OWNERS_CONTACTS.whatsapp} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs border"
                style={{ borderColor: 'var(--glow-border)', color: 'var(--color-gold)' }}
              >
                {OWNERS_CONTACTS.whatsappLabel}
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 px-4 mb-6">
        {c.stats.map(s => (
          <div key={s.val} className="card-glow rounded-2xl p-3 text-center" style={{ background: 'var(--color-card)' }}>
            <p className="font-bold text-sm" style={{ color: 'var(--color-gold)' }}>{s.val}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-mid)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="px-4 mb-8">
        <p className="text-[10px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--color-gold)' }}>
          {c.features_title}
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {c.features.map(({ title, desc }, i) => {
            const Icon = FEATURE_ICONS[i] ?? QrCode
            return (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="card-glow rounded-2xl p-4 flex gap-3"
                style={{ background: 'var(--color-card)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--glow-color)' }}>
                  <Icon size={17} style={{ color: 'var(--color-gold)' }} />
                </div>
                <div>
                  <p className="text-sm font-bold mb-1" style={{ color: 'var(--color-soft)' }}>{title}</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-mid)' }}>{desc}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* How it works */}
      <div className="px-4 mb-8">
        <p className="text-[10px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--color-gold)' }}>
          {c.how_title}
        </p>
        <div className="flex flex-col gap-3">
          {c.steps.map(({ title, desc }, i) => (
            <div key={title} className="flex gap-4 items-start card-glow rounded-2xl p-4"
              style={{ background: 'var(--color-card)' }}>
              <div className="text-2xl font-bold font-display flex-shrink-0 leading-none" style={{ color: 'var(--color-gold)', opacity: 0.35 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--color-soft)' }}>{title}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-mid)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="px-4 mb-8">
        <p className="text-[10px] font-bold tracking-[2px] uppercase mb-4" style={{ color: 'var(--color-gold)' }}>
          {c.pricing_title}
        </p>
        <div className="flex flex-col gap-3">
          {c.plans.map(({ name, price, period, features }, i) => {
            const { color, highlight } = PLAN_STYLE[i] ?? PLAN_STYLE[0]
            return (
              <div key={name}
                className="rounded-2xl p-5"
                style={{
                  background: 'var(--color-card)',
                  border: `1px solid ${highlight ? color : 'var(--color-rim)'}`,
                  boxShadow: highlight ? `0 0 20px var(--glow-color)` : 'none',
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--color-soft)' }}>{name}</p>
                    {highlight && (
                      <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--glow-color)', color }}>
                        {c.popular_badge}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg" style={{ color }}>{price}</p>
                    {period && <p className="text-[10px]" style={{ color: 'var(--color-dim)' }}>{period}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {features.map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <CheckCircle size={12} style={{ color, flexShrink: 0 }} />
                      <span className="text-[12px]" style={{ color: 'var(--color-mid)' }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="mx-4 mb-4 card-glow rounded-3xl p-6 text-center" style={{ background: 'var(--color-card)' }}>
        <Shield size={28} style={{ color: 'var(--color-gold)', margin: '0 auto 12px' }} />
        <h3 className="font-display text-lg font-bold mb-2" style={{ color: 'var(--color-soft)' }}>
          {c.cta_title}
        </h3>
        <p className="text-xs mb-5 leading-relaxed" style={{ color: 'var(--color-mid)' }}>
          {c.cta_desc}
        </p>
        <a href={OWNERS_CONTACTS.whatsapp} target="_blank" rel="noreferrer"
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm shadow-gold"
          style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold2))', color: '#1A0F08' }}
        >
          {c.cta_apply}
        </a>
        <p className="text-[10px] mt-3" style={{ color: 'var(--color-dim)' }}>
          {OWNERS_CONTACTS.email} · {OWNERS_CONTACTS.phone}
        </p>
      </div>

    </div>
  )
}
