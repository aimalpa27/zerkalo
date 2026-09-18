import { api } from '../../lib/api'
import { useAdminStore } from '../store'
import type { TableSession } from '../../types'

/** Позиции, ожидающие подтверждения официанта перед отправкой на кухню/в бар. */
export function pendingItems(session: TableSession) {
  return (session.items ?? []).filter(i => i.status === 'pending')
}

/** Официант подтверждает заказ — все новые позиции уходят на кухню/в бар. */
export async function confirmOrder(restId: string, session: TableSession) {
  const items = pendingItems(session)
  await Promise.allSettled(
    items.map(i => api.updateItemStatus(
      restId, session.id, i.id!,
      (i.preparationStation ?? 'kitchen') === 'bar' ? 'sent_to_bar' : 'sent_to_kitchen',
    ))
  )
  // FIX: обновляем локально сразу, не дожидаясь следующего опроса/WS
  for (const i of items) {
    const status = (i.preparationStation ?? 'kitchen') === 'bar' ? 'sent_to_bar' : 'sent_to_kitchen'
    useAdminStore.getState().updateItemsStatus(session.id, [i.id!], status)
  }
}

/** Официант убирает позицию из заказа до отправки на кухню. */
export async function removeItem(restId: string, sessionId: string, itemId: string) {
  await api.updateItemStatus(restId, sessionId, itemId, 'cancelled')
  useAdminStore.getState().updateItemsStatus(sessionId, [itemId], 'cancelled')
}
