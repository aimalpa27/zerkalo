import React, { useEffect, useState } from 'react'
import { Plus, Trash2, QrCode, Armchair, Layers } from 'lucide-react'
import { api, type DjangoTable, type SuperAdminRestaurant } from '../../lib/api'
import { useSAStore } from '../store'

export default function TablesTab({ restId, restaurant }: { restId: string; restaurant: SuperAdminRestaurant }) {
  const { plans, showToast } = useSAStore()
  const [tables, setTables] = useState<DjangoTable[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [nextNumber, setNextNumber] = useState('')

  const [targetCount, setTargetCount] = useState('')
  const [bulkCreating, setBulkCreating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 })

  const plan = plans.find(p => p.id === restaurant.subscription_plan)
  const limit = plan?.max_tables ?? null
  const limitReached = limit != null && tables.length >= limit

  const load = async () => {
    setLoading(true)
    try {
      const list = await api.tables(restId)
      setTables(list.sort((a, b) => a.number - b.number))
      setNextNumber(String((list.reduce((m, t) => Math.max(m, t.number), 0) || 0) + 1))
    } catch {
      showToast('Не удалось загрузить столы')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [restId])

  const addTable = async () => {
    const num = Number(nextNumber)
    if (!num || num < 1) { showToast('Укажите номер стола'); return }
    setAdding(true)
    try {
      const t = await api.createTable(restId, num)
      setTables(prev => [...prev, t].sort((a, b) => a.number - b.number))
      setNextNumber(String(num + 1))
      showToast(`Стол №${num} добавлен`)
    } catch (e: any) {
      showToast(e?.data?.detail ?? e?.message ?? 'Не удалось добавить стол')
    } finally {
      setAdding(false)
    }
  }

  /** Создаёт по очереди недостающие столы №1..N (заполняет дыры до указанного количества). */
  const bulkCreate = async () => {
    const target = Number(targetCount)
    if (!target || target < 1) { showToast('Укажите итоговое количество столов'); return }

    const existingNumbers = new Set(tables.map(t => t.number))
    let missing: number[] = []
    for (let i = 1; i <= target; i++) {
      if (!existingNumbers.has(i)) missing.push(i)
    }

    if (missing.length === 0) {
      showToast('Столы с такими номерами уже существуют')
      return
    }

    if (limit != null) {
      const allowed = Math.max(0, limit - tables.length)
      if (allowed === 0) { showToast('Лимит тарифа уже достигнут'); return }
      if (missing.length > allowed) {
        missing = missing.slice(0, allowed)
        showToast(`Тариф «${plan?.name}» позволяет создать ещё только ${allowed} стол(ов)`)
      }
    }

    setBulkCreating(true)
    setBulkProgress({ done: 0, total: missing.length })

    for (const num of missing) {
      try {
        const t = await api.createTable(restId, num)
        setTables(prev => [...prev, t].sort((a, b) => a.number - b.number))
        setBulkProgress(p => ({ ...p, done: p.done + 1 }))
      } catch (e: any) {
        showToast(e?.data?.detail ?? e?.message ?? `Остановлено на столе №${num}`)
        break
      }
    }

    setBulkCreating(false)
    setTargetCount('')
    showToast('Столы созданы')
  }

  const removeTable = async (t: DjangoTable) => {
    if (!confirm(`Удалить стол №${t.number}? QR-код перестанет работать.`)) return
    try {
      await api.deleteTable(restId, t.id)
      setTables(prev => prev.filter(x => x.id !== t.id))
      showToast(`Стол №${t.number} удалён`)
    } catch {
      showToast('Не удалось удалить стол')
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-24">

      {/* Лимит */}
      <div className="adm-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Armchair size={18} style={{ color: 'var(--color-gold)' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-soft)' }}>
              {tables.length}{limit != null ? ` / ${limit}` : ''} столов
            </p>
            <p className="text-xs" style={{ color: 'var(--color-mid)' }}>
              {limit != null ? `Лимит тарифа «${plan?.name}»` : 'Без ограничений'}
            </p>
          </div>
        </div>
        {limitReached && (
          <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ color: 'var(--color-red)', border: '1px solid var(--color-red)' }}>
            Лимит достигнут
          </span>
        )}
      </div>

      {/* Добавить стол */}
      <div className="adm-card p-4 flex flex-col gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-mid)' }}>Добавить стол</label>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={nextNumber}
            onChange={e => setNextNumber(e.target.value)}
            placeholder="Номер стола"
            disabled={limitReached}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50"
            style={{ background: 'var(--color-card)', border: '1.5px solid var(--color-rim)', color: 'var(--color-soft)' }}
          />
          <button
            onClick={addTable}
            disabled={adding || limitReached}
            className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'var(--color-gold)', color: '#fff' }}
          >
            <Plus size={15} /> Добавить
          </button>
        </div>
        {limitReached && (
          <p className="text-xs" style={{ color: 'var(--color-orange)' }}>
            Чтобы добавить ещё столы, повысьте тариф на вкладке «Подписка».
          </p>
        )}
      </div>

      {/* Заполнить столы по количеству */}
      <div className="adm-card p-4 flex flex-col gap-2">
        <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-mid)' }}>
          <Layers size={13} /> Создать столы по количеству
        </label>
        <p className="text-xs" style={{ color: 'var(--color-dim)' }}>
          Укажи итоговое число столов — недостающие номера от №1 до №N будут созданы по очереди.
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={targetCount}
            onChange={e => setTargetCount(e.target.value)}
            placeholder="Например, 12"
            disabled={limitReached || bulkCreating}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50"
            style={{ background: 'var(--color-card)', border: '1.5px solid var(--color-rim)', color: 'var(--color-soft)' }}
            onKeyDown={e => e.key === 'Enter' && bulkCreate()}
          />
          <button
            onClick={bulkCreate}
            disabled={bulkCreating || limitReached}
            className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'var(--color-gold)', color: '#fff' }}
          >
            <Layers size={15} /> {bulkCreating ? `${bulkProgress.done}/${bulkProgress.total}...` : 'Создать'}
          </button>
        </div>
        {bulkCreating && bulkProgress.total > 0 && (
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-rim)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(bulkProgress.done / bulkProgress.total) * 100}%`,
                background: 'linear-gradient(90deg, var(--color-gold), var(--color-gold2))',
              }}
            />
          </div>
        )}
      </div>

      {/* Список столов */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-8 h-8 rounded-full border-4 animate-spin"
               style={{ borderColor: 'var(--color-rim)', borderTopColor: 'var(--color-gold)' }} />
        </div>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <Armchair size={28} style={{ color: 'var(--color-dim)' }} />
          <p className="text-sm" style={{ color: 'var(--color-mid)' }}>Столы ещё не добавлены</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tables.map(t => (
            <div key={t.id} className="adm-card p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold" style={{ color: 'var(--color-soft)' }}>№{t.number}</span>
                <button
                  onClick={() => removeTable(t)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(239,68,68,.08)', color: 'var(--color-red)' }}
                  title="Удалить стол"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {t.qr_url && (
                <a
                  href={t.qr_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold flex items-center gap-1.5 truncate"
                  style={{ color: 'var(--color-gold)' }}
                >
                  <QrCode size={13} className="shrink-0" /> QR-код
                </a>
              )}
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full self-start"
                style={{
                  color: t.is_active ? 'var(--color-green)' : 'var(--color-mid)',
                  border: `1px solid ${t.is_active ? 'var(--color-green)' : 'var(--color-rim)'}`,
                }}
              >
                {t.is_active ? 'Активен' : 'Отключён'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
