import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAdminStore } from '../store'

export default function ConfirmModal() {
  const { confirm, closeConfirm } = useAdminStore()

  const handle = () => {
    confirm.onConfirm()
    closeConfirm()
  }

  return (
    <AnimatePresence>
      {confirm.open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm"
            onClick={closeConfirm}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[401] mx-auto max-w-sm p-6 rounded-3xl"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
          >
            <p className="text-base font-semibold mb-6 text-center"
               style={{ color: 'var(--color-soft)' }}>
              {confirm.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={closeConfirm}
                className="flex-1 h-12 rounded-2xl text-sm font-semibold"
                style={{ background: 'var(--color-card2)', color: 'var(--color-mid)',
                         border: '1px solid var(--color-rim)' }}
              >
                Отмена
              </button>
              <button
                onClick={handle}
                className="flex-[2] h-12 rounded-2xl text-sm font-bold text-white"
                style={{ background: 'var(--color-red)' }}
              >
                Подтвердить
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}