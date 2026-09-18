import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAdminStore } from '../store'

export default function CallBanner() {
  const { callBannerVisible, callBannerData, dismissCallBanner } = useAdminStore()

  return (
    <AnimatePresence>
      {callBannerVisible && callBannerData && (
        <motion.div
          initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%' }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="fixed top-0 left-0 right-0 z-[500] flex items-center justify-between px-5"
          style={{
            background: 'var(--color-gold)',
            paddingTop: 'calc(14px + env(safe-area-inset-top))',
            paddingBottom: '14px',
          }}
        >
          <div>
            <p className="font-bold text-base text-black">
              🔔 Вызов — Стол №{callBannerData.tableNumber}
            </p>
            {callBannerData.reason && (
              <p className="text-xs text-black/70 mt-0.5">{callBannerData.reason}</p>
            )}
          </div>
          <button
            onClick={dismissCallBanner}
            className="bg-black/20 rounded-xl px-4 py-2 text-xs font-bold text-black"
          >
            Принял ✓
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}