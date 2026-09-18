import type { SessionItem } from '../types'

/**
 * Единая точка семантики статусов позиции заказа — используется гостем,
 * кухней и админкой/официантом одинаково. Лейблы статусов сюда НЕ переносим:
 * у каждого приложения свой механизм отображения (гость — i18n useT,
 * админка/кухня — локальные карты рядом с их UI).
 */

/** Целевые (canonical) значения статусной модели. */
export type NormalizedItemStatus =
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'ready'
  | 'served'
  | 'rejected'
  | 'cancelled'

// Legacy-значения → целевая модель (переходный период).
const LEGACY_TO_NORMALIZED: Record<string, NormalizedItemStatus> = {
  pending: 'confirmed',
  delivered: 'served',
  waiter_confirmed: 'confirmed',
  sent_to_kitchen: 'confirmed',
  sent_to_bar: 'confirmed',
}

/**
 * Приводит (возможно legacy) статус позиции к целевой модели.
 * Неизвестное значение возвращается как есть — эта функция никогда не бросает исключение.
 */
export function normalizeStatus(raw: SessionItem['status'] | string | null | undefined): string {
  if (!raw) return raw ?? ''
  return LEGACY_TO_NORMALIZED[raw] ?? raw
}

// ── Предикаты — принимают УЖЕ normalized статус (см. normalizeStatus выше) ──

/** Позиция видна на кухонной доске. */
export function isKitchenVisible(status: string): boolean {
  return status === 'confirmed'
}

/** Позиция входит в счёт (subtotal/serviceCharge/total). */
export function isBillable(status: string): boolean {
  return status === 'confirmed' || status === 'ready' || status === 'served'
}

/** Позиция готова к подаче официантом. */
export function isServeable(status: string): boolean {
  return status === 'ready'
}

/** Позиция ожидает подтверждения официантом. */
export function isAwaiting(status: string): boolean {
  return status === 'awaiting_confirmation'
}

/**
 * Пересчитывает subtotal/serviceCharge/total сессии по массиву позиций.
 * Формула — как в placeOrder/NewOrderModal: сумма price*quantity по billable-позициям,
 * serviceCharge = floor(subtotal * pct / 100). Цена в SessionItem.price уже финальная
 * (скидка применена в момент добавления позиции), пересчитывать скидку здесь не нужно.
 */
export function recalcTotals(items: SessionItem[], serviceChargePercent: number) {
  const subtotalAmount = (items ?? []).reduce((sum, item) => {
    if (!isBillable(normalizeStatus(item.status))) return sum
    return sum + item.price * item.quantity
  }, 0)
  const serviceChargeAmount = Math.floor(subtotalAmount * serviceChargePercent / 100)
  const totalAmount = subtotalAmount + serviceChargeAmount
  return { subtotalAmount, serviceChargeAmount, totalAmount }
}
