import React from 'react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'

const ROLE_LABELS: Record<string, string> = {
  waiter: 'Официант', cashier: 'Кассир', manager: 'Менеджер', admin: 'Администратор', kitchen: 'Кухня'
}

export default function StaffTab() {
  const { staff, tables, zones, djangoRestId, rest, isAdmin, showToast, setAddStaffOpen,
          openAssign, showConfirm } = useAdminStore()

  const workers = staff.filter(s => ['waiter', 'cashier', 'manager', 'kitchen'].includes(s.role))

  // Настройки подтверждения заказов официантом (order-confirmation flow).
  const confirmationCfg = rest?.orderConfirmation
  const saveConfirmationCfg = async (patch: Partial<NonNullable<typeof confirmationCfg>>) => {
    if (!djangoRestId) return
    const next = {
      enabled: confirmationCfg?.enabled ?? false,
      reminderAfterSec: confirmationCfg?.reminderAfterSec ?? 60,
      escalateAfterSec: confirmationCfg?.escalateAfterSec ?? 180,
      autoAction: confirmationCfg?.autoAction ?? 'none',
      ...patch,
    }
    try {
      await api.updateRestaurantSettings(djangoRestId, {
        order_confirmation_enabled: next.enabled,
        order_reminder_after_sec: next.reminderAfterSec,
        order_escalate_after_sec: next.escalateAfterSec,
        order_auto_action: next.autoAction,
      })
      useAdminStore.getState().updateRest({ orderConfirmation: next } as any)
      showToast('Сохранено')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const del = (id: string, name: string) => {
    showConfirm(`Удалить ${name || 'сотрудника'}?`, async () => {
      if (!djangoRestId) return
      try {
        await api.deleteStaff(djangoRestId, id)
        showToast('Удалён')
      } catch (e: any) {
        showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
      }
    })
  }

  return (
    <div className="px-4 py-5">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[10px] tracking-[3px] uppercase font-medium"
           style={{ color: 'rgba(255,107,26,.6)' }}>Сотрудники</p>
        <button onClick={() => setAddStaffOpen(true)}
          className="h-9 px-4 rounded-xl text-xs font-bold text-black transition-all active:scale-95"
          style={{ background: 'var(--color-gold)' }}>
          + Добавить
        </button>
      </div>

      {workers.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3">
          <span className="text-4xl opacity-30">👤</span>
          <p className="text-sm" style={{ color: 'var(--color-dim)' }}>Сотрудников нет</p>
        </div>
      ) : (
        workers.map(s => {
          const zNames = (s.assignedZones ?? [])
            .map(zid => zones.find(z => z.id === zid)?.name)
            .filter(Boolean).join(', ')
          const tNames = (s.assignedTables ?? [])
            .map(tid => { const t = tables.find(x => x.id === tid); return t ? `№${(t as any).number}` : null })
            .filter(Boolean).join(', ')
          const assignmentParts = [
            zNames ? `Зоны: ${zNames}` : null,
            tNames ? `Столы: ${tNames}` : null,
          ].filter(Boolean)
          const assignmentLabel = assignmentParts.length
            ? assignmentParts.join(' · ')
            : 'Не назначено — видит все столы'
          return (
            <div key={s.id} className="adm-card flex items-center gap-3 p-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base flex-shrink-0"
                   style={{ background: 'rgba(255,107,26,.12)', border: '1px solid rgba(255,107,26,.2)',
                            color: 'var(--color-gold)' }}>
                {(s.name || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-soft)' }}>
                  {s.name || s.email}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-mid)' }}>
                  {ROLE_LABELS[s.role] ?? s.role} · {s.email}
                </p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--color-gold)' }}>
                  {assignmentLabel}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openAssign(s.id, s.name || '')}
                  className="h-8 px-3 rounded-xl text-xs font-semibold transition-all active:scale-90"
                  style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)',
                           color: 'var(--color-mid)' }}>
                  Столы
                </button>
                <button onClick={() => del(s.id, s.name || '')}
                  className="h-8 px-3 rounded-xl text-xs font-semibold transition-all active:scale-90"
                  style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
                           color: 'var(--color-red)' }}>
                  ✕
                </button>
              </div>
            </div>
          )
        })
      )}

      {/* Подтверждение заказов официантом — только для админа */}
      {isAdmin && (
        <>
          <p className="text-[10px] tracking-[3px] uppercase font-medium mt-8 mb-4"
             style={{ color: 'rgba(255,107,26,.6)' }}>Подтверждение заказов официантом</p>
          <div className="adm-card p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-soft)' }}>
                  Требовать подтверждение официанта
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-mid)' }}>
                  Новые позиции гостя ждут «Принять»/«Отклонить», прежде чем попасть на кухню и в счёт
                </p>
              </div>
              <label className="adm-toggle">
                <input type="checkbox" checked={!!confirmationCfg?.enabled}
                  onChange={e => saveConfirmationCfg({ enabled: e.target.checked })} />
                <span className="adm-toggle-track" />
              </label>
            </div>

            {confirmationCfg?.enabled && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs" style={{ color: 'var(--color-mid)' }}>Напоминание, сек</p>
                  <input type="number" min={0} value={confirmationCfg?.reminderAfterSec ?? 60}
                    onChange={e => saveConfirmationCfg({ reminderAfterSec: parseInt(e.target.value) || 0 })}
                    className="w-20 px-2 py-1.5 rounded-lg text-sm text-right outline-none"
                    style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)',
                             color: 'var(--color-soft)' }} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs" style={{ color: 'var(--color-mid)' }}>Эскалация, сек</p>
                  <input type="number" min={0} value={confirmationCfg?.escalateAfterSec ?? 180}
                    onChange={e => saveConfirmationCfg({ escalateAfterSec: parseInt(e.target.value) || 0 })}
                    className="w-20 px-2 py-1.5 rounded-lg text-sm text-right outline-none"
                    style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)',
                             color: 'var(--color-soft)' }} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs" style={{ color: 'var(--color-mid)' }}>Автодействие по истечении эскалации</p>
                  <select value={confirmationCfg?.autoAction ?? 'none'}
                    onChange={e => saveConfirmationCfg({ autoAction: e.target.value as any })}
                    className="px-2 py-1.5 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)',
                             color: 'var(--color-soft)' }}>
                    <option value="none">Ничего</option>
                    <option value="auto_confirm">Авто-принять</option>
                    <option value="auto_reject">Авто-отклонить</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
