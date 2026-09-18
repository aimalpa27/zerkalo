import React from 'react'
import MenuManager from '../../components/menu/MenuManager'
import { useSAStore } from '../store'

export default function MenuTab({ restId }: { restId: string }) {
  const { showToast } = useSAStore()
  return <MenuManager restId={restId} onToast={showToast} />
}
