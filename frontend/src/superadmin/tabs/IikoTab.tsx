import React, { useEffect, useState } from 'react'
import { Plug, Save, RefreshCw, KeyRound, CheckCircle2, XCircle } from 'lucide-react'
import { api, type IikoSettings } from '../../lib/api'
import { useSAStore } from '../store'

const inputStyle: React.CSSProperties = {
  background: 'var(--color-card)', border: '1.5px solid var(--color-rim)', color: 'var(--color-soft)',
}

export default function IikoTab({ restId }: { restId: string }) {
  const { showToast } = useSAStore()

  const [settings, setSettings] = useState<IikoSettings | null>(null)
  const [loading, setLoading]   = useState(true)

  const [enabled, setEnabled]   = useState(false)
  const [apiKey, setApiKey]     = useState('')          // пусто = не менять
  const [orgId, setOrgId]       = useState('')
  const [menuId, setMenuId]     = useState('')

  const [saving, setSaving]     = useState(false)
  const [syncing, setSyncing]   = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const s = await api.iikoSettings(restId)
      setSettings(s)
      setEnabled(s.iiko_enabled)
      setOrgId(s.iiko_organization_id ?? '')
      setMenuId(s.iiko_external_menu_id ?? '')
      setApiKey('')
    } catch {
      showToast('Не удалось загрузить настройки iiko')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [restId])

  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        iiko_enabled: enabled,
        iiko_organization_id: orgId.trim(),
        iiko_external_menu_id: menuId.trim(),
      }
      // Ключ отправляем только если ввели новый — иначе не затираем сохранённый.
      if (apiKey.trim()) payload.iiko_api_key = apiKey.trim()

      const s = await api.updateIikoSettings(restId, payload)
      setSettings(s)
      setEnabled(s.iiko_enabled)
      setOrgId(s.iiko_organization_id ?? '')
      setMenuId(s.iiko_external_menu_id ?? '')
      setApiKey('')
      showToast('Настройки iiko сохранены')
    } catch (e: any) {
      showToast(e?.message ?? 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const sync = async () => {
    setSyncing(true)
    try {
      const { created, updated } = await api.iikoSync(restId)
      showToast(`Меню импортировано: создано ${created}, обновлено ${updated}`)
    } catch (e: any) {
      showToast(e?.message ?? 'Ошибка синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 rounded-full border-4 animate-spin"
             style={{ borderColor: 'var(--color-rim)', borderTopColor: 'var(--color-gold)' }} />
        <p className="text-sm" style={{ color: 'var(--color-mid)' }}>Загрузка...</p>
      </div>
    )
  }

  const keySaved = settings?.iiko_api_key_set ?? false
  const canSync = enabled && keySaved

  return (
    <div className="flex flex-col gap-4 pb-24">

      {/* Статус + переключатель */}
      <div className="adm-card p-4 flex flex-col gap-3">
        <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-mid)' }}>
          <Plug size={13} /> Интеграция iiko (Cloud API)
        </label>
        <button
          onClick={() => setEnabled(v => !v)}
          className="flex items-center justify-between px-3 py-3 rounded-xl transition-all"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--color-soft)' }}>
            {enabled ? 'Интеграция включена' : 'Интеграция выключена'}
          </span>
          {enabled
            ? <CheckCircle2 size={20} style={{ color: 'var(--color-green)' }} />
            : <XCircle size={20} style={{ color: 'var(--color-dim)' }} />}
        </button>
        <p className="text-xs" style={{ color: 'var(--color-dim)' }}>
          Меню импортируется из внешнего меню iiko. Ключ выдаётся в iikoWeb → «Настройки Cloud API».
        </p>
      </div>

      {/* Ключ и параметры */}
      <div className="adm-card p-4 flex flex-col gap-3">
        <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-mid)' }}>
          <KeyRound size={13} /> API-ключ ресторана
        </label>
        <input
          type="text"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={keySaved ? '•••••••• (ключ сохранён — введите, чтобы заменить)' : 'Вставьте API-ключ из iiko'}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={inputStyle}
        />

        <label className="text-xs font-semibold mt-2" style={{ color: 'var(--color-mid)' }}>
          Organization ID (необязательно)
        </label>
        <input
          type="text"
          value={orgId}
          onChange={e => setOrgId(e.target.value)}
          placeholder="Пусто = первая организация аккаунта"
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={inputStyle}
        />

        <label className="text-xs font-semibold mt-2" style={{ color: 'var(--color-mid)' }}>
          External menu ID (необязательно)
        </label>
        <input
          type="text"
          value={menuId}
          onChange={e => setMenuId(e.target.value)}
          placeholder="Пусто = первое внешнее меню"
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={inputStyle}
        />
      </div>

      {/* Синхронизация */}
      <div className="adm-card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-mid)' }}>
          <RefreshCw size={13} /> Импорт меню
        </p>
        <p className="text-xs" style={{ color: 'var(--color-dim)' }}>
          {canSync
            ? 'Загрузит блюда из iiko в меню ресторана. Автоматически меню обновляется раз в час.'
            : 'Сначала включите интеграцию и сохраните API-ключ.'}
        </p>
        <button
          onClick={sync}
          disabled={!canSync || syncing}
          className="w-full h-11 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98]"
          style={{
            background: (!canSync || syncing) ? 'var(--color-dim)' : 'var(--color-card)',
            color: 'var(--color-soft)', border: '1px solid var(--color-rim)',
          }}
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Синхронизация...' : 'Синхронизировать сейчас'}
        </button>
      </div>

      {/* Сохранить */}
      <div className="sticky bottom-4 z-10">
        <button
          onClick={save}
          disabled={saving}
          className="w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[.98]"
          style={{ background: saving ? 'var(--color-dim)' : 'var(--color-gold)', color: '#fff', boxShadow: 'var(--card-pay-shadow)' }}
        >
          <Save size={16} />
          {saving ? 'Сохранение...' : 'Сохранить настройки iiko'}
        </button>
      </div>
    </div>
  )
}
