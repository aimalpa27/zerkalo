import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  X, Save, Trash2, Upload, Image as ImageIcon, Video as VideoIcon,
  Tag, Percent, Soup, Martini, Eye, EyeOff,
} from 'lucide-react'
import { api, type DjangoCategory, type DjangoMenuItem } from '../../lib/api'

const inputStyle: React.CSSProperties = {
  background: 'var(--color-card2)', border: '1px solid var(--card-border)', color: 'var(--color-soft)',
}

const BADGE_OPTIONS: { value: '' | 'hit' | 'new' | 'sale'; label: string }[] = [
  { value: '',     label: 'Без метки' },
  { value: 'hit',  label: '🔥 Хит' },
  { value: 'new',  label: '✨ Новинка' },
  { value: 'sale', label: '🏷️ Скидка' },
]

export default function MenuItemModal({
  restId, item, categories, onClose, onSaved, onDeleted, onToast,
}: {
  restId: string
  item: DjangoMenuItem | null
  categories: DjangoCategory[]
  onClose: () => void
  onSaved: (item: DjangoMenuItem, isNew: boolean) => void
  onDeleted: (id: string) => void
  onToast: (msg: string) => void
}) {
  const isNew = !item

  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [price, setPrice] = useState(item ? String(item.price) : '')
  const [weight, setWeight] = useState(item?.weight ?? '')
  const [emoji, setEmoji] = useState(item?.emoji ?? '')
  const [categoryId, setCategoryId] = useState(item?.category?.id ?? '')
  const [badge, setBadge] = useState<'' | 'hit' | 'new' | 'sale'>((item?.badge as any) ?? '')
  const [discount, setDiscount] = useState(String(item?.discount_percent ?? 0))
  const [station, setStation] = useState<'kitchen' | 'bar'>(item?.preparation_station ?? 'kitchen')
  const [isAvailable, setIsAvailable] = useState(item?.is_available ?? true)
  const [isVisible, setIsVisible] = useState(item?.is_visible ?? true)

  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaKind, setMediaKind] = useState<'image' | 'video' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const currentImage = item?.image_url || ''
  const currentVideo = item?.video_url || ''

  const pickFile = () => fileInputRef.current?.click()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    if (!isVideo && !isImage) {
      onToast('Выберите изображение или видео')
      return
    }
    setMediaFile(file)
    setMediaKind(isVideo ? 'video' : 'image')
    setMediaPreview(URL.createObjectURL(file))
  }

  const save = async () => {
    if (!name.trim()) { setError('Укажите название блюда'); return }
    const priceNum = Number(price)
    if (!Number.isFinite(priceNum) || priceNum < 0) { setError('Укажите корректную цену'); return }
    const discountNum = Number(discount) || 0
    if (discountNum < 0 || discountNum > 100) { setError('Скидка должна быть от 0 до 100%'); return }

    setError('')
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        weight: weight.trim(),
        emoji: emoji.trim(),
        category_id: categoryId || null,
        badge,
        discount_percent: discountNum,
        preparation_station: station,
        is_available: isAvailable,
        is_visible: isVisible,
      }

      let saved: DjangoMenuItem
      if (isNew) {
        saved = await api.createMenuItem(restId, payload)
      } else {
        saved = await api.updateMenuItem(restId, item!.id, payload)
      }

      if (mediaFile) {
        try {
          saved = await api.uploadMenuMedia(restId, saved.id, mediaFile)
        } catch (e: any) {
          onToast(e?.data?.detail ?? e?.message ?? 'Не удалось загрузить медиа')
        }
      }

      onSaved(saved, isNew)
      onToast(isNew ? 'Блюдо добавлено ✓' : 'Изменения сохранены ✓')
    } catch (e: any) {
      const msg = e?.data?.price?.[0] ?? e?.data?.name?.[0] ?? e?.data?.detail ?? e?.message ?? 'Ошибка сохранения'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!item) return
    if (!confirm(`Удалить блюдо «${item.name}»?`)) return
    setDeleting(true)
    try {
      await api.deleteMenuItem(restId, item.id)
      onDeleted(item.id)
      onToast('Блюдо удалено')
    } catch {
      onToast('Не удалось удалить блюдо')
      setDeleting(false)
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--color-card)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 z-10"
             style={{ background: 'var(--color-card)' }}>
          <p className="text-lg font-bold" style={{ color: 'var(--color-soft)' }}>
            {isNew ? 'Новое блюдо' : 'Редактировать блюдо'}
          </p>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-card2)' }}>
            <X size={16} style={{ color: 'var(--color-mid)' }} />
          </button>
        </div>

        <div className="px-5 pb-6 flex flex-col gap-3">

          {/* Медиа: фото / видео */}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                 className="hidden" onChange={onFileChange} />
          <div className="flex items-center gap-3">
            <button
              onClick={pickFile}
              className="w-20 h-20 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl relative"
              style={{ background: 'var(--color-card2)', border: '1px solid var(--card-border)' }}
              title="Загрузить фото или видео"
            >
              {mediaPreview ? (
                mediaKind === 'video'
                  ? <video src={mediaPreview} className="w-full h-full object-cover" muted />
                  : <img src={mediaPreview} alt="" className="w-full h-full object-cover" />
              ) : currentVideo ? (
                <video src={currentVideo} className="w-full h-full object-cover" muted />
              ) : currentImage ? (
                <img src={currentImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{emoji || '🍽️'}</span>
              )}
              <span
                className="absolute bottom-0 right-0 w-5 h-5 rounded-tl-md flex items-center justify-center"
                style={{ background: 'var(--color-gold)', color: '#000' }}
              ><Upload size={11} /></span>
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-soft)' }}>Фото или видео блюда</p>
              <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-mid)' }}>
                {mediaKind === 'video' || (!mediaFile && currentVideo)
                  ? <><VideoIcon size={12} /> Видео · MP4/WEBM, до 50MB</>
                  : <><ImageIcon size={12} /> Фото · JPG/PNG/WEBP, до 10MB</>}
              </p>
              <button onClick={pickFile}
                className="mt-2 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                style={{ background: 'var(--color-rim)', color: 'var(--color-gold)' }}>
                <Upload size={12} /> Выбрать файл
              </button>
            </div>
          </div>

          {/* Название */}
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Название блюда"
            className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none" style={inputStyle} />

          {/* Описание */}
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Описание (состав, вес, особенности)"
            rows={3}
            className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none resize-none" style={inputStyle} />

          {/* Цена + вес */}
          <div className="flex gap-3">
            <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Цена, ₸" type="number" min={0}
              className="flex-1 px-4 py-3.5 rounded-2xl text-sm outline-none" style={inputStyle} />
            <input value={weight} onChange={e => setWeight(e.target.value)} placeholder="Вес/объём (напр. 250 г)"
              className="flex-1 px-4 py-3.5 rounded-2xl text-sm outline-none" style={inputStyle} />
          </div>

          {/* Эмодзи + категория */}
          <div className="flex gap-3">
            <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="Эмодзи" maxLength={4}
              className="w-24 px-4 py-3.5 rounded-2xl text-sm outline-none text-center" style={inputStyle} />
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="flex-1 px-4 py-3.5 rounded-2xl text-sm outline-none" style={inputStyle}>
              <option value="">Без категории</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Метка + скидка */}
          <div className="flex gap-3">
            <select value={badge} onChange={e => setBadge(e.target.value as any)}
              className="flex-1 px-4 py-3.5 rounded-2xl text-sm outline-none" style={inputStyle}>
              {BADGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="relative w-32">
              <Percent size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-dim)' }} />
              <input value={discount} onChange={e => setDiscount(e.target.value)} placeholder="Скидка" type="number" min={0} max={100}
                className="w-full pl-9 pr-3 py-3.5 rounded-2xl text-sm outline-none" style={inputStyle} />
            </div>
          </div>

          {/* Цех приготовления */}
          <div className="flex gap-2">
            <button onClick={() => setStation('kitchen')}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-sm font-semibold transition-all"
              style={{
                background: station === 'kitchen' ? 'var(--color-gold)' : 'var(--color-card2)',
                color: station === 'kitchen' ? '#fff' : 'var(--color-mid)',
                border: '1px solid var(--card-border)',
              }}>
              <Soup size={15} /> Кухня
            </button>
            <button onClick={() => setStation('bar')}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-sm font-semibold transition-all"
              style={{
                background: station === 'bar' ? 'var(--color-gold)' : 'var(--color-card2)',
                color: station === 'bar' ? '#fff' : 'var(--color-mid)',
                border: '1px solid var(--card-border)',
              }}>
              <Martini size={15} /> Бар
            </button>
          </div>

          {/* Доступность / видимость */}
          <div className="rounded-2xl px-4 py-1" style={{ background: 'var(--color-card2)', border: '1px solid var(--card-border)' }}>
            <label className="flex items-center gap-3 cursor-pointer py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <Tag size={16} style={{ color: 'var(--color-mid)' }} />
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-soft)' }}>
                Сейчас в наличии
              </span>
              <span className="adm-toggle">
                <input type="checkbox" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)} />
                <span className="adm-toggle-track" />
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer py-3">
              {isVisible ? <Eye size={16} style={{ color: 'var(--color-mid)' }} /> : <EyeOff size={16} style={{ color: 'var(--color-mid)' }} />}
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-soft)' }}>
                Показывать в меню гостям
              </span>
              <span className="adm-toggle">
                <input type="checkbox" checked={isVisible} onChange={e => setIsVisible(e.target.checked)} />
                <span className="adm-toggle-track" />
              </span>
            </label>
          </div>

          {error && <p className="text-xs text-center" style={{ color: 'var(--color-red)' }}>{error}</p>}

          <div className="flex gap-3 mt-2">
            {!isNew && (
              <button onClick={remove} disabled={deleting || saving}
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,.08)', color: 'var(--color-red)', border: '1px solid var(--card-border)' }}
                title="Удалить блюдо">
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={save} disabled={saving || deleting}
              className="flex-1 h-14 rounded-2xl text-sm font-bold text-black flex items-center justify-center gap-2"
              style={{ background: saving ? 'var(--color-dim)' : 'var(--color-gold)' }}>
              <Save size={16} />
              {saving ? 'Сохранение...' : isNew ? 'ДОБАВИТЬ БЛЮДО' : 'СОХРАНИТЬ'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
