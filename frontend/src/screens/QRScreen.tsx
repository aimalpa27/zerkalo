/**
 * QRScreen — подключение к столу по QR-коду.
 * Использует Django API /guest/<token>/.
 *
 * Важно: печатный QR стола ведёт напрямую на
 *   /?slug=<restaurant-slug>&token=<table-token>
 * Поэтому экран обязан автоматически валидировать token и открыть стол без
 * повторного сканирования — это основной production flow для гостя.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Loader, QrCode, X } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { api, mapDjangoMenuItem } from '../lib/api'
import { restoreCartDraft, useStore } from '../store/useStore'
import { useT } from '../hooks/useT'

export function QRScreen() {
  const { set, prevScreen } = useStore()
  const t = useT()
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const autoConnectStartedRef = useRef(false)

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null

    if (scanner) {
      try {
        const state = scanner.getState()
        // Html5Qrcode#getState: 2 = SCANNING, 3 = PAUSED.
        if (state === 2 || state === 3) {
          await scanner.stop()
        }
      } catch {
        // Камера могла уже остановиться при unmount/ошибке браузера.
      }

      try {
        scanner.clear()
      } catch {
        // DOM-контейнер мог уже быть удалён React-ом.
      }
    }

    setScanning(false)
  }, [])

  const connectToTable = useCallback(async (tokenVal: string, expectedSlug?: string | null) => {
    const normalizedToken = tokenVal.trim()
    if (!normalizedToken) {
      setError('Токен стола не указан')
      return
    }

    setLoading(true)
    setError('')

    try {
      const info = await api.guestInfo(normalizedToken)

      // QR содержит и slug, и token. Token является главным идентификатором,
      // но slug дополнительно защищает от случайно/вручную собранной ссылки,
      // где token одного ресторана совмещён со slug другого.
      if (expectedSlug && info.restaurant.slug !== expectedSlug) {
        setError('QR-код не соответствует этому ресторану')
        return
      }

      const guestMenu = info.menu_items
        .filter(i => i.is_available && i.is_visible)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(mapDjangoMenuItem)
      const restored = restoreCartDraft(info.restaurant.id, info.table.token, guestMenu)

      set({
        tableRestaurant: info.restaurant as any,
        currentRestaurant: info.restaurant as any,
        tableId: info.table.id,
        tableNumber: info.table.number,
        tableToken: info.table.token,
        categories: info.categories as any,
        menuItems: guestMenu,
        menuLoadState: 'ready',
        menuLoadError: null,
        menuLastUpdatedAt: Date.now(),
        selectedCat: null,
        cart: restored?.cart ?? {},
        cartNotes: restored?.cartNotes ?? {},
        activeSession: null,
        currentScreen: 'table',
        prevScreen: 'qr',
      })
    } catch (e: any) {
      if (e?.status === 404) {
        setError('Этот QR-код недействителен или стол отключён. Попросите сотрудника ресторана помочь.')
      } else {
        setError(e?.data?.detail ?? e?.message ?? 'Не удалось подключиться к столу')
      }
    } finally {
      setLoading(false)
    }
  }, [set])

  const handleQRResult = useCallback(async (text: string) => {
    await stopCamera()

    try {
      const url = new URL(text, window.location.origin)
      const qToken = url.searchParams.get('token')?.trim() ?? ''
      const slug = url.searchParams.get('slug')?.trim() || null

      if (!qToken) {
        setError('QR-код не содержит токена стола')
        return
      }

      setToken(qToken)
      await connectToTable(qToken, slug)
    } catch {
      setError('Не удалось распознать QR-код')
    }
  }, [connectToTable, stopCamera])

  const startCamera = async () => {
    setError('')
    setScanning(true)
    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        decodedText => { void handleQRResult(decodedText) },
        () => {},
      )
    } catch (e: any) {
      scannerRef.current = null
      setScanning(false)

      const message = String(e?.message ?? e ?? '')
      if (/permission|notallowed/i.test(message)) {
        setError('Нет разрешения на камеру. Разрешите доступ в настройках браузера или используйте QR-ссылку.')
      } else {
        setError('Не удалось открыть камеру' + (message ? `: ${message}` : ''))
      }
    }
  }

  // Основной flow: пользователь сканирует напечатанный QR обычной камерой
  // телефона и браузер открывает URL. Не заставляем его сканировать второй раз.
  // Ref защищает от двойного вызова эффекта в React.StrictMode.
  useEffect(() => {
    if (autoConnectStartedRef.current) return

    const params = new URLSearchParams(window.location.search)
    const qToken = params.get('token')?.trim() ?? ''
    const slug = params.get('slug')?.trim() || null

    if (!qToken) return

    autoConnectStartedRef.current = true
    setToken(qToken)
    void connectToTable(qToken, slug)
  }, [connectToTable])

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current
      scannerRef.current = null
      if (!scanner) return

      try {
        const maybePromise = scanner.stop()
        if (maybePromise && typeof maybePromise.catch === 'function') {
          void maybePromise.catch(() => undefined)
        }
      } catch {
        // no-op
      }
    }
  }, [])

  return (
    <div className="px-5 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => { void stopCamera(); set({ currentScreen: prevScreen }) }}
          className="w-9 h-9 rounded-full bg-card border border-rim flex items-center justify-center"
          aria-label="Назад"
        >
          <ArrowLeft size={16} className="text-soft" />
        </button>
        <h2 className="text-lg font-bold text-soft">{t('connect_title')}</h2>
      </div>

      {loading && !scanning ? (
        <div className="py-16 flex flex-col items-center justify-center gap-4">
          <Loader size={32} className="animate-spin text-gold" />
          <div className="text-center">
            <p className="font-semibold text-soft">Подключаем стол…</p>
            <p className="text-xs text-mid mt-1">Проверяем QR-код и загружаем меню</p>
          </div>
        </div>
      ) : scanning ? (
        <div className="relative mb-6">
          <div id="qr-reader" className="w-full rounded-2xl overflow-hidden" />
          <button
            onClick={() => { void stopCamera() }}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center"
            aria-label="Закрыть камеру"
          >
            <X size={18} className="text-white" />
          </button>
        </div>
      ) : (
        <>
          <div className="w-24 h-24 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-5">
            <QrCode size={40} className="text-gold" />
          </div>
          <p className="text-center text-soft text-sm mb-8 leading-relaxed">{t('qr_hint')}</p>
          <button
            onClick={startCamera}
            className="w-full bg-gold-gradient rounded-2xl py-4 font-bold text-bg text-sm mb-6 shadow-gold flex items-center justify-center gap-2"
          >
            <QrCode size={18} />
            {t('open_camera')}
          </button>
        </>
      )}

      {!loading && (
        <>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-rim" />
            <span className="text-soft text-xs opacity-50">{t('or_manual')}</span>
            <div className="flex-1 h-px bg-rim" />
          </div>

          <div className="flex flex-col gap-3">
            <input
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Токен стола"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-card border border-rim rounded-2xl px-4 py-3.5 text-soft text-sm outline-none focus:border-gold transition-colors placeholder:text-soft placeholder:opacity-40"
              onKeyDown={e => {
                if (e.key === 'Enter' && token.trim()) void connectToTable(token)
              }}
            />

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                <p className="text-red-300 text-xs text-center leading-relaxed">{error}</p>
              </div>
            )}

            <button
              onClick={() => { void connectToTable(token) }}
              disabled={!token.trim()}
              className="w-full bg-gold-gradient rounded-2xl py-4 font-bold text-bg text-sm shadow-gold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {t('connect_btn')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
