import React, { useEffect, useCallback } from 'react'
import { useKitchenStore } from '../store'
import KitchenHeader from '../components/KitchenHeader'
import OrderCard from '../components/OrderCard'
import { normalizeStatus, isKitchenVisible, isServeable } from '../../lib/itemStatus'
import type { TableSession, SessionItem } from '../../types'

type Col = 'pending' | 'ready'

interface OrderGroup {
  session: TableSession
  items: SessionItem[]
}

// Строгий whitelist: только confirmed идёт в «Заказы», только ready — в «Готово».
// awaiting_confirmation/rejected (и всё прочее) никогда не попадают на доску.
function filterItems(session: TableSession, station: string): { pending: SessionItem[]; ready: SessionItem[] } {
  const stationFiltered = (session.items ?? []).filter((item) => {
    const st = item.preparationStation ?? 'kitchen'
    if (station === 'kitchen' && st !== 'kitchen') return false
    if (station === 'bar'     && st !== 'bar')     return false
    return true
  })
  return {
    pending: stationFiltered.filter(i => isKitchenVisible(normalizeStatus(i.status))),
    ready:   stationFiltered.filter(i => isServeable(normalizeStatus(i.status))),
  }
}

function EmptyCol({ label }: { label: string }) {
  return (
    <div className="board-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.5" opacity="0.25">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span>{label}</span>
    </div>
  )
}

export default function KitchenBoardScreen() {
  const { sessions, station, focusedIdx, setFocusedIdx, loadState, loadError, lastUpdatedAt } = useKitchenStore()

  // Собираем плоский список карточек для клавиатурной навигации
  const pendingGroups: OrderGroup[] = []
  const readyGroups:   OrderGroup[] = []

  sessions.forEach((s) => {
    const { pending, ready } = filterItems(s, station)
    if (pending.length) pendingGroups.push({ session: s, items: pending })
    if (ready.length)   readyGroups.push({ session: s, items: ready })
  })

  const allCards: { col: Col; session: TableSession; items: SessionItem[] }[] = [
    ...pendingGroups.map(g => ({ col: 'pending' as Col, ...g })),
    ...readyGroups.map(g =>   ({ col: 'ready'   as Col, ...g })),
  ]

  // Клавиатурная навигация
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!allCards.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      setFocusedIdx(Math.min(focusedIdx + 1, allCards.length - 1))
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setFocusedIdx(Math.max(focusedIdx - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const card = allCards[focusedIdx]
      if (card?.col === 'pending') {
        document.getElementById(`order-${card.session.id}-action`)?.click()
      }
    } else if (e.key === 'Backspace') {
      const card = allCards[focusedIdx]
      if (card?.col === 'ready') {
        document.getElementById(`order-${card.session.id}-action`)?.click()
      }
    }
  }, [allCards, focusedIdx, setFocusedIdx])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div className="kitchen-board-wrap">
      {loadState === 'error' && (
        <div className="kitchen-sync-error" role="alert">
          <div>
            <strong>Связь с сервером потеряна</strong>
            <span>{loadError}</span>
            {lastUpdatedAt && <small>Последнее обновление: {new Date(lastUpdatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</small>}
          </div>
          <button type="button" onClick={() => window.location.reload()}>Повторить</button>
        </div>
      )}

      <KitchenHeader
        onlineCount={pendingGroups.length}
        readyCount={readyGroups.length}
      />

      <div className="kitchen-board">
        {/* Столбец «Заказы» */}
        <div className="board-col">
          <div className="board-col__header">
            <div className="board-col__dot" style={{ background: 'var(--color-gold)' }} />
            <span className="board-col__title">Заказы</span>
            <span className="board-col__count">{pendingGroups.length}</span>
          </div>
          {pendingGroups.length === 0
            ? <EmptyCol label={loadState === 'error' && sessions.length === 0 ? 'Заказы не загружены' : 'Нет новых заказов'} />
            : pendingGroups.map((g, i) => (
                <OrderCard
                  key={g.session.id}
                  session={g.session}
                  col="pending"
                  items={g.items}
                  focused={focusedIdx === i}
                />
              ))
          }
        </div>

        {/* Столбец «Готово» */}
        <div className="board-col">
          <div className="board-col__header">
            <div className="board-col__dot" style={{ background: 'var(--color-green)' }} />
            <span className="board-col__title">Готово</span>
            <span className="board-col__count">{readyGroups.length}</span>
          </div>
          {readyGroups.length === 0
            ? <EmptyCol label={loadState === 'error' && sessions.length === 0 ? 'Данные недоступны' : 'Нет готовых блюд'} />
            : readyGroups.map((g, i) => (
                <OrderCard
                  key={g.session.id}
                  session={g.session}
                  col="ready"
                  items={g.items}
                  focused={focusedIdx === pendingGroups.length + i}
                />
              ))
          }
        </div>
      </div>

      {/* Подсказка */}
      <div className="kitchen-kbd-hint">
        ↑↓ выбрать · Enter — готово · Backspace — вернуть
      </div>
    </div>
  )
}
