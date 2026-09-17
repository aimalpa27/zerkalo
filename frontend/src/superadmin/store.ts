import { create } from 'zustand'
import type { SubscriptionPlan, SuperAdminRestaurant } from '../lib/api'

export type SAScreen = 'auth' | 'loading' | 'list' | 'detail'
export type SATab = 'branding' | 'subscription' | 'tables' | 'staff' | 'menu' | 'iiko'

export interface SAProfile {
  id: string
  email: string
  name: string
  role: string
}

interface SAState {
  screen: SAScreen
  theme: 'dark' | 'light'
  profile: SAProfile | null

  restaurants: SuperAdminRestaurant[]
  plans: SubscriptionPlan[]
  selectedRestaurantId: string | null
  activeTab: SATab

  toastMsg: string
  toastVisible: boolean

  loadingMsg: string
  loadingErr: string
}

interface SAActions {
  setScreen: (s: SAScreen) => void
  toggleTheme: () => void
  setProfile: (p: SAProfile | null) => void

  setRestaurants: (list: SuperAdminRestaurant[]) => void
  updateRestaurantInList: (id: string, updates: Partial<SuperAdminRestaurant>) => void
  setPlans: (plans: SubscriptionPlan[]) => void
  selectRestaurant: (id: string | null) => void
  setTab: (tab: SATab) => void

  showToast: (msg: string) => void

  setLoading: (msg: string, err?: string) => void

  reset: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

const savedTheme = (localStorage.getItem('sa_theme') as 'dark' | 'light') || 'dark'

const initial: SAState = {
  screen: 'auth',
  theme: savedTheme,
  profile: null,

  restaurants: [],
  plans: [],
  selectedRestaurantId: null,
  activeTab: 'branding',

  toastMsg: '',
  toastVisible: false,

  loadingMsg: 'Загрузка...',
  loadingErr: '',
}

export const useSAStore = create<SAState & SAActions>((set, get) => ({
  ...initial,

  setScreen: (screen) => set({ screen }),

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('sa_theme', next)
    document.body.classList.toggle('theme-light', next === 'light')
    set({ theme: next })
  },

  setProfile: (profile) => set({ profile }),

  setRestaurants: (restaurants) => set({ restaurants }),

  updateRestaurantInList: (id, updates) =>
    set(s => ({
      restaurants: s.restaurants.map(r => r.id === id ? { ...r, ...updates } : r),
    })),

  setPlans: (plans) => set({ plans }),

  selectRestaurant: (selectedRestaurantId) => set({ selectedRestaurantId, activeTab: 'branding' }),

  setTab: (activeTab) => set({ activeTab }),

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toastMsg: msg, toastVisible: true })
    toastTimer = setTimeout(() => set({ toastVisible: false }), 3000)
  },

  setLoading: (loadingMsg, loadingErr = '') => set({ loadingMsg, loadingErr }),

  reset: () => {
    const { theme } = get()
    set({ ...initial, theme })
  },
}))
