import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { useSAStore } from '../store'

export default function Toast() {
  const { toastMsg, toastVisible } = useSAStore()

  return (
    <AnimatePresence>
      {toastVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl z-50 text-sm font-medium flex items-center gap-2 max-w-[90vw]"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)', color: 'var(--color-text, var(--color-soft))', boxShadow: 'var(--card-shadow)' }}
        >
          <CheckCircle2 size={16} style={{ color: 'var(--color-gold)', flexShrink: 0 }} />
          <span className="truncate">{toastMsg}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
