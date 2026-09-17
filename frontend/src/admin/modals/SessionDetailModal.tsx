import React from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'
import { normalizeStatus } from '../../lib/itemStatus'

export default function SessionDetailModal() {
  const { allSessions, sessionDetailId, djangoRestId, isAdmin, rest,
          setSessionDetail, showToast, showConfirm } = useAdminStore()

  const s = allSessions.find(x => x.id === sessionDetailId)
  if (!s) return null

  const items = (s.items ?? []).filter(i => i.status !== 'cancelled')
  const isPaying = s.status === 'payment_requested'
  const canClose = isPaying && (isAdmin || !!rest?.allowWaiterClose)

  // Пер-item подтверждение: awaiting_confirmation → confirmed. Бэкенд проставит
  // confirmed_at и пересчитает итоги (позиция входит в счёт).
  const acceptItem = async (itemId: string) => {
    if (!djangoRestId) return
    try {
      await api.updateItemStatus(djangoRestId, s.id, itemId, 'confirmed')
      useAdminStore.getState().updateItemsStatus(s.id, [itemId], 'confirmed')
      showToast('Принято ✓')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const rejectItem = async (itemId: string) => {
    if (!djangoRestId) return
    try {
      await api.updateItemStatus(djangoRestId, s.id, itemId, 'rejected')
      useAdminStore.getState().updateItemsStatus(s.id, [itemId], 'rejected')
      showToast('Отклонено')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const markItemServed = async (itemId: string) => {
    if (!djangoRestId) return
    try {
      await api.updateItemStatus(djangoRestId, s.id, itemId, 'served')
      useAdminStore.getState().updateItemsStatus(s.id, [itemId], 'served')
      showToast('Подано ✓')
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const reqPay = async () => {
    if (!djangoRestId) return
    try {
      await api.patchSessionStatus(djangoRestId, s.id, 'payment_requested')
      showToast('Запрос оплаты отправлен')
      setSessionDetail(null)
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    }
  }

  const closeS = () => {
    showConfirm('Закрыть счёт?', async () => {
      if (!djangoRestId) return
      try {
        await api.closeSession(djangoRestId, s.id, s.paymentMethod || 'cash')
        showToast('Счёт закрыт')
        setSessionDetail(null)
      } catch (e: any) {
        showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
      }
    })
  }

  const stStyle = (rawStatus: string) => {
    const n = normalizeStatus(rawStatus)
    if (n === 'ready')                 return { bg: 'rgba(76,175,80,.12)',  color: 'var(--color-green)' }
    if (n === 'served')                return { bg: 'rgba(255,107,26,.1)',  color: 'var(--color-gold2)' }
    if (n === 'awaiting_confirmation') return { bg: 'rgba(255,107,26,.15)', color: 'var(--color-gold)' }
    if (n === 'rejected')              return { bg: 'rgba(239,68,68,.12)',  color: 'var(--color-red)' }
    return                                    { bg: 'rgba(245,158,11,.12)', color: 'var(--color-orange)' }
  }
  const stLabel = (rawStatus: string) => {
    const n = normalizeStatus(rawStatus)
    if (n === 'ready')                 return 'Готово'
    if (n === 'served')                return 'Подано'
    if (n === 'awaiting_confirmation') return 'Ждёт подтверждения'
    if (n === 'rejected')              return 'Отклонён'
    return 'Готовится'
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={() => setSessionDetail(null)} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl max-h-[85vh] flex flex-col"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <p className="text-lg font-bold" style={{ color: 'var(--color-soft)' }}>
            Стол №{s.tableNumber}
          </p>
          <button onClick={() => setSessionDetail(null)}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-card2)' }}>
            <X size={16} style={{ color: 'var(--color-mid)' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5">
          {items.map((it, i) => {
            const c = stStyle(it.status)
            const n = normalizeStatus(it.status)
            const awaiting = n === 'awaiting_confirmation'
            const readyToServe = n === 'ready'
            return (
              <div key={i} className="flex items-start py-3 gap-2"
                   style={{ borderBottom: i < items.length - 1 ? '1px solid var(--color-rim)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--color-soft)' }}>
                    {it.itemName} ×{it.quantity}
                  </p>
                  {it.note && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-gold2)' }}>
                      📝 {it.note}
                    </p>
                  )}
                  {awaiting && (
                    <p className="text-[10px] mt-0.5 font-semibold" style={{ color: 'var(--color-gold)' }}>
                      не входит в счёт
                    </p>
                  )}
                  {n === 'rejected' && it.rejectReason && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-red)' }}>
                      {it.rejectReason}
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg mx-3"
                      style={{ background: c.bg, color: c.color }}>
                  {stLabel(it.status)}
                </span>
                {awaiting && it.id && (
                  <div className="flex gap-1.5 mr-2 flex-shrink-0">
                    <button onClick={() => rejectItem(it.id!)}
                      className="h-7 px-2 rounded-lg text-[10px] font-bold"
                      style={{ background: 'rgba(239,68,68,.12)', color: 'var(--color-red)' }}>
                      ✕
                    </button>
                    <button onClick={() => acceptItem(it.id!)}
                      className="h-7 px-2 rounded-lg text-[10px] font-bold text-black"
                      style={{ background: 'var(--color-gold)' }}>
                      ✓
                    </button>
                  </div>
                )}
                {readyToServe && it.id && (
                  <button onClick={() => markItemServed(it.id!)}
                    className="h-7 px-2.5 rounded-lg text-[10px] font-bold mr-2 flex-shrink-0"
                    style={{ background: 'var(--color-card2)', color: 'var(--color-mid)',
                             border: '1px solid var(--color-rim)' }}>
                    Подано
                  </button>
                )}
                <span className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--color-soft)' }}>
                  {(it.price * it.quantity).toLocaleString('ru')} ₸
                </span>
              </div>
            )
          })}

          {/* Totals */}
          <div className="py-4 mt-2 rounded-2xl px-4 mb-4"
               style={{ background: 'var(--color-card2)' }}>
            {[
              { l: 'Подитог', v: s.subtotalAmount },
              { l: `Сервис ${s.serviceChargePercent}%`, v: s.serviceChargeAmount },
            ].map(({ l, v }) => (
              <div key={l} className="flex justify-between text-sm py-1">
                <span style={{ color: 'var(--color-mid)' }}>{l}</span>
                <span style={{ color: 'var(--color-mid)' }}>{(v ?? 0).toLocaleString('ru')} ₸</span>
              </div>
            ))}
            <div className="h-px my-2" style={{ background: 'var(--color-rim)' }} />
            <div className="flex justify-between font-bold">
              <span style={{ color: 'var(--color-soft)' }}>Итого</span>
              <span className="text-lg" style={{ color: 'var(--color-gold)' }}>
                {(s.totalAmount ?? 0).toLocaleString('ru')} ₸
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0"
             style={{ borderTop: '1px solid var(--color-rim)' }}>
          {!isPaying ? (
            <button onClick={reqPay}
              className="flex-1 h-14 rounded-2xl text-sm font-bold text-black"
              style={{ background: 'var(--color-gold)' }}>
              Запросить оплату
            </button>
          ) : canClose ? (
            <button onClick={closeS}
              className="flex-1 h-14 rounded-2xl text-sm font-bold"
              style={{ background: 'rgba(76,175,80,.15)', color: 'var(--color-green)',
                       border: '1px solid rgba(76,175,80,.25)' }}>
              ✓ Закрыть счёт
            </button>
          ) : (
            <p className="flex-1 text-center text-sm py-4" style={{ color: 'var(--color-mid)' }}>
              Ожидание оплаты...
            </p>
          )}
        </div>
      </motion.div>
    </>
  )
}
