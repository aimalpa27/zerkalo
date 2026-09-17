import { create } from 'zustand'
import type { Restaurant, MenuItem, Table, TableSession, Shift, SessionItem, ChatMessage, Zone } from '../types'

export interface UserProfile {
  id: string
  uid: string
  email: string
  name: string
  role: 'admin' | 'waiter' | 'cashier' | 'manager' | 'kitchen'
  restaurantId: string
  assignedTables: string[]
  assignedZones: string[]
  createdAt: number
}

export interface AdminWaiterCall {
  id: string
  restaurantId: string
  tableId: string
  tableNumber: number
  tableToken: string
  status: 'new' | 'accepted' | 'closed'
  reason?: string
  createdAt: number
}

export type TabId = 'sessions' | 'menu' | 'staff' | 'analytics' | 'tables' | 'calls' | 'delivery' | 'schedule' | 'chat'
export type Period = 'today' | 'week' | 'month' | 'custom'
export type AppScreen = 'mode' | 'auth' | 'loading' | 'app'
export type AdminLoadState = 'idle' | 'loading' | 'ready' | 'error'

interface ConfirmState {
  open: boolean
  message: string
  onConfirm: () => void
}

interface AlertState {
  open: boolean
  message: string
}

interface ShiftModalState {
  open: boolean
  editing: Shift | null
  defaultStaffId: string | null
  defaultDate: string | null
}

interface AdminState {
  screen: AppScreen
  mode: 'admin' | 'waiter'
  curUser: { uid?: string; email?: string } | null
  profile: UserProfile | null
  isAdmin: boolean
  theme: 'dark' | 'light'
  restId: string | null          // legacy — kept for compatibility, same as djangoRestId
  djangoRestId: string | null    // Django UUID
  rest: Restaurant | null
  sessions: TableSession[]          // только незакрытые
  allSessions: TableSession[]       // все (для аналитики)
  menuItems: MenuItem[]
  tables: Table[]
  zones: Zone[]
  staff: UserProfile[]
  calls: AdminWaiterCall[]
  operationalLoadState: AdminLoadState
  operationalLoadError: string
  operationalLastUpdatedAt: number | null
  operationalReloadNonce: number
  shifts: Shift[]
  shiftModal: ShiftModalState
  chatMessages: ChatMessage[]
  chatUnread: number
  profileOpen: boolean
  mobileMenuOpen: boolean
  activeTab: TabId
  period: Period
  customFrom: string
  customTo: string
  toastMsg: string
  toastVisible: boolean
  callBannerData: AdminWaiterCall | null
  callBannerVisible: boolean
  newOrderOpen: boolean
  addStaffOpen: boolean
  assignOpen: boolean
  assignStaffId: string | null
  assignStaffName: string
  sessionDetailId: string | null
  qrTableId: string | null
  confirm: ConfirmState
  alert: AlertState
}

interface AdminActions {
  setScreen: (s: AppScreen) => void
  setMode: (m: 'admin' | 'waiter') => void
  setAuth: (user: { uid?: string; email?: string } | null, profile: UserProfile | null) => void
  setIsAdmin: (v: boolean) => void
  toggleTheme: () => void
  setDjangoRestId: (id: string | null) => void
  setRestaurant: (restId: string, rest: Restaurant) => void
  updateRest: (updates: Partial<Restaurant>) => void
  setSessions: (all: TableSession[]) => void
  updateItemsStatus: (sessionId: string, itemIds: string[], status: SessionItem['status']) => void
  setMenuItems: (items: MenuItem[]) => void
  setTables: (tables: Table[]) => void
  setZones: (zones: Zone[]) => void
  setStaff: (staff: UserProfile[]) => void
  setCalls: (calls: AdminWaiterCall[], triggerBanner?: boolean) => void
  setOperationalLoad: (state: AdminLoadState, error?: string) => void
  markOperationalUpdated: () => void
  requestOperationalReload: () => void
  setShifts: (shifts: Shift[]) => void
  openShiftModal: (opts?: { editing?: Shift; staffId?: string; date?: string }) => void
  closeShiftModal: () => void
  setChatMessages: (messages: ChatMessage[]) => void
  markChatRead: () => void
  setProfileOpen: (v: boolean) => void
  updateProfileName: (name: string) => void
  setMobileMenuOpen: (v: boolean) => void
  setTab: (tab: TabId) => void
  setPeriod: (p: Period) => void
  setCustomRange: (from: string, to: string) => void
  showToast: (msg: string) => void
  showCallBanner: (call: AdminWaiterCall) => void
  dismissCallBanner: () => void
  setNewOrderOpen: (v: boolean) => void
  setAddStaffOpen: (v: boolean) => void
  openAssign: (id: string, name: string) => void
  closeAssign: () => void
  setSessionDetail: (id: string | null) => void
  setQrTableId: (id: string | null) => void
  showConfirm: (message: string, onConfirm: () => void) => void
  closeConfirm: () => void
  showAlert: (message: string) => void
  closeAlert: () => void
  reset: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null
let bannerTimer: ReturnType<typeof setTimeout> | null = null

/** Общая звуковая утилита админки (переиспользуется CallBanner и эскалацией «Требуют подтверждения»). */
export function playAdminAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    ;[0, 200, 400].forEach(d => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = 1100; g.gain.value = 0.28
      o.start(ctx.currentTime + d / 1000)
      o.stop(ctx.currentTime + d / 1000 + 0.13)
    })
  } catch {}
}

