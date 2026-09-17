import React from 'react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'

export default function CallsTab() {
  const { calls, djangoRestId, showToast, operationalLoadState, operationalLoadError, operationalLastUpdatedAt, requestOperationalReload } = useAdminStore()

  const accept = async (id: string) => {
    if (!djangoRestId) return
    try {
      await api.updateWaiterCall(djangoRestId, id, 'accepted')
      showToast('Иду к столу')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const close = async (id: string) => {
    if (!djangoRestId) return
    try {
      await api.updateWaiterCall(djangoRestId, id, 'closed')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  return (
    <div className="px-4 py-5">
      <p className="text-[10px] tracking-[3px] uppercase font-medium mb-5"
         style={{ color: 'rgba(255,107,26,.6)' }}>Вызовы</p>

      {operationalLoadState === 'error' && (
        <div className="adm-card p-4 mb-4 flex items-center justify-between gap-3" style={{ border: '1px solid rgba(255,107,26,.35)' }}>
          <div><p className="text-sm font-bold" style={{ color:'var(--color-soft)' }}>Вызовы могут быть неактуальны</p><p className="text-xs mt-1" style={{ color:'var(--color-mid)' }}>{operationalLoadError}</p></div>
          <button onClick={requestOperationalReload} className="h-9 px-3 rounded-xl text-xs font-bold flex-shrink-0" style={{ background:'var(--color-gold)', color:'#000' }}>Повторить</button>
        </div>
      )}
      {operationalLoadState === 'loading' && operationalLastUpdatedAt === null ? (
        <div className="adm-card p-4 text-sm" style={{ color:'var(--color-mid)' }}>⏳ Загружаем вызовы…</div>
      ) : calls.length === 0 && !(operationalLoadState === 'error' && operationalLastUpdatedAt === null) ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <span className="text-4xl opacity-30">🔔</span>
          <p className="text-sm" style={{ color: 'var(--color-dim)' }}>Новых вызовов нет</p>
        </div>
      ) : (
        calls.map(c => (
          <div key={c.id} className="adm-card-pay flex items-center justify-between p-4">
            <div>
              <p className="font-bold text-base" style={{ color: 'var(--color-soft)' }}>
                🔔 Стол №{c.tableNumber}
              </p>
              {c.reason && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-mid)' }}>{c.reason}</p>
              )}
              <p className="text-xs mt-1" style={{ color: 'var(--color-dim)' }}>
                {new Date(c.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => accept(c.id)}
                className="h-9 px-3 rounded-xl text-xs font-semibold transition-all active:scale-90"
                style={{ background: 'var(--color-card2)', color: 'var(--color-mid)',
                         border: '1px solid var(--color-rim)' }}>
                Иду ✓
              </button>
              <button onClick={() => close(c.id)}
                className="h-9 px-3 rounded-xl text-xs font-semibold transition-all active:scale-90"
                style={{ background: 'rgba(76,175,80,.12)', color: 'var(--color-green)',
                         border: '1px solid rgba(76,175,80,.2)' }}>
                Закрыть
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
