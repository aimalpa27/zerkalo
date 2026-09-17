import { useEffect, useState } from 'react'

let _show: (msg: string) => void = () => {}
export const showToast = (msg: string) => _show(msg)

export function Toast() {
  const [msg, setMsg]       = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    _show = (m: string) => {
      setMsg(m)
      setVisible(true)
      setTimeout(() => setVisible(false), 3000)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl bg-gold text-bg font-bold text-sm shadow-deep animate-fade-in whitespace-nowrap max-w-[90vw] text-center">
      {msg}
    </div>
  )
}