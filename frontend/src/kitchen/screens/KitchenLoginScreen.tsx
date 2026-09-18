import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { api, tokenStore } from '../../lib/api'
import { useKitchenStore } from '../store'
import type { Station } from '../store'

const STATIONS: { id: Station; label: string; emoji: string }[] = [
  { id: 'kitchen', label: 'Кухня',      emoji: '🍳' },
  { id: 'bar',     label: 'Бар',        emoji: '🍹' },
  { id: 'all',     label: 'Все заказы', emoji: '📋' },
]

export default function KitchenLoginScreen() {
  const { station, setStation, setScreen, setRest } = useKitchenStore()
  const [email, setEmail]     = useState('')
  const [pass,  setPass]      = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const login = async () => {
    if (!email.trim()) { setError('Введите email');  return }
    if (!pass)         { setError('Введите пароль'); return }
    setLoading(true)
    setError('')

    try {
      const jwt = await api.login(email.trim(), pass)
      if (jwt.user.role !== 'kitchen') {
        tokenStore.clear()
        setError('Для кухонного табло нужна отдельная учётная запись с ролью «Кухня».')
        setLoading(false)
        return
      }
      tokenStore.setTokens(jwt.access, jwt.refresh)

      const restId   = jwt.user.restaurant_id ?? ''
      const restName = restId
        ? await api.restaurantById(restId).then(r => r.name).catch(() => '')
        : ''

      if (!restId) {
        setError('У вас не назначен ресторан. Обратитесь к администратору.')
        setLoading(false)
        return
      }

      setRest(restId, restName)
      setScreen('loading')
    } catch (e: any) {
      setError(e?.data?.detail ?? e?.message ?? 'Ошибка входа')
      setLoading(false)
    }
  }

  return (
    <div className="kitchen-login">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="kitchen-login__card"
      >
        <div className="kitchen-login__logo">
          <img src="/icon_512.png" alt="Plait" style={{ width: 64, height: 64, objectFit: 'contain' }} />
          <span className="kitchen-login__brand">Plait</span>
        </div>

        <h1 className="kitchen-login__title">Кухонное табло</h1>
        <p className="kitchen-login__sub">Войдите для начала работы</p>

        {/* Выбор станции */}
        <div className="kitchen-login__stations">
          {STATIONS.map(({ id, label, emoji }) => (
            <button
              key={id}
              onClick={() => setStation(id)}
              className={`station-btn ${station === id ? 'station-btn--active' : ''}`}
            >
              <span>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="kitchen-login__form">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            autoCapitalize="none"
            autoCorrect="off"
            className="kitchen-input"
            onKeyDown={e => e.key === 'Enter' && login()}
          />
          <input
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            placeholder="Пароль"
            className="kitchen-input"
            onKeyDown={e => e.key === 'Enter' && login()}
          />

          {error && <p className="kitchen-login__error">{error}</p>}

          <button
            onClick={login}
            disabled={loading}
            className="kitchen-login__btn"
          >
            {loading ? <><span className="spin" /> Входим...</> : 'Войти'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
