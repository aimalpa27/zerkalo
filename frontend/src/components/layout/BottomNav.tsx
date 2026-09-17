import { Home, Map, QrCode, Tag } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useT } from '../../hooks/useT'
import type { Screen } from '../../types'

export function BottomNav() {
  const { currentScreen, set } = useStore()
  const t = useT()

  const NAV: { screen: Screen; Icon: any; label: string }[] = [
    { screen: 'home',   Icon: Home,   label: t('nav_home')   },
    { screen: 'map',    Icon: Map,    label: t('nav_map')    },
    { screen: 'qr',     Icon: QrCode, label: t('nav_qr')     },
    { screen: 'promos', Icon: Tag,    label: t('nav_promos') },
  ]

  return (
    <nav
      className="bottom-nav-mobile fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 safe-bottom"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--glow-border)',
        boxShadow: '0 -4px 20px var(--glow-color)',
      }}
    >
      <div className="flex">
        {NAV.map(({ screen, Icon, label }) => {
          const active = currentScreen === screen
          return (
            <button
              key={screen}
              onClick={() => set({ prevScreen: currentScreen, currentScreen: screen })}
              className="flex-1 flex flex-col items-center py-3 gap-0.5 transition-all"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.7}
                style={{ color: active ? 'var(--color-gold)' : 'var(--color-dim)', transition: 'color 0.2s' }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? 'var(--color-gold)' : 'var(--color-dim)', transition: 'color 0.2s' }}
              >
                {label}
              </span>
              {active && (
                <div
                  className="w-4 h-0.5 rounded-full mt-0.5"
                  style={{ background: 'var(--color-gold)', boxShadow: '0 0 6px var(--color-gold)' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
