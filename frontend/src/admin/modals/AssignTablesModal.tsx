import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'

export default function AssignTablesModal() {
  const { tables, zones, staff, djangoRestId, assignStaffId, assignStaffName, closeAssign, showToast } = useAdminStore()
  const current = staff.find(s => s.id === assignStaffId)
  const [selectedZones, setSelectedZones] = useState<Set<string>>(
    new Set(current?.assignedZones ?? [])
  )
  const [selectedTables, setSelectedTables] = useState<Set<string>>(
    new Set(current?.assignedTables ?? [])
  )

  const toggleZone = (id: string) => {
    setSelectedZones(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleTable = (id: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Столы, уже покрытые выбранными зонами — отдельный выбор для них не имеет смысла
  const coveredByZones = new Set(
    tables.filter(t => t.zoneId && selectedZones.has(t.zoneId)).map(t => t.id)
  )

  // Превью: эффективный набор столов = столы зон ∪ отдельно выбранные столы
  const previewCount = new Set([...coveredByZones, ...selectedTables]).size

  const save = async () => {
    if (!assignStaffId || !djangoRestId) return
    try {
      // Гибрид: зоны целиком + отдельные столы → StaffAssignmentView (Django).
      await api.assignStaffScope(djangoRestId, assignStaffId, {
        zone_ids:  [...selectedZones],
        table_ids: [...selectedTables],
      })
      closeAssign()
      showToast('Назначение сохранено')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={closeAssign} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl max-h-[85vh] flex flex-col"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
      >
        <div className="px-5 pt-5 pb-4 flex-shrink-0">
          <p className="text-lg font-bold" style={{ color: 'var(--color-soft)' }}>
            Назначение для {assignStaffName}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-mid)' }}>
            Зоны целиком и/или отдельные столы
          </p>
        </div>

        <div className="px-5 pb-4 overflow-y-auto flex-1">
          {zones.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-dim)' }}>
                Зоны
              </p>
              <div className="flex flex-wrap gap-2 mb-5">
                {zones.map(z => {
                  const sel = selectedZones.has(z.id)
                  return (
                    <button key={z.id} onClick={() => toggleZone(z.id)}
                      className="h-9 px-3 rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5"
                      style={{
                        background: sel ? 'rgba(255,107,26,.15)' : 'var(--color-card2)',
                        border: `1.5px solid ${sel ? 'var(--color-gold)' : 'var(--color-rim)'}`,
                        color: sel ? 'var(--color-gold)' : 'var(--color-mid)',
                      }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: z.color || 'currentColor' }} />
                      {z.name}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-dim)' }}>
            Отдельные столы
          </p>
          <div className="grid grid-cols-5 gap-2 mb-2">
            {tables.map(t => {
              const sel = selectedTables.has(t.id)
              const viaZone = coveredByZones.has(t.id)
              return (
                <button key={t.id} onClick={() => !viaZone && toggleTable(t.id)}
                  disabled={viaZone}
                  title={viaZone ? 'Уже входит через выбранную зону' : undefined}
                  className="h-14 rounded-2xl font-bold text-lg transition-all active:scale-90"
                  style={{
                    background: viaZone ? 'rgba(255,107,26,.06)' : sel ? 'rgba(255,107,26,.15)' : 'var(--color-card2)',
                    border: `1.5px solid ${viaZone ? 'rgba(255,107,26,.25)' : sel ? 'var(--color-gold)' : 'var(--color-rim)'}`,
                    color: viaZone ? 'var(--color-dim)' : sel ? 'var(--color-gold)' : 'var(--color-mid)',
                    opacity: viaZone ? 0.6 : 1,
                    cursor: viaZone ? 'default' : 'pointer',
                  }}>
                  {t.number}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] mb-4" style={{ color: 'var(--color-dim)' }}>
            Затемнённые столы уже входят через выбранную зону
          </p>

          <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,107,26,.08)', border: '1px solid rgba(255,107,26,.2)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--color-gold)' }}>
              Будет обслуживать {previewCount} {previewCount === 1 ? 'стол' : 'столов'}
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--color-rim)' }}>
          <button onClick={closeAssign}
            className="flex-1 h-14 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--color-card2)', color: 'var(--color-mid)',
                     border: '1px solid var(--color-rim)' }}>
            Отмена
          </button>
          <button onClick={save}
            className="flex-[2] h-14 rounded-2xl text-sm font-bold text-black"
            style={{ background: 'var(--color-gold)' }}>
            СОХРАНИТЬ
          </button>
        </div>
      </motion.div>
    </>
  )
}
