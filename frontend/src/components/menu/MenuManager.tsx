import React, { useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, FolderPlus, ChevronDown, ChevronUp,
  Video as VideoIcon, EyeOff, Soup, Martini,
} from 'lucide-react'
import { api, type DjangoCategory, type DjangoMenuItem } from '../../lib/api'
import MenuItemModal from './MenuItemModal'

const inputStyle: React.CSSProperties = {
  background: 'var(--color-card)', border: '1.5px solid var(--color-rim)', color: 'var(--color-soft)',
}

const BADGE_LABELS: Record<string, string> = { hit: '🔥 Хит', new: '✨ Новинка', sale: '🏷️ Скидка' }

export default function MenuManager({
  restId, onToast, onItemsChange,
}: {
  restId: string
  onToast: (msg: string) => void
  onItemsChange?: (items: DjangoMenuItem[]) => void
}) {
  const [categories, setCategories] = useState<DjangoCategory[]>([])
  const [items, setItems] = useState<DjangoMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalItem, setModalItem] = useState<DjangoMenuItem | 'new' | null>(null)

  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [cats, menu] = await Promise.all([
        api.categories(restId),
        api.menu(restId),
      ])
      const sortedCats = [...cats].sort((a, b) => a.sort_order - b.sort_order)
      const sortedItems = [...menu].sort((a, b) => a.sort_order - b.sort_order)
      setCategories(sortedCats)
      setItems(sortedItems)
      onItemsChange?.(sortedItems)
    } catch {
      onToast('Не удалось загрузить меню')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [restId])

  const addCategory = async () => {
    if (!newCatName.trim()) return
    setAddingCat(true)
    try {
      const cat = await api.createCategory(restId, { name: newCatName.trim(), sort_order: categories.length })
      setCategories(prev => [...prev, cat])
      setNewCatName('')
      onToast('Категория добавлена')
    } catch (e: any) {
      onToast(e?.data?.name?.[0] ?? 'Не удалось добавить категорию')
    } finally {
      setAddingCat(false)
    }
  }

  const startRename = (cat: DjangoCategory) => {
    setEditingCatId(cat.id)
    setEditingCatName(cat.name)
  }

  const saveCategoryName = async (cat: DjangoCategory) => {
    const name = editingCatName.trim()
    setEditingCatId(null)
    if (!name || name === cat.name) return
    try {
      const updated = await api.updateCategory(restId, cat.id, { name })
      setCategories(prev => prev.map(c => c.id === cat.id ? updated : c))
      onToast('Категория переименована')
    } catch {
      onToast('Не удалось переименовать категорию')
    }
  }

  const removeCategory = async (cat: DjangoCategory) => {
    const count = items.filter(i => i.category?.id === cat.id).length
    if (!confirm(`Удалить категорию «${cat.name}»?${count ? ` Блюда (${count}) останутся без категории.` : ''}`)) return
    try {
      await api.deleteCategory(restId, cat.id)
      setCategories(prev => prev.filter(c => c.id !== cat.id))
      setItems(prev => {
        const next = prev.map(i => i.category?.id === cat.id ? { ...i, category: null } : i)
        onItemsChange?.(next)
        return next
      })
      onToast('Категория удалена')
    } catch {
      onToast('Не удалось удалить категорию')
    }
  }

  const handleSaved = (saved: DjangoMenuItem, isNew: boolean) => {
    setItems(prev => {
      const next = isNew ? [...prev, saved] : prev.map(i => i.id === saved.id ? saved : i)
      onItemsChange?.(next)
      return next
    })
    setModalItem(null)
  }

  const handleDeleted = (id: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.id !== id)
      onItemsChange?.(next)
      return next
    })
    setModalItem(null)
  }

  const quickToggleAvailable = async (item: DjangoMenuItem) => {
    setTogglingId(item.id)
    try {
      const updated = await api.toggleMenuItem(restId, item.id)
      setItems(prev => {
        const next = prev.map(i => i.id === item.id ? updated : i)
        onItemsChange?.(next)
        return next
      })
    } catch {
      onToast('Не удалось обновить статус')
    } finally {
      setTogglingId(null)
    }
  }

  const toggleCollapse = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 rounded-full border-4 animate-spin"
             style={{ borderColor: 'var(--color-rim)', borderTopColor: 'var(--color-gold)' }} />
      </div>
    )
  }

  const groups: { id: string | null; name: string; items: DjangoMenuItem[] }[] = categories.map(c => ({
    id: c.id, name: c.name, items: items.filter(i => i.category?.id === c.id),
  }))
  const noCat = items.filter(i => !i.category)
  if (noCat.length || categories.length === 0) groups.push({ id: null, name: 'Без категории', items: noCat })

  return (
    <div className="flex flex-col gap-4 pb-24">

      {/* Добавить блюдо */}
      <button
        onClick={() => setModalItem('new')}
        className="w-full px-4 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[.98]"
        style={{ background: 'var(--color-gold)', color: '#fff', boxShadow: 'var(--card-pay-shadow)' }}
      >
        <Plus size={16} /> Добавить блюдо
      </button>

      {/* Категории */}
      <div className="adm-card p-4 flex flex-col gap-2">
        <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-mid)' }}>
          <FolderPlus size={13} /> Новая категория
        </label>
        <div className="flex gap-2">
          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            placeholder="Например, Горячие блюда"
            className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
            style={inputStyle}
          />
          <button
            onClick={addCategory}
            disabled={addingCat}
            className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'var(--color-gold)', color: '#fff' }}
          >
            <Plus size={15} /> Добавить
          </button>
        </div>
      </div>

      {/* Группы блюд */}
      {items.length === 0 && categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <span className="text-4xl opacity-30">🍽️</span>
          <p className="text-sm" style={{ color: 'var(--color-mid)' }}>Меню пока пусто</p>
        </div>
      ) : (
        groups.map(group => {
          const key = group.id ?? 'none'
          const isCollapsed = !!collapsed[key]
          const cat = categories.find(c => c.id === group.id)
          return (
            <div key={key} className="flex flex-col gap-2">
              {/* Заголовок группы */}
              <div className="flex items-center gap-2 px-1">
                {cat && editingCatId === cat.id ? (
                  <input
                    autoFocus
                    value={editingCatName}
                    onChange={e => setEditingCatName(e.target.value)}
                    onBlur={() => saveCategoryName(cat)}
                    onKeyDown={e => e.key === 'Enter' && saveCategoryName(cat)}
                    className="flex-1 px-2 py-1 rounded-lg text-sm font-bold outline-none"
                    style={inputStyle}
                  />
                ) : (
                  <button
                    onClick={() => toggleCollapse(key)}
                    className="flex-1 flex items-center gap-1.5 text-left text-sm font-bold truncate"
                    style={{ color: 'var(--color-soft)' }}
                  >
                    {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                    {group.name}
                    <span className="text-xs font-normal" style={{ color: 'var(--color-dim)' }}>
                      {group.items.length}
                    </span>
                  </button>
                )}
                {cat && editingCatId !== cat.id && (
                  <>
                    <button onClick={() => startRename(cat)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--color-card2)', color: 'var(--color-mid)' }}
                      title="Переименовать">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => removeCategory(cat)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,.08)', color: 'var(--color-red)' }}
                      title="Удалить категорию">
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>

              {/* Блюда в группе */}
              {!isCollapsed && (
                group.items.length === 0 ? (
                  <p className="text-xs px-1" style={{ color: 'var(--color-dim)' }}>Нет блюд в этой категории</p>
                ) : (
                  group.items.map(m => {
                    const price = Number(m.price)
                    const finalPrice = m.discount_percent > 0
                      ? price - Math.floor(price * m.discount_percent / 100)
                      : price
                    const isToggling = togglingId === m.id
                    return (
                      <div key={m.id} className="adm-card flex items-center gap-3 p-3">
                        {/* Миниатюра */}
                        <button
                          onClick={() => setModalItem(m)}
                          className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center text-xl relative"
                          style={{ background: 'var(--color-card2)' }}
                        >
                          {m.video_url ? (
                            <>
                              <video src={m.video_url} className="w-full h-full object-cover" muted />
                              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-tl-md flex items-center justify-center"
                                    style={{ background: 'var(--color-gold)', color: '#000' }}>
                                <VideoIcon size={9} />
                              </span>
                            </>
                          ) : m.image_url ? (
                            <img src={m.image_url} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{m.emoji || '🍽️'}</span>
                          )}
                        </button>

                        {/* Информация */}
                        <button onClick={() => setModalItem(m)} className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-semibold truncate flex items-center gap-1.5"
                             style={{ color: m.is_available ? 'var(--color-soft)' : 'var(--color-dim)' }}>
                            {m.name}
                            {!m.is_visible && <EyeOff size={12} style={{ color: 'var(--color-dim)' }} />}
                          </p>
                          <p className="text-xs mt-0.5 font-medium flex items-center gap-1.5" style={{ color: 'var(--color-gold)' }}>
                            {m.discount_percent > 0 ? (
                              <>
                                <span style={{ textDecoration: 'line-through', color: 'var(--color-dim)' }}>
                                  {price.toLocaleString('ru')} ₸
                                </span>
                                {finalPrice.toLocaleString('ru')} ₸
                              </>
                            ) : (
                              `${price.toLocaleString('ru')} ₸`
                            )}
                          </p>
                          <p className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--color-dim)' }}>
                            {m.weight && <span className="break-words">{m.weight} · </span>}
                            {m.preparation_station === 'bar'
                              ? <span className="flex items-center gap-1"><Martini size={11} /> Бар</span>
                              : <span className="flex items-center gap-1"><Soup size={11} /> Кухня</span>}
                            {m.badge && BADGE_LABELS[m.badge] && <span>· {BADGE_LABELS[m.badge]}</span>}
                          </p>
                        </button>

                        {/* Быстрый переключатель доступности */}
                        <label className="adm-toggle shrink-0">
                          <input
                            type="checkbox"
                            checked={m.is_available}
                            disabled={isToggling}
                            onChange={() => quickToggleAvailable(m)}
                          />
                          <span className="adm-toggle-track" />
                        </label>

                        <button
                          onClick={() => setModalItem(m)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: 'var(--color-card2)', color: 'var(--color-mid)' }}
                          title="Редактировать"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    )
                  })
                )
              )}
            </div>
          )
        })
      )}

      {modalItem && (
        <MenuItemModal
          restId={restId}
          item={modalItem === 'new' ? null : modalItem}
          categories={categories}
          onClose={() => setModalItem(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onToast={onToast}
        />
      )}
    </div>
  )
}
