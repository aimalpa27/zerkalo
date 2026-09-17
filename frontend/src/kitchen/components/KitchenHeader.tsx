import React, { useState, useEffect } from 'react'
import { LogOut, Sun, Moon } from 'lucide-react'
import { api, tokenStore } from '../../lib/api'
import { useKitchenStore } from '../store'
import type { Station } from '../store'

const STATION_LABELS: Record<Station, string> = {
  kitchen: '🍳 кухня',
  bar:     '🍹 бар',
  all:     '📋 все заказы',
}

const TAB_BTNS: { id: Station; label: string }[] = [
  { id: 'all',     label: 'Все'    },
  { id: 'kitchen', label: 'Кухня'  },
  { id: 'bar',     label: 'Бар'    },
]

interface Props {
  onlineCount: number
  readyCount: number
}

export default function KitchenHeader({ onlineCount, readyCount }: Props) {
  const { station, restName, setStation, reset } = useKitchenStore()
  const [time, setTime] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [isLight, setIsLight] = useState(() => localStorage.getItem('kitchen_theme') === 'light')

  useEffect(() => {
    const tick = () => setTime(
      new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('theme-light', isLight)
    localStorage.setItem('kitchen_theme', isLight ? 'light' : 'dark')
  }, [isLight])

  const logout = async () => {
    try { await api.logout() } catch {}
    tokenStore.clear()
    reset()
  }

  return (
    <header className="kitchen-header">
      {/* Левая часть: лого + ресторан */}
      <div className="kitchen-header__left">
        <span className="kitchen-header__logo">Plait</span>
        <span className="kitchen-header__station">{STATION_LABELS[station]}</span>
        {restName && (
          <span className="kitchen-header__rest">{restName}</span>
        )}
      </div>

      {/* Центр: табы фильтрации */}
      <div className="kitchen-header__tabs">
        {TAB_BTNS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setStation(id)}
            className={`kitchen-tab ${station === id ? 'kitchen-tab--active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Правая часть: часы + статус + выход */}
      <div className="kitchen-header__right">
        <span
          className="kitchen-conn"
          style={{ color: online ? 'var(--color-green)' : 'var(--color-red)' }}
        >
          ● {online ? 'онлайн' : 'офлайн'}
        </span>
        <span className="kitchen-clock">{time}</span>
        <button
          onClick={() => setIsLight(v => !v)}
          className="kitchen-logout"
          title={isLight ? 'Тёмная тема' : 'Светлая тема'}
        >
          {isLight ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button onClick={logout} className="kitchen-logout" title="Выйти">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
