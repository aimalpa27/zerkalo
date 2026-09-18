import type { Table } from '../../types'
import type { UserProfile } from '../store'

/**
 * Гибридное назначение официанта: зоны целиком + отдельные столы.
 * Официант «ограничен» видимостью, если ему назначена хотя бы одна зона
 * ИЛИ хотя бы один отдельный стол. Если обе назначения пусты — официант
 * НЕ ограничен и видит всё (текущее/legacy поведение).
 */
export function isRestricted(profile: UserProfile | null | undefined): boolean {
  return (profile?.assignedZones?.length ?? 0) > 0 || (profile?.assignedTables?.length ?? 0) > 0
}

/**
 * Эффективный набор id столов официанта = столы назначенных зон ∪ отдельно назначенные столы.
 * Вызывать только когда isRestricted(profile) истинно — иначе семантика «видит всё»
 * реализуется на уровне вызывающего кода (effectiveTableIds для неограниченного
 * профиля вернёт пустое множество, а НЕ «все столы»).
 */
export function effectiveTableIds(profile: UserProfile | null | undefined, tables: Table[]): Set<string> {
  const ids = new Set<string>()
  if (!profile) return ids

  const zoneIds = new Set(profile.assignedZones ?? [])
  tables.forEach(t => {
    if (t.zoneId && zoneIds.has(t.zoneId)) ids.add(t.id)
  })
  ;(profile.assignedTables ?? []).forEach(id => ids.add(id))

  return ids
}
