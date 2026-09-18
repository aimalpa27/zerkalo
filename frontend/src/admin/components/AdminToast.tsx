import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAdminStore } from '../store'

export default function AdminToast() {
  const { toastMsg, toastVisible } = useAdminStore()

  return (
    <AnimatePresence>
      {toastVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl text-sm font-medium text-center max-w-[calc(100vw-32px)] pointer-events-none"
          style={{
            background: 'var(--color-card2)',
            border: '1px solid var(--color-rim)',
            color: 'var(--color-soft)',
            boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          }}
        >
          {toastMsg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}