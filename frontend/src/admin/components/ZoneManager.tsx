import React, { useState } from 'react'
import { api, mapDjangoZone } from '../../lib/api'
import { useAdminStore } from '../store'
import type { Zone } from '../../types'

const bySortOrder = (a: Zone, b: Zone) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)

const ZONE_COLORS = [
  '#FF6B1A', '#4CAF50', '#3B82F6', '#A855F7',
  '#F59E0B', '#EC4899', '#14B8A6', '#EF4444',
]

export default function ZoneManager() {
  const { djangoRestId, zones, tables, showToast, showConfirm } = useAdminStore()

  const [name, setName]   = useState('')
  const [color, setColor] = useState(ZONE_COLORS[0])
  const [order, setOrder] = useState(String(zones.length))
  const [saving, setSaving] = useState(false)

  const [editId, setEditId]       = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [editColor, setEditColor] = useState(ZONE_COLORS[0])
  const [editOrder, setEditOrder] = useState('0')

  const nameTaken = (val: string, ignoreId?: string) =>
    zones.some(z => z.id !== ignoreId && z.name.trim().toLowerCase() === val.trim().toLowerCase())

  const create = async () => {
    const trimmed = name.trim()
    if (!djangoRestId || !trimmed) return
    if (nameTaken(trimmed)) { showToast('Зона с таким именем уже есть'); return }
    setSaving(true)
    try {
      const z = await api.createZone(djangoRestId, {
        name: trimmed,
        color,
        sort_order: parseInt(order, 10) || 0,
      })
      useAdminStore.getState().setZones([...zones, mapDjangoZone(z)].sort(bySortOrder))
      setName(''); setColor(ZONE_COLORS[0]); setOrder(String(zones.length + 1))
      showToast('Зона создана ✓')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.data?.detail ?? e?.message ?? 'попробуйте ещё раз'))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (z: Zone) => {
    setEditId(z.id)
    setEditName(z.name)
    setEditColor(z.color ?? ZONE_COLORS[0])
    setEditOrder(String(z.sortOrder ?? 0))
  }

  const saveEdit = async () => {
    if (!djangoRestId || !editId) return
    const trimmed = editName.trim()
    if (!trimmed) return
    if (nameTaken(trimmed, editId)) { showToast('Зона с таким именем уже есть'); return }
    setSaving(true)
    try {
      const z = await api.updateZone(djangoRestId, editId, {
        name: trimmed,
        color: editColor,
        sort_order: parseInt(editOrder, 10) || 0,
      })
      useAdminStore.getState().setZones(
        zones.map(x => (x.id === editId ? mapDjangoZone(z) : x)).sort(bySortOrder)
      )
      setEditId(null)
      showToast('Зона обновлена ✓')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.data?.detail ?? e?.message ?? 'попробуйте ещё раз'))
    } finally {
      setSaving(false)
    }
  }

  const removeZone = (z: Zone) => {
    const affected = tables.filter(t => t.zoneId === z.id).length
    const message = affected > 0
      ? `Удалить зону «${z.name}»? ${affected} ${affected === 1 ? 'стол станет' : 'столов станут'} «без зоны», назначение этой зоны у официантов будет снято.`
      : `Удалить зону «${z.name}»?`

    showConfirm(message, async () => {
      if (!djangoRestId) return
      try {
        // БД сама обнуляет tables.zone (SET_NULL) и снимает M2M assigned_zones
        // у официантов — ручная батч-чистка (как во Firebase) больше не нужна.
        await api.deleteZone(djangoRestId, z.id)
        const st = useAdminStore.getState()
        st.setZones(st.zones.filter(x => x.id !== z.id))
        st.setTables(st.tables.map(t => (t.zoneId === z.id ? { ...t, zoneId: null } : t)) as any)
        showToast('Зона удалена')
      } catch (e: any) {
        showToast('Ошибка: ' + (e?.data?.detail ?? e?.message ?? 'попробуйте ещё раз'))
      }
    })
  }

  const colorPicker = (val: string, set: (c: string) => void) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ZONE_COLORS.map(c => (
        <button key={c} type="button" onClick={() => set(c)}
          className="w-6 h-6 rounded-full transition-all active:scale-90"
          style={{ background: c, border: val === c ? '2px solid var(--color-soft)' : '2px solid transparent' }} />
      ))}
    </div>
  )

  return (
    <div className="adm-card p-4 mb-8">
      {zones.length === 0 && (
        <p className="text-xs mb-3" style={{ color: 'var(--color-dim)' }}>
          Зон пока нет — все столы считаются «без зоны»
        </p>
      )}

      {zones.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {zones.map(z => (
            <div key={z.id} className="rounded-xl p-3"
                 style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}>
              {editId === z.id ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      placeholder="Название зоны"
                      className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)', color: 'var(--color-soft)' }} />
                    <input type="number" value={editOrder} onChange={e => setEditOrder(e.target.value)}
                      title="Порядок"
                      className="w-16 px-2 py-2 rounded-lg text-sm text-right outline-none"
                      style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)', color: 'var(--color-soft)' }} />
                  </div>
                  {colorPicker(editColor, setEditColor)}
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setEditId(null)}
                      className="flex-1 h-9 rounded-lg text-xs font-semibold"
                      style={{ background: 'var(--color-card)', color: 'var(--color-mid)', border: '1px solid var(--color-rim)' }}>
                      Отмена
                    </button>
                    <button onClick={saveEdit} disabled={saving}
                      className="flex-1 h-9 rounded-lg text-xs font-bold text-black"
                      style={{ background: 'var(--color-gold)' }}>
                      Сохранить
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: z.color || 'var(--color-gold)' }} />
                  <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--color-soft)' }}>{z.name}</span>
                  <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--color-dim)' }}>
                    {tables.filter(t => t.zoneId === z.id).length} столов
                  </span>
                  <button onClick={() => startEdit(z)}
                    className="h-7 px-2 rounded-lg text-[11px] font-semibold flex-shrink-0"
                    style={{ background: 'var(--color-card)', color: 'var(--color-mid)', border: '1px solid var(--color-rim)' }}>
                    Изменить
                  </button>
                  <button onClick={() => removeZone(z)}
                    className="h-7 px-2 rounded-lg text-[11px] font-semibold flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,.08)', color: 'var(--color-red)', border: '1px solid rgba(239,68,68,.2)' }}>
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Новая зона */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Название зоны (Терраса, Зал 1...)"
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)', color: 'var(--color-soft)' }} />
          <input type="number" value={order} onChange={e => setOrder(e.target.value)} title="Порядок"
            className="w-16 px-2 py-2.5 rounded-xl text-sm text-right outline-none"
            style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)', color: 'var(--color-soft)' }} />
        </div>
        {colorPicker(color, setColor)}
        <button onClick={create} disabled={saving || !name.trim()}
          className="h-10 rounded-xl text-xs font-bold text-black transition-all active:scale-95"
          style={{ background: saving || !name.trim() ? 'var(--color-dim)' : 'var(--color-gold)' }}>
          + Добавить зону
        </button>
      </div>
    </div>
  )
}
