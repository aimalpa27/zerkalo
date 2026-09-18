import { ShoppingCart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { useCart } from '../../hooks/useCart'
import { useT } from '../../hooks/useT'

export function CartBar() {
  const { currentScreen, set } = useStore()
  const { cartTotal, cartCount } = useCart()
  const t = useT()

  const count = cartCount()
  const total = cartTotal()
  const visible = count > 0 && (currentScreen === 'table' || currentScreen === 'restaurant')

  return (
    <AnimatePresence>
      {visible && (
        /* Wrapper handles fixed positioning + centering + desktop sidebar offset.
           motion.div only animates Y — no left/translate conflict. */
        <div className="cart-bar-wrapper">
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={() => set({ cartOpen: true })}
            className="w-full max-w-[448px] bg-gold-gradient rounded-2xl px-5 py-3.5 flex justify-between items-center cursor-pointer shadow-gold pointer-events-auto"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-bg" />
              <span className="text-bg font-bold text-sm">{count} {t('items_label')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-bg font-bold">{total.toLocaleString('ru')} ₸</span>
              <div className="bg-black/20 rounded-lg px-3 py-1 text-bg text-xs font-bold whitespace-nowrap">
                {t('checkout_btn')} →
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
