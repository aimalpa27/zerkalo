import { useCallback } from 'react'

export function useAudioAlert() {
  const play = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      // три коротких бипа на 880 Hz
      ;[0, 200, 400].forEach((delayMs) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delayMs / 1000)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delayMs / 1000 + 0.18)
        osc.start(ctx.currentTime + delayMs / 1000)
        osc.stop(ctx.currentTime + delayMs / 1000 + 0.18)
      })
    } catch {
      // Web Audio недоступен — молча игнорируем
    }
  }, [])

  return play
}
