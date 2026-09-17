import { useCallback } from 'react'

/** Короткий звуковой сигнал через Web Audio API (без аудиофайлов). */
export function useAudioAlert(frequency = 880, beeps: number[] = [0, 200, 400]) {
  const play = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      beeps.forEach((delayMs) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = frequency
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delayMs / 1000)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delayMs / 1000 + 0.18)
        osc.start(ctx.currentTime + delayMs / 1000)
        osc.stop(ctx.currentTime + delayMs / 1000 + 0.18)
      })
    } catch {
      // Web Audio недоступен — молча игнорируем
    }
  }, [frequency, beeps.join(',')])

  return play
}
