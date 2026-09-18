/**
 * useMenu — загружает меню через Django REST API.
 * Guest/table flow uses the public QR endpoint; restaurant browsing uses public GET menu/category endpoints.
 * Keeps the last successful snapshot during transient failures and exposes explicit retry state.
 */
import { useEffect } from 'react'
import { api, mapDjangoMenuItem } from '../lib/api'
import { restoreCartDraft, useStore } from '../store/useStore'

export function useMenu(restaurantId: string | null, tableToken?: string | null) {
  const { set, addRestListener, clearRestListeners, menuReloadNonce } = useStore()

  useEffect(() => {
    if (!restaurantId && !tableToken) return
    clearRestListeners()

    let cancelled = false
    const hasSnapshot = useStore.getState().menuItems.length > 0
    set({
      menuLoadState: hasSnapshot ? 'ready' : 'loading',
      menuLoadError: null,
    })

    const load = async () => {
      try {
        if (!useStore.getState().menuItems.length) {
          set({ menuLoadState: 'loading', menuLoadError: null })
        }

        if (tableToken) {
          const info = await api.guestInfo(tableToken)
          if (cancelled) return
          const items = info.menu_items
            .filter(i => i.is_available && i.is_visible)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(mapDjangoMenuItem)
          const cats = [...info.categories].sort((a, b) => a.sort_order - b.sort_order)
          const restored = restoreCartDraft(info.restaurant.id, tableToken, items)
          set({
            menuItems: items,
            upsellRules: info.upsell_rules ?? [],
            categories: cats as any,
            ...(restored ?? {}),
            menuLoadState: 'ready',
            menuLoadError: null,
            menuLastUpdatedAt: Date.now(),
          })
        } else if (restaurantId) {
          const [items, cats] = await Promise.all([
            api.menu(restaurantId),
            api.categories(restaurantId),
          ])
          if (cancelled) return
          const filtered = items
            .filter(i => i.is_available && i.is_visible)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(mapDjangoMenuItem)
          const sortedCats = [...cats].sort((a, b) => a.sort_order - b.sort_order)
          const restored = restoreCartDraft(restaurantId, null, filtered)

          // Only prune unavailable items after a successful refresh. A network failure must never destroy cart data.
          const sourceCart = restored?.cart ?? useStore.getState().cart
          const sourceNotes = restored?.cartNotes ?? useStore.getState().cartNotes
          const newCart = { ...sourceCart }
          const newNotes = { ...sourceNotes }
          Object.keys(newCart).forEach(id => {
            if (!filtered.find(i => i.id === id)) {
              delete newCart[id]
              delete newNotes[id]
            }
          })
          set({
            menuItems: filtered,
            upsellRules: [],
            categories: sortedCats as any,
            cart: newCart,
            cartNotes: newNotes,
            menuLoadState: 'ready',
            menuLoadError: null,
            menuLastUpdatedAt: Date.now(),
          })
        }
      } catch (e: any) {
        if (cancelled) return
        console.warn('[useMenu] failed to load:', e)
        set({
          menuLoadState: 'error',
          menuLoadError: e?.data?.detail ?? e?.message ?? 'Не удалось загрузить меню',
        })
      }
    }

    load()
    const interval = setInterval(load, 60_000)

    const cleanup = () => {
      cancelled = true
      clearInterval(interval)
    }
    addRestListener(cleanup)
    return cleanup
  }, [restaurantId, tableToken, menuReloadNonce])
}
