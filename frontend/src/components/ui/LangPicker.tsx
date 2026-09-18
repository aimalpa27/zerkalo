import { useState } from 'react'
import { LANGS } from '../../i18n/translations'
import { useStore } from '../../store/useStore'
import type { Lang } from '../../types'

export function LangPicker({ onConfirm }: { onConfirm: () => void }) {
  const { lang, set } = useStore()
  const [picked, setPicked] = useState<Lang>(lang)

  const confirm = () => {
    localStorage.setItem('cafe_lang', picked)
    set({ lang: picked })
    onConfirm()
  }

  return (
    <div className="fixed inset-0 bg-bg z-[9999] flex flex-col items-center justify-center px-6">
      <div className="text-5xl mb-4">🍽</div>
      <h1 className="font-display text-2xl font-bold text-soft mb-2 text-center">
        Добро пожаловать
      </h1>
      <p className="text-mid text-sm mb-8 text-center">Choose your language · Тілді таңдаңыз</p>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-6">
        {LANGS.map(l => (
          <button
            key={l.code}
            onClick={() => setPicked(l.code)}
            className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
              picked === l.code
                ? 'border-gold bg-gold/10 shadow-gold'
                : 'border-rim bg-card'
            }`}
          >
            <span className="text-2xl">{l.flag}</span>
            <span className="text-sm font-semibold text-soft">{l.name}</span>
          </button>
        ))}
      </div>

      <button
        onClick={confirm}
        className="w-full max-w-xs h-13 bg-gold-gradient rounded-2xl text-bg font-bold text-sm tracking-wider shadow-gold"
      >
        Продолжить · Continue
      </button>
    </div>
  )
}