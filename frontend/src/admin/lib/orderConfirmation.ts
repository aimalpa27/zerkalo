import type { Restaurant, SessionItem, TableSession } from '../../types'
import { isAwaiting, normalizeStatus } from '../../lib/itemStatus'

export const DEFAULT_REMINDER_AFTER_SEC = 60
export const DEFAULT_ESCALATE_AFTER_SEC = 180

export type EscalationLevel = 'none' | 'reminder' | 'escalate'

/** Позиции сессии, ожидающие подтверждения официантом (normalized). */
export function awaitingItems(session: TableSession): SessionItem[] {
  return (session.items ?? []).filter(i => isAwaiting(normalizeStatus(i.status)))
}

/** Возраст (в секундах) самой старой awaiting-позиции сессии, или null если таких нет. */
export function oldestAwaitingAgeSec(session: TableSession): number | null {
  const items = awaitingItems(session)
  if (!items.length) return null
  const oldest = Math.min(...items.map(i => i.createdAt ?? Date.now()))
  return Math.floor((Date.now() - oldest) / 1000)
}

/**
 * Уровень эскалации сессии по таймерам из rest.orderConfirmation
 * (reminderAfterSec, default 60 / escalateAfterSec, default 180), от item.createdAt.
 */
export function escalationLevel(session: TableSession, rest: Restaurant | null): EscalationLevel {
  const age = oldestAwaitingAgeSec(session)
  if (age == null) return 'none'
  const reminderSec = rest?.orderConfirmation?.reminderAfterSec ?? DEFAULT_REMINDER_AFTER_SEC
  const escalateSec = rest?.orderConfirmation?.escalateAfterSec ?? DEFAULT_ESCALATE_AFTER_SEC
  if (age >= escalateSec) return 'escalate'
  if (age >= reminderSec) return 'reminder'
  return 'none'
}