const savedTheme = (localStorage.getItem('admin_theme') as 'dark' | 'light') || 'dark'

// Время последнего прочтения чата (для счётчика непрочитанных) — храним
// локально по ресторану. Пуши/звук намеренно не используем, чтобы не мешать
// уведомлениям о вызовах официанта; на иконке чата только счётчик.
const chatReadKey = (restId: string | null) => `admin_chat_read_${restId ?? 'none'}`
const getChatLastRead = (restId: string | null): number =>
  Number(localStorage.getItem(chatReadKey(restId)) || 0)
const setChatLastRead = (restId: string | null, ts: number) =>
  localStorage.setItem(chatReadKey(restId), String(ts))

const initial: AdminState = {
  screen: 'mode',
  mode: 'admin',
  curUser: null,
  profile: null,
  isAdmin: false,
  theme: savedTheme,
  restId: null,
  djangoRestId: null,
  rest: null,
  sessions: [],
  allSessions: [],
  menuItems: [],
  tables: [],
  zones: [],
  staff: [],
  calls: [],
  operationalLoadState: 'idle',
  operationalLoadError: '',
  operationalLastUpdatedAt: null,
  operationalReloadNonce: 0,
  shifts: [],
  shiftModal: { open: false, editing: null, defaultStaffId: null, defaultDate: null },
  chatMessages: [],
  chatUnread: 0,
  profileOpen: false,
  mobileMenuOpen: false,
  activeTab: 'sessions',
  period: 'today',
  customFrom: '',
  customTo: '',
  toastMsg: '',
  toastVisible: false,
  callBannerData: null,
  callBannerVisible: false,
  newOrderOpen: false,
  addStaffOpen: false,
  assignOpen: false,
  assignStaffId: null,
  assignStaffName: '',
  sessionDetailId: null,
  qrTableId: null,
  confirm: { open: false, message: '', onConfirm: () => {} },
  alert: { open: false, message: '' },
}

