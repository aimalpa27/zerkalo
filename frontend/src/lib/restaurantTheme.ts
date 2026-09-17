/**
 * Per-restaurant color themes.
 * Key = restaurant slug (or any substring of slug / name).
 * Overrides CSS variables on :root while guest is seated at that restaurant.
 */

interface RestTheme {
  primary: string    // replaces --color-gold
  primary2?: string  // replaces --color-gold2 (faded variant)
  glow?: string      // replaces --glow-color
  glowBorder?: string// replaces --glow-border
  forceBg?: string   // optional: force --color-bg (e.g. light)
}

const THEMES: Record<string, RestTheme> = {
  'alpa-cafe': {
    primary:     '#4CAF82',
    primary2:    '#3d9a70',
    glow:        'rgba(76,175,130,0.22)',
    glowBorder:  'rgba(76,175,130,0.35)',
  },
  'ailish-cafe': {
    primary:     '#E8474A',
    primary2:    '#c93a3d',
    glow:        'rgba(232,71,74,0.22)',
    glowBorder:  'rgba(232,71,74,0.35)',
  },
  'zhazira': {
    primary:     '#D4A853',
    primary2:    '#b8923f',
    glow:        'rgba(212,168,83,0.22)',
    glowBorder:  'rgba(212,168,83,0.35)',
  },
}

/** Find theme by slug/name (case-insensitive substring match) */
function findTheme(slug?: string | null, name?: string | null): RestTheme | null {
  if (!slug && !name) return null
  const key = (slug ?? name ?? '').toLowerCase()
  for (const [pattern, theme] of Object.entries(THEMES)) {
    if (key.includes(pattern)) return theme
  }
  return null
}

/** Apply per-restaurant CSS overrides to :root */
export function applyRestaurantTheme(slug?: string | null, name?: string | null) {
  const theme = findTheme(slug, name)
  if (!theme) {
    resetRestaurantTheme()
    return
  }
  const root = document.documentElement
  root.style.setProperty('--color-gold',  theme.primary)
  root.style.setProperty('--color-gold2', theme.primary2 ?? theme.primary)
  if (theme.glow)       root.style.setProperty('--glow-color',  theme.glow)
  if (theme.glowBorder) root.style.setProperty('--glow-border', theme.glowBorder)
}

/** Remove per-restaurant overrides, restoring theme defaults */
export function resetRestaurantTheme() {
  const root = document.documentElement
  root.style.removeProperty('--color-gold')
  root.style.removeProperty('--color-gold2')
  root.style.removeProperty('--glow-color')
  root.style.removeProperty('--glow-border')
}
