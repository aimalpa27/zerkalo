import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAdminStore } from '../store'

export default function AlertModal() {
  const { alert, closeAlert } = useAdminStore()

  return (
    <AnimatePresence>
      {alert.open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm"
            onClick={closeAlert}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[401] mx-auto max-w-sm p-6 rounded-3xl"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)' }}
          >
            <p className="text-base font-semibold mb-6 text-center" style={{ color: 'var(--color-soft)' }}>
              {alert.message}
            </p>
            <button
              onClick={closeAlert}
              className="w-full h-12 rounded-2xl text-sm font-bold text-white"
              style={{ background: 'var(--color-gold)' }}
            >
              Понятно
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
