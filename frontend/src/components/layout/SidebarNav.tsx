import { Home, Map, QrCode, Tag } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useT } from '../../hooks/useT'
import type { Screen } from '../../types'

const NAV: { screen: Screen; Icon: any; label: string }[] = [
  { screen: 'home',   Icon: Home,   label: 'Главная' },
  { screen: 'map',    Icon: Map,    label: 'Карта'   },
  { screen: 'qr',     Icon: QrCode, label: 'QR-код'  },
  { screen: 'promos', Icon: Tag,    label: 'Акции'   },
]

export function SidebarNav() {
  const { currentScreen, set } = useStore()
  const t = useT()

  const NAV: { screen: Screen; Icon: any; label: string }[] = [
    { screen: 'home',   Icon: Home,   label: t('nav_home')   },
    { screen: 'map',    Icon: Map,    label: t('nav_map')    },
    { screen: 'qr',     Icon: QrCode, label: t('nav_qr')     },
    { screen: 'promos', Icon: Tag,    label: t('nav_promos') },
  ]

  return (
    /* sidebar-nav: display:flex is set by CSS media query.
       flex-col + h-full ensure vertical layout that fills the column. */
    <aside className="sidebar-nav hidden flex-col h-full border-r border-rim bg-card">

      {/* Logo */}
      <div className="px-4 pb-8">
        <p className="font-display text-xl font-bold gold-text leading-tight">Cafe Menu</p>
        <p className="text-dim text-[11px] mt-0.5">QR-платформа</p>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map(({ screen, Icon, label }) => {
          const active = currentScreen === screen
          return (
            <button
              key={screen}
              onClick={() => set({ prevScreen: currentScreen, currentScreen: screen })}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all text-left w-full ${
                active
                  ? 'bg-gold/15 text-gold'
                  : 'text-mid hover:bg-card2 hover:text-soft'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0" />
              <span>{label}</span>
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="pt-6 border-t border-rim px-4">
        <p className="text-dim text-[11px]">© 2024 Cafe PWA</p>
      </div>
    </aside>
  )
}
