import React, { useEffect, useMemo, useState } from 'react'
import { Search, Store, Armchair, Users, RefreshCcw, Plus, X } from 'lucide-react'
import { api } from '../../lib/api'
import { useSAStore } from '../store'
import TopBar from '../components/TopBar'

// Транслитерация для автоподстановки slug из русского/казахского названия
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o',
  ұ: 'u', ү: 'u', һ: 'h', і: 'i',
}

function suggestSlug(name: string): string {
  return name.toLowerCase()
    .split('').map(ch => TRANSLIT[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  trial:     { label: 'Триал',       color: 'var(--color-gold)' },
  active:    { label: 'Активна',     color: 'var(--color-green)' },
  past_due:  { label: 'Просрочена',  color: 'var(--color-orange)' },
  suspended: { label: 'Заблокирована', color: 'var(--color-red)' },
}

export default function RestaurantsListScreen() {
  const { restaurants, plans, setRestaurants, setPlans, selectRestaurant, setScreen, showToast } = useSAStore()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', address: '', working_hours: '', is_public: true })
  const [slugTouched, setSlugTouched] = useState(false)

  const openCreate = () => {
    setForm({ name: '', slug: '', address: '', working_hours: '', is_public: true })
    setSlugTouched(false)
    setCreateOpen(true)
  }

  const createRestaurant = async () => {
    if (!form.name.trim()) { showToast('Укажите название ресторана'); return }
    setCreating(true)
    try {
      const r = await api.superadminCreateRestaurant({
        name: form.name.trim(),
        slug: form.slug.trim(),
        address: form.address.trim(),
        working_hours: form.working_hours.trim(),
        is_public: form.is_public,
      })
      setRestaurants([...restaurants, r])
      setCreateOpen(false)
      showToast(`Ресторан «${r.name}» создан`)
      selectRestaurant(r.id)
      setScreen('detail')
    } catch (e: any) {
      const slugErr = e?.data?.slug?.[0]
      showToast(slugErr ?? e?.data?.detail ?? e?.message ?? 'Не удалось создать ресторан')
    } finally {
      setCreating(false)
    }
  }

  const load = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true)
    try {
      const [rests, plans] = await Promise.all([api.superadminRestaurants(), api.subscriptionPlans()])
      setRestaurants(rests)
      setPlans(plans)
    } catch {
      showToast('Не удалось загрузить рестораны')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => restaurants.filter(r =>
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    r.slug.toLowerCase().includes(query.toLowerCase()),
  ), [restaurants, query])

  const openRestaurant = (id: string) => {
    selectRestaurant(id)
    setScreen('detail')
  }

  return (
    <div className="adm-layout min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="adm-main" style={{ marginLeft: 0 }}>
        <TopBar title="Рестораны Plait" subtitle={`Всего: ${restaurants.length}`} />

        <div className="adm-content px-4 pt-4 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-mid)' }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск по названию или slug..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'var(--color-card)', border: '1.5px solid var(--color-rim)', color: 'var(--color-soft)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--color-gold)')}
                onBlur={e  => (e.target.style.borderColor = 'var(--color-rim)')}
              />
            </div>
            <button
              onClick={() => load(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
              title="Обновить"
            >
              <RefreshCcw size={16} style={{ color: 'var(--color-mid)' }} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={openCreate}
              className="h-10 px-4 rounded-xl flex items-center gap-1.5 shrink-0 text-sm font-bold transition-transform active:scale-95"
              style={{ background: 'var(--color-gold)', color: '#fff' }}
            >
              <Plus size={16} /> Новый
            </button>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-4 animate-spin"
                   style={{ borderColor: 'var(--color-rim)', borderTopColor: 'var(--color-gold)' }} />
              <p className="text-sm" style={{ color: 'var(--color-mid)' }}>Загрузка ресторанов...</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
              <Store size={32} style={{ color: 'var(--color-dim)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-mid)' }}>
                {restaurants.length === 0 ? 'Рестораны пока не добавлены' : 'Ничего не найдено'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-6">
            {filtered.map(r => {
              const status = STATUS_LABELS[r.subscription_status] ?? STATUS_LABELS.trial
              const plan = plans.find(p => p.id === r.subscription_plan)
              const tablesLimit = plan?.max_tables
              return (
                <button
                  key={r.id}
                  onClick={() => openRestaurant(r.id)}
                  className="adm-card flex flex-col gap-3 p-4 text-left transition-transform active:scale-[.98] hover:border-[var(--color-gold)]"
                  style={{ width: '100%' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-rim)' }}
                    >
                      {r.logo_url
                        ? <img src={r.logo_url} alt="" className="w-full h-full object-cover" />
                        : <Store size={20} style={{ color: 'var(--color-mid)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate" style={{ color: 'var(--color-soft)' }}>{r.name}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--color-mid)' }}>/{r.slug}</div>
                    </div>
                    <span
                      className="text-[11px] font-bold px-2 py-1 rounded-full shrink-0"
                      style={{ color: status.color, border: `1px solid ${status.color}` }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-mid)' }}>
                    <span className="flex items-center gap-1.5">
                      <Armchair size={14} />
                      {r.tables_count}{tablesLimit != null ? ` / ${tablesLimit}` : ''} столов
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={14} />
                      {r.staff_count}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2" style={{ borderTop: '1px solid var(--color-rim)' }}>
                    <span style={{ color: 'var(--color-dim)' }}>Тариф</span>
                    <span className="font-semibold" style={{ color: 'var(--color-soft)' }}>
                      {r.subscription_plan_detail ? r.subscription_plan_detail.name : 'Без тарифа'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Модал «Новый ресторан» ── */}
      {createOpen && (
        <>
          <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[301] w-[92%] max-w-md rounded-3xl p-5 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-lg font-bold" style={{ color: 'var(--color-soft)' }}>Новый ресторан</p>
              <button onClick={() => setCreateOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--color-card2)' }}>
                <X size={16} style={{ color: 'var(--color-mid)' }} />
              </button>
            </div>

            {([
              { key: 'name',          label: 'Название *',             placeholder: 'Кафе «Астана»' },
              { key: 'slug',          label: 'Slug (адрес в ссылках)', placeholder: 'kafe-astana' },
              { key: 'address',       label: 'Адрес',                  placeholder: 'ул. Абая, 10' },
              { key: 'working_hours', label: 'Часы работы',            placeholder: '09:00–23:00' },
            ] as const).map(({ key, label, placeholder }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: 'var(--color-mid)' }}>{label}</label>
                <input
                  value={form[key]}
                  onChange={e => {
                    const v = e.target.value
                    if (key === 'slug') {
                      setSlugTouched(true)
                      setForm(f => ({ ...f, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
                    } else if (key === 'name') {
                      setForm(f => ({ ...f, name: v, slug: slugTouched ? f.slug : suggestSlug(v) }))
                    } else {
                      setForm(f => ({ ...f, [key]: v }))
                    }
                  }}
                  placeholder={placeholder}
                  className="px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'var(--color-card2)', border: '1.5px solid var(--color-rim)', color: 'var(--color-soft)' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--color-gold)')}
                  onBlur={e  => (e.target.style.borderColor = 'var(--color-rim)')}
                />
              </div>
            ))}
            <p className="text-[11px] -mt-1" style={{ color: 'var(--color-dim)' }}>
              Slug можно оставить пустым — сгенерируется автоматически. После создания он не меняется (на него завязаны QR-коды).
            </p>

            <label className="flex items-center justify-between py-1 cursor-pointer">
              <span className="text-sm font-semibold" style={{ color: 'var(--color-soft)' }}>
                Виден в публичном каталоге
              </span>
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))}
                className="w-5 h-5 accent-[var(--color-gold)]"
              />
            </label>

            <button
              onClick={createRestaurant}
              disabled={creating || !form.name.trim()}
              className="h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[.98] disabled:opacity-50"
              style={{ background: 'var(--color-gold)', color: '#fff' }}
            >
              <Plus size={16} /> {creating ? 'Создание...' : 'Создать ресторан'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