export const useAdminStore = create<AdminState & AdminActions>((set, get) => ({
  ...initial,

  setScreen: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
  setAuth: (curUser, profile) => set({ curUser, profile }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('admin_theme', next)
    document.body.classList.toggle('theme-light', next === 'light')
    set({ theme: next })
  },

  setRestaurant: (restId, rest) => set({ restId, rest }),
  setDjangoRestId: (djangoRestId) => set({ djangoRestId }),
  updateRest: (updates) =>
    set(s => ({ rest: s.rest ? { ...s.rest, ...updates } : s.rest })),

  setSessions: (allSessions) =>
    set({ allSessions, sessions: allSessions.filter(s => s.status !== 'closed') }),

  // FIX: оптимистично обновляет статус позиций локально, не дожидаясь
  // следующего опроса/WS — без этого кнопки "Подано" и т.п. выглядят
  // нерабочими до 15 сек.
  updateItemsStatus: (sessionId, itemIds, status) => {
    const apply = (list: TableSession[]) => list.map(sess =>
      sess.id !== sessionId ? sess : {
        ...sess,
        items: (sess.items ?? []).map(it => itemIds.includes(it.id!) ? { ...it, status } : it),
      }
    )
    set(s => ({ allSessions: apply(s.allSessions), sessions: apply(s.sessions) }))
  },

  setMenuItems: (menuItems) => set({ menuItems }),
  setTables: (tables) => set({ tables }),
  setZones: (zones) => set({ zones }),
  setStaff: (staff) => set({ staff }),

  setOperationalLoad: (operationalLoadState, operationalLoadError = '') => set({ operationalLoadState, operationalLoadError }),
  markOperationalUpdated: () => set({ operationalLoadState: 'ready', operationalLoadError: '', operationalLastUpdatedAt: Date.now() }),
  requestOperationalReload: () => set(s => ({ operationalReloadNonce: s.operationalReloadNonce + 1 })),

  setCalls: (calls, triggerBanner) => {
    if (triggerBanner && calls.length > 0) {
      get().showCallBanner(calls[calls.length - 1])
    }
    set({ calls })
  },

  setShifts: (shifts) => set({ shifts }),

  openShiftModal: (opts) =>
    set({
      shiftModal: {
        open: true,
        editing: opts?.editing ?? null,
        defaultStaffId: opts?.staffId ?? null,
        defaultDate: opts?.date ?? null,
      },
    }),

  closeShiftModal: () =>
    set({ shiftModal: { open: false, editing: null, defaultStaffId: null, defaultDate: null } }),

  setChatMessages: (chatMessages) => {
    const { djangoRestId, profile, activeTab } = get()
    // Пока чат открыт — считаем всё прочитанным.
    if (activeTab === 'chat') {
      const last = chatMessages.length ? chatMessages[chatMessages.length - 1].createdAt : Date.now()
      setChatLastRead(djangoRestId, last)
      set({ chatMessages, chatUnread: 0 })
      return
    }
    const lastRead = getChatLastRead(djangoRestId)
    const unread = chatMessages.filter(
      m => m.createdAt > lastRead && m.senderId !== profile?.id,
    ).length
    set({ chatMessages, chatUnread: unread })
  },

  markChatRead: () => {
    const { djangoRestId, chatMessages } = get()
    const last = chatMessages.length ? chatMessages[chatMessages.length - 1].createdAt : Date.now()
    setChatLastRead(djangoRestId, Math.max(last, Date.now()))
    set({ chatUnread: 0 })
  },

  setProfileOpen: (profileOpen) => set({ profileOpen }),
  updateProfileName: (name) =>
    set(s => ({ profile: s.profile ? { ...s.profile, name } : s.profile })),

  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),

  setTab: (activeTab) => {
    if (activeTab === 'chat') get().markChatRead()
    set({ activeTab, mobileMenuOpen: false })
  },
  setPeriod: (period) => set({ period }),
  setCustomRange: (customFrom, customTo) => set({ customFrom, customTo }),

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toastMsg: msg, toastVisible: true })
    toastTimer = setTimeout(() => set({ toastVisible: false }), 3000)
  },

  showCallBanner: (call) => {
    if (bannerTimer) clearTimeout(bannerTimer)
    set({ callBannerData: call, callBannerVisible: true })
    playAdminAlertSound()
    bannerTimer = setTimeout(() => set({ callBannerVisible: false }), 6000)
  },

  dismissCallBanner: () => {
    if (bannerTimer) clearTimeout(bannerTimer)
    set({ callBannerVisible: false })
  },

  setNewOrderOpen: (newOrderOpen) => set({ newOrderOpen }),
  setAddStaffOpen: (addStaffOpen) => set({ addStaffOpen }),
  openAssign: (assignStaffId, assignStaffName) =>
    set({ assignOpen: true, assignStaffId, assignStaffName }),
  closeAssign: () =>
    set({ assignOpen: false, assignStaffId: null, assignStaffName: '' }),
  setSessionDetail: (sessionDetailId) => set({ sessionDetailId }),
  setQrTableId: (qrTableId) => set({ qrTableId }),

  showConfirm: (message, onConfirm) =>
    set({ confirm: { open: true, message, onConfirm } }),
  closeConfirm: () =>
    set({ confirm: { open: false, message: '', onConfirm: () => {} } }),

  showAlert: (message) => set({ alert: { open: true, message } }),
  closeAlert: () => set({ alert: { open: false, message: '' } }),

  reset: () => {
    const { theme, mode } = get()
    set({ ...initial, theme, mode })
  },
}))