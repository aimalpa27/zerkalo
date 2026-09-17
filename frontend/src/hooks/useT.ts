import { useStore } from '../store/useStore'
import { I18N } from '../i18n/translations'

type Keys = keyof typeof I18N['ru']

/** Returns a translation function for the current language */
export function useT() {
  const { lang } = useStore()
  return (key: Keys): string => I18N[lang]?.[key] ?? I18N['ru'][key]
}
