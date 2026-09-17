import React from 'react'
import { mapDjangoMenuItem, type DjangoMenuItem } from '../../lib/api'
import MenuManager from '../../components/menu/MenuManager'
import { useAdminStore } from '../store'

export default function MenuTab() {
  const { djangoRestId, showToast, setMenuItems } = useAdminStore()

  if (!djangoRestId) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <span className="text-4xl opacity-30">🍽️</span>
        <p className="text-sm" style={{ color: 'var(--color-dim)' }}>Ресторан не найден</p>
      </div>
    )
  }

  const handleItemsChange = (items: DjangoMenuItem[]) => {
    setMenuItems(items.map(mapDjangoMenuItem))
  }

  return (
    <div className="px-4 py-5">
      <p className="text-[10px] tracking-[3px] uppercase font-medium mb-5"
         style={{ color: 'rgba(255,107,26,.6)' }}>Меню</p>

      <MenuManager restId={djangoRestId} onToast={showToast} onItemsChange={handleItemsChange} />
    </div>
  )
}
