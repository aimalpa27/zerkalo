import React, { useRef, useState } from 'react'
import { Image as ImageIcon, Upload, MapPin, Clock, Percent, Bell, Globe, Palette, Sun, Moon, Save, Wallet, Mountain, Bike } from 'lucide-react'
import { api, type DjangoRestaurant } from '../../lib/api'
import { useSAStore } from '../store'

const ACCENT_PRESETS = ['#FF6B1A', '#FF9248', '#3DDC84', '#3B82F6', '#A855F7', '#EF4444', '#F59E0B', '#10B981']

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-mid)' }}>
        <Icon size={13} /> {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-card)', border: '1.5px solid var(--color-rim)', color: 'var(--color-soft)',
}

export default function BrandingTab({
  restId, settings, onUpdate,
}: {
  restId: string
  settings: DjangoRestaurant
  onUpdate: (s: DjangoRestaurant) => void
}) {
  const { showToast } = useSAStore()
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof DjangoRestaurant>(key: K, value: DjangoRestaurant[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const updated = await api.updateRestaurantSettings(restId, {
        name: form.name,
        address: form.address,
        working_hours: form.working_hours,
        theme: form.theme,
        accent_color: form.accent_color,
        service_charge_percent: form.service_charge_percent,
        allow_waiter_close: form.allow_waiter_close,
        kaspi_pay_url: form.kaspi_pay_url,
        panorama_url: form.panorama_url,
        is_public: form.is_public,
        delivery_fee: form.delivery_fee,
        delivery_min_order: form.delivery_min_order,
      })
      setForm(updated)
      onUpdate(updated)
      showToast('Изменения сохранены')
    } catch (e: any) {
      showToast(e?.data?.kaspi_pay_url?.[0] ?? e?.data?.accent_color?.[0] ?? e?.message ?? 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleLogo = async (file: File) => {
    setUploadingLogo(true)
    try {
      const updated = await api.uploadRestaurantLogo(restId, file)
      setForm(updated)
      onUpdate(updated)
      showToast('Логотип обновлён')
    } catch {
      showToast('Не удалось загрузить логотип')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleCover = async (file: File) => {
    setUploadingCover(true)
    try {
      const updated = await api.uploadRestaurantCover(restId, file)
      setForm(updated)
      onUpdate(updated)
      showToast('Обложка обновлена')
    } catch {
      showToast('Не удалось загрузить обложку')
    } finally {
      setUploadingCover(false)
    }
  }

  const kaspiAllowed = form.features?.kaspi_pay ?? true
  const deliveryAllowed = form.features?.delivery ?? true

  return (
    <div className="flex flex-col gap-4 pb-24">

      {/* Logo + Cover */}
      <div className="adm-card p-4 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-rim)' }}
          >
            {form.logo_url
              ? <img src={form.logo_url} alt="" className="w-full h-full object-cover" />
              : <ImageIcon size={24} style={{ color: 'var(--color-dim)' }} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-soft)' }}>Логотип / аватар</p>
            <p className="text-xs mb-2" style={{ color: 'var(--color-mid)' }}>Квадратное изображение, JPG/PNG</p>
            <input ref={logoInput} type="file" accept="image/*" className="hidden"
                   onChange={e => e.target.files?.[0] && handleLogo(e.target.files[0])} />
            <button
              onClick={() => logoInput.current?.click()}
              disabled={uploadingLogo}
              className="text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5"
              style={{ background: 'var(--color-rim)', color: 'var(--color-gold)' }}
            >
              <Upload size={13} /> {uploadingLogo ? 'Загрузка...' : 'Загрузить'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            className="w-20 h-14 rounded-2xl flex items-center justify-center overflow-hidden shrink-0"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-rim)' }}
          >
            {form.cover_image_url
              ? <img src={form.cover_image_url} alt="" className="w-full h-full object-cover" />
              : <ImageIcon size={24} style={{ color: 'var(--color-dim)' }} />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-soft)' }}>Обложка</p>
            <p className="text-xs mb-2" style={{ color: 'var(--color-mid)' }}>Широкое фото для карточки заведения</p>
            <input ref={coverInput} type="file" accept="image/*" className="hidden"
                   onChange={e => e.target.files?.[0] && handleCover(e.target.files[0])} />
            <button
              onClick={() => coverInput.current?.click()}
              disabled={uploadingCover}
              className="text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5"
              style={{ background: 'var(--color-rim)', color: 'var(--color-gold)' }}
            >
              <Upload size={13} /> {uploadingCover ? 'Загрузка...' : 'Загрузить'}
            </button>
          </div>
        </div>
      </div>

      {/* Основная информация */}
      <div className="adm-card p-4 flex flex-col gap-3">
        <Field label="Название" icon={Globe}>
          <input value={form.name} onChange={e => set('name', e.target.value)}
                 className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
        </Field>
        <Field label="Адрес" icon={MapPin}>
          <input value={form.address} onChange={e => set('address', e.target.value)}
                 className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
        </Field>
        <Field label="Часы работы" icon={Clock}>
          <input value={form.working_hours} onChange={e => set('working_hours', e.target.value)}
                 placeholder="напр. 09:00–23:00"
                 className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
        </Field>
        <Field label="3D-панорама (ссылка)" icon={Mountain}>
          <input value={form.panorama_url ?? ''} onChange={e => set('panorama_url', e.target.value)}
                 placeholder="https://..."
                 className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
        </Field>
      </div>

      {/* Оформление */}
      <div className="adm-card p-4 flex flex-col gap-3">
        <Field label="Тема приложения" icon={Palette}>
          <div className="flex gap-2">
            <button
              onClick={() => set('theme', 'dark')}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: form.theme === 'dark' ? 'var(--color-gold)' : 'var(--color-card)',
                color: form.theme === 'dark' ? '#fff' : 'var(--color-mid)',
                border: '1px solid var(--color-rim)',
              }}
            >
              <Moon size={14} /> Тёмная
            </button>
            <button
              onClick={() => set('theme', 'light')}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: form.theme === 'light' ? 'var(--color-gold)' : 'var(--color-card)',
                color: form.theme === 'light' ? '#fff' : 'var(--color-mid)',
                border: '1px solid var(--color-rim)',
              }}
            >
              <Sun size={14} /> Светлая
            </button>
          </div>
        </Field>

        <Field label="Акцентный цвет" icon={Palette}>
          <div className="flex items-center gap-2 flex-wrap">
            {ACCENT_PRESETS.map(c => (
              <button
                key={c}
                onClick={() => set('accent_color', c)}
                className="w-8 h-8 rounded-full transition-transform active:scale-90"
                style={{
                  background: c,
                  border: form.accent_color === c ? '3px solid var(--color-soft)' : '1px solid var(--color-rim)',
                }}
              />
            ))}
            <input
              value={form.accent_color ?? '#FF6B1A'}
              onChange={e => set('accent_color', e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none w-28 font-mono"
              style={inputStyle}
            />
          </div>
        </Field>
      </div>

      {/* Настройки заказа */}
      <div className="adm-card p-4 flex flex-col gap-3">
        <Field label="Сервисный сбор, %" icon={Percent}>
          <input
            type="number" min={0} max={100}
            value={form.service_charge_percent}
            onChange={e => set('service_charge_percent', Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={inputStyle}
          />
        </Field>

        <ToggleRow
          icon={Bell}
          label="Официант может закрывать счёт"
          checked={form.allow_waiter_close}
          onChange={v => set('allow_waiter_close', v)}
        />

        <ToggleRow
          icon={Globe}
          label="Ресторан виден в публичном каталоге"
          checked={form.is_public}
          onChange={v => set('is_public', v)}
        />

        <Field label="Kaspi Pay — ссылка на оплату" icon={Wallet}>
          <input
            value={form.kaspi_pay_url ?? ''}
            onChange={e => set('kaspi_pay_url', e.target.value)}
            placeholder={kaspiAllowed ? 'https://pay.kaspi.kz/...' : 'Недоступно на текущем тарифе'}
            disabled={!kaspiAllowed}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50"
            style={inputStyle}
          />
          {!kaspiAllowed && (
            <p className="text-xs" style={{ color: 'var(--color-orange)' }}>
              Включите Kaspi Pay в тарифе на вкладке «Подписка».
            </p>
          )}
        </Field>
      </div>

      {/* Доставка / самовывоз */}
      <div className="adm-card p-4 flex flex-col gap-3">
        <Field label="Стоимость доставки, ₸" icon={Bike}>
          <input
            type="number" min={0}
            value={form.delivery_fee ?? 0}
            onChange={e => set('delivery_fee', e.target.value)}
            placeholder={deliveryAllowed ? '0' : 'Недоступно на текущем тарифе'}
            disabled={!deliveryAllowed}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50"
            style={inputStyle}
          />
        </Field>
        <Field label="Минимальная сумма заказа на доставку, ₸" icon={Wallet}>
          <input
            type="number" min={0}
            value={form.delivery_min_order ?? 0}
            onChange={e => set('delivery_min_order', e.target.value)}
            placeholder={deliveryAllowed ? '0' : 'Недоступно на текущем тарифе'}
            disabled={!deliveryAllowed}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none disabled:opacity-50"
            style={inputStyle}
          />
        </Field>
        {!deliveryAllowed && (
          <p className="text-xs" style={{ color: 'var(--color-orange)' }}>
            Включите доставку в тарифе на вкладке «Подписка».
          </p>
        )}
      </div>

      {/* Save button — sticky на мобильных */}
      <div className="sticky bottom-4 z-10">
        <button
          onClick={save}
          disabled={saving}
          className="w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98]"
          style={{ background: saving ? 'var(--color-dim)' : 'var(--color-gold)', color: '#fff', boxShadow: 'var(--card-pay-shadow)' }}
        >
          <Save size={16} />
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  )
}

function ToggleRow({ icon: Icon, label, checked, onChange }: {
  icon: React.ElementType; label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer py-1">
      <Icon size={16} style={{ color: 'var(--color-mid)' }} />
      <span className="flex-1 text-sm font-medium" style={{ color: 'var(--color-soft)' }}>{label}</span>
      <span className="adm-toggle">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="adm-toggle-track" />
      </span>
    </label>
  )
}
