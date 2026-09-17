import React, { useEffect, useRef } from 'react'
import { useKitchenStore } from '../store'
import type { TableSession } from '../../types'

interface Props {
  visible: boolean
}

export default function NewOrderBanner({ visible }: Props) {
  return (
    <div
      className="new-order-banner"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(-100%)' }}
    >
      🔔 НОВЫЙ ЗАКАЗ
    </div>
  )
}
