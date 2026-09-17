/**
 * useRestaurants — загружает список ресторанов через Django REST API.
 * Данные через Django REST API.
 */
import { useEffect } from 'react'
import { api, mapDjangoRestaurant } from '../lib/api'
import { useStore } from '../store/useStore'

export function useRestaurants() {
  const { set } = useStore()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const restaurants = await api.restaurants()
        if (!cancelled) {
          set({ restaurants: restaurants.map(mapDjangoRestaurant) })
        }
      } catch (e) {
        console.warn('[useRestaurants] failed:', e)
      }
    }

    load()
    // Обновляем каждые 2 минуты
    const interval = setInterval(load, 120_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])
}
