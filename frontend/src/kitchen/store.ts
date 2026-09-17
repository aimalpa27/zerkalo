import { create } from 'zustand'
import type { TableSession, SessionItem } from '../types'

export type Station = 'kitchen' | 'bar' | 'all'
export type KitchenScreen = 'login' | 'loading' | 'board'
export type KitchenLoadState = 'idle' | 'loading' | 'ready' | 'error'

interface KitchenState {
  screen: KitchenScreen
  restId: string | null
  restName: string
  station: Station
  sessions: TableSession[]
  focusedIdx: number
  loadState: KitchenLoadState
  loadError: string
  lastUpdatedAt: number | null

  setScreen:     (s: KitchenScreen) => void
  setRest:       (id: string, name: string) => void
  setStation:    (s: Station) => void
  setSessions:   (s: TableSession[]) => void
  updateItemsStatus: (sessionId: string, itemIds: string[], status: SessionItem['status']) => void
  setFocusedIdx: (i: number) => void
  setLoadState: (state: KitchenLoadState, error?: string) => void
  setLastUpdatedAt: (ts: number | null) => void
  reset:         () => void
}

export const useKitchenStore = create<KitchenState>((set) => ({
  screen:     'login',
  restId:     null,
  restName:   '',
  station:    'kitchen',
  sessions:   [],
  focusedIdx: 0,
  loadState: 'idle',
  loadError: '',
  lastUpdatedAt: null,

  setScreen:     (screen)   => set({ screen }),
  setRest:       (id, name) => set({ restId: id, restName: name }),
  setStation:    (station)  => set({ station }),
  setSessions:   (sessions) => set({ sessions }),

  // FIX: оптимистично обновляет статус позиций локально — без этого кнопка
  // "Готово" не меняет вид карточки до следующего опроса (8 сек), и сотрудник
  // жмёт повторно, что приводит к ошибкам недопустимого перехода статуса.
  updateItemsStatus: (sessionId, itemIds, status) =>
    set(s => ({
      sessions: s.sessions.map(sess =>
        sess.id !== sessionId ? sess : {
          ...sess,
          items: (sess.items ?? []).map(it => itemIds.includes(it.id!) ? { ...it, status } : it),
        }
      ),
    })),
  setFocusedIdx: (i)        => set({ focusedIdx: i }),
  setLoadState: (loadState, loadError = '') => set({ loadState, loadError }),
  setLastUpdatedAt: (lastUpdatedAt) => set({ lastUpdatedAt }),
  reset: () => set({
    screen: 'login', restId: null,
    restName: '', sessions: [], focusedIdx: 0,
    loadState: 'idle', loadError: '', lastUpdatedAt: null,
  }),
}))
