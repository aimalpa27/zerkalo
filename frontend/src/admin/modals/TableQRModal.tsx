import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Download, Printer, RefreshCw } from 'lucide-react'
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { api } from '../../lib/api'
import { useAdminStore } from '../store'
import type { Table } from '../../types'

// Ссылка стола: гостевое меню и админка на одном хостинге → берём origin из адресной строки
const tableUrl = (slug: string, table: Table) =>
  `${window.location.origin}/?slug=${slug}&token=${table.token}`

const tableFileName = (table: Table) =>
  `table-${String(table.number).padStart(2, '0')}-qr.png`

export default function TableQRModal() {
  const { tables, rest, djangoRestId, qrTableId, setQrTableId, setTables, showToast, showConfirm } = useAdminStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [printing, setPrinting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const table = tables.find(t => t.id === qrTableId)

  // Печать: даём React дорисовать печатный блок, затем открываем диалог печати
  useEffect(() => {
    if (!printing) return
    const timer = setTimeout(() => window.print(), 60)
    const onAfterPrint = () => setPrinting(false)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [printing])

  if (!table) return null

  const url = tableUrl(rest?.slug ?? '', table)
  const close = () => setQrTableId(null)

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const png = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = png
    a.download = tableFileName(table)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const regenerate = () => {
    showConfirm(
      `Старый QR-код стола №${table.number} перестанет работать. Перегенерировать токен?`,
      async () => {
        if (!djangoRestId) return
        setRegenerating(true)
        try {
          const updated = await api.regenerateTableToken(djangoRestId, table.id)
          // Оптимистично обновляем токен стола в сторе — QR перерисуется сразу,
          // не дожидаясь следующего опроса api.tables().
          setTables(tables.map(t => (t.id === table.id ? { ...t, ...updated } : t)) as any)
          showToast('Токен обновлён ✓')
        } catch (e: any) {
          showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
        } finally {
          setRegenerating(false)
        }
      }
    )
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={close} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[201] rounded-t-3xl max-h-[90vh] flex flex-col"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <p className="text-lg font-bold" style={{ color: 'var(--color-soft)' }}>
            QR стола №{table.number}
          </p>
          <button onClick={close}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-card2)' }}>
            <X size={16} style={{ color: 'var(--color-mid)' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-2 flex flex-col items-center">
          {/* Превью — всегда чёрный на белом, независимо от темы, для надёжного сканирования */}
          <div className="rounded-3xl p-5 mb-4" style={{ background: '#ffffff' }}>
            <QRCodeCanvas
              ref={canvasRef}
              value={url}
              size={480}
              level="H"
              marginSize={4}
              fgColor="#000000"
              bgColor="#ffffff"
              title={`QR стола №${table.number}`}
              style={{ width: 220, height: 220, display: 'block' }}
            />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-soft)' }}>
            {rest?.name ?? 'Ресторан'}
          </p>
          <p className="text-[11px] mt-1 mb-3 break-all text-center" style={{ color: 'var(--color-dim)' }}>
            {url}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-5 py-4 flex-shrink-0"
             style={{ borderTop: '1px solid var(--color-rim)' }}>
          <div className="flex gap-3">
            <button onClick={download}
              className="flex-1 h-14 rounded-2xl text-sm font-bold text-black flex items-center justify-center gap-2 transition-all active:scale-[.98]"
              style={{ background: 'var(--color-gold)' }}>
              <Download size={16} /> Скачать PNG
            </button>
            <button onClick={() => setPrinting(true)}
              className="flex-1 h-14 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[.98]"
              style={{ background: 'var(--color-card2)', color: 'var(--color-soft)',
                       border: '1px solid var(--color-rim)' }}>
              <Printer size={16} /> Печать
            </button>
          </div>
          <button onClick={regenerate} disabled={regenerating}
            className="h-12 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[.98]"
            style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
                     color: 'var(--color-red)' }}>
            <RefreshCw size={15} /> {regenerating ? 'Обновляем...' : 'Перегенерировать токен'}
          </button>
        </div>
      </motion.div>

      {/* Печатная страница — скрыта, показывается только через @media print */}
      {printing && (
        <div className="adm-qr-print">
          <div className="adm-qr-card" style={{ width: '100%', minHeight: '100vh' }}>
            <p className="adm-qr-restaurant">{rest?.name ?? ''}</p>
            <QRCodeSVG value={url} size={260} level="H" marginSize={4}
              fgColor="#000000" bgColor="#ffffff" title={`QR стола №${table.number}`} />
            <p className="adm-qr-tablenum">Стол №{table.number}</p>
          </div>
        </div>
      )}
    </>
  )
}
