import React, { useRef, useState } from 'react'
import { FileSpreadsheet, Upload, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { api, type MenuImportResult } from '../../lib/api'

export default function MenuImportModal({ restId, onClose, onImported, onToast }: {
  restId: string; onClose: () => void; onImported: () => Promise<void> | void; onToast: (msg:string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<MenuImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const choose = async (next: File | null) => {
    setFile(next); setPreview(null); setError('')
    if (!next) return
    if (!/\.(csv|xlsx)$/i.test(next.name)) { setError('Поддерживаются только CSV и XLSX.'); return }
    setBusy(true)
    try { setPreview(await api.importMenu(restId, next, true)) }
    catch (e:any) { setError(e?.data?.detail || e?.data?.errors?.[0]?.message || 'Не удалось проверить файл') }
    finally { setBusy(false) }
  }
  const commit = async () => {
    if (!file || !preview?.valid || busy) return
    setBusy(true); setError('')
    try {
      const result = await api.importMenu(restId, file, false)
      await onImported(); onToast(`Импортировано блюд: ${result.created ?? 0}`); onClose()
    } catch (e:any) { setError(e?.data?.detail || 'Импорт не выполнен. Данные не изменены.') }
    finally { setBusy(false) }
  }
  return <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5" style={{background:'var(--color-card)', color:'var(--color-soft)'}}>
      <div className="flex items-center justify-between gap-3 mb-4"><div><h2 className="font-bold text-lg flex items-center gap-2"><FileSpreadsheet size={20}/> Импорт меню</h2><p className="text-xs mt-1" style={{color:'var(--color-mid)'}}>CSV/XLSX · обязательные колонки: Название и Цена · до 1000 блюд</p></div><button onClick={onClose}><X/></button></div>
      <input ref={input} type="file" accept=".csv,.xlsx" className="hidden" onChange={e=>choose(e.target.files?.[0]||null)}/>
      <button onClick={()=>input.current?.click()} disabled={busy} className="w-full border-2 border-dashed rounded-2xl p-5 flex flex-col items-center gap-2 disabled:opacity-50" style={{borderColor:'var(--color-rim)'}}><Upload/><b>{file?.name || 'Выбрать CSV или XLSX'}</b><span className="text-xs" style={{color:'var(--color-mid)'}}>Категория, Описание, Вес, Станция, Доступно, Видимо — необязательные</span></button>
      {busy && <div className="py-5 text-center text-sm">Проверяем файл…</div>}
      {error && <div className="mt-4 p-3 rounded-xl flex gap-2 text-sm" style={{background:'rgba(239,68,68,.1)',color:'var(--color-red)'}}><AlertTriangle size={18}/>{error}</div>}
      {preview && <div className="mt-4 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center"><div className="adm-card p-3"><b>{preview.will_create}</b><p className="text-[11px]">будет создано</p></div><div className="adm-card p-3"><b>{preview.will_skip}</b><p className="text-[11px]">уже есть</p></div><div className="adm-card p-3"><b>{preview.errors.length}</b><p className="text-[11px]">ошибок</p></div></div>
        {preview.errors.length>0 && <div className="p-3 rounded-xl text-xs" style={{background:'rgba(239,68,68,.08)'}}>{preview.errors.slice(0,10).map(e=><p key={`${e.row}-${e.field}`}>Строка {e.row}: {e.message}</p>)}</div>}
        {preview.preview.length>0 && <div className="overflow-x-auto rounded-xl border" style={{borderColor:'var(--color-rim)'}}><table className="w-full text-xs"><thead><tr><th className="p-2 text-left">Блюдо</th><th className="p-2 text-left">Категория</th><th className="p-2 text-right">Цена</th></tr></thead><tbody>{preview.preview.slice(0,12).map(r=><tr key={r.row} className="border-t" style={{borderColor:'var(--color-rim)'}}><td className="p-2">{r.name}</td><td className="p-2">{r.category||'—'}</td><td className="p-2 text-right">{r.price} ₸</td></tr>)}</tbody></table></div>}
        {preview.valid && <div className="flex items-center gap-2 text-xs"><CheckCircle2 size={16}/> Проверка пройдена. Импорт выполняется одной транзакцией.</div>}
      </div>}
      <div className="flex gap-2 mt-5"><button onClick={onClose} className="flex-1 py-3 rounded-xl" style={{background:'var(--color-card2)'}}>Отмена</button><button onClick={commit} disabled={!preview?.valid || preview.will_create===0 || busy} className="flex-1 py-3 rounded-xl font-bold disabled:opacity-40" style={{background:'var(--color-gold)',color:'#fff'}}>{busy?'Импорт…':`Импортировать ${preview?.will_create ?? ''}`}</button></div>
    </div>
  </div>
}
