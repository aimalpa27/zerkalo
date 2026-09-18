export type PwaUpdateListener = (registration: ServiceWorkerRegistration) => void

let waitingRegistration: ServiceWorkerRegistration | null = null
let listeners: PwaUpdateListener[] = []

const emitWaiting = (registration: ServiceWorkerRegistration) => {
  waitingRegistration = registration
  listeners.forEach((listener) => listener(registration))
}

export function onPwaUpdate(listener: PwaUpdateListener) {
  listeners.push(listener)
  if (waitingRegistration) listener(waitingRegistration)
  return () => { listeners = listeners.filter((item) => item !== listener) }
}

export async function registerPlaitServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  if (registration.waiting) emitWaiting(registration)

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    if (!worker) return
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) emitWaiting(registration)
    })
  })

  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}

export function applyPwaUpdate(registration = waitingRegistration) {
  registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
}
