import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'

export default function ProfileModal() {
  const { profileOpen, setProfileOpen, profile, updateProfileName, showToast } = useAdminStore()
  const [name, setName] = useState(profile?.name ?? '')
  const [saving, setSaving] = useState(false)

  // Синхронизируем поле при каждом открытии.
  React.useEffect(() => { if (profileOpen) setName(profile?.name ?? '') }, [profileOpen])

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const updated = await api.updateProfile({ name: trimmed })
      updateProfileName(updated.name)
      showToast('Имя обновлено')
      setProfileOpen(false)
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {profileOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm"
            onClick={() => setProfileOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[401] mx-auto max-w-sm p-6 rounded-3xl"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
          >
            <p className="text-base font-bold mb-1" style={{ color: 'var(--color-soft)' }}>
              Мой профиль
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--color-dim)' }}>
              Имя отображается в чате команды и для других сотрудников.
            </p>

            <label className="text-[11px] font-semibold uppercase tracking-wide"
                   style={{ color: 'var(--color-mid)' }}>Имя</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              maxLength={255}
              autoFocus
              className="w-full mt-1 mb-2 px-3 py-2.5 rounded-2xl text-sm outline-none"
              style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)', color: 'var(--color-soft)' }}
            />
            <p className="text-[11px] mb-5" style={{ color: 'var(--color-dim)' }}>
              {profile?.email}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setProfileOpen(false)}
                className="flex-1 h-12 rounded-2xl text-sm font-semibold"
                style={{ background: 'var(--color-card2)', color: 'var(--color-mid)', border: '1px solid var(--color-rim)' }}
              >
                Отмена
              </button>
              <button
                onClick={save}
                disabled={saving || !name.trim()}
                className="flex-[2] h-12 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'var(--color-gold)' }}
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
