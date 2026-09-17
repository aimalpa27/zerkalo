import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, Pin, PinOff, Send, Trash2, Pencil } from 'lucide-react'
import { api, mapDjangoChatMessage } from '../../lib/api'
import type { ChatMessage } from '../../types'
import { useAdminStore } from '../store'

const MAX_PINNED = 5

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('ru', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function ChatTab() {
  const {
    djangoRestId, rest, profile, isAdmin,
    chatMessages, setChatMessages, markChatRead,
    showToast, showConfirm, setProfileOpen,
  } = useAdminStore()

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  const hasFeature = !!rest?.features?.chat

  // Пока вкладка открыта — держим чат «прочитанным».
  useEffect(() => { if (hasFeature) markChatRead() }, [chatMessages.length, hasFeature])

  // Автоскролл вниз при новых сообщениях.
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages.length])

  const pinned = useMemo(
    () => chatMessages.filter(m => m.isPinned).sort((a, b) => (a.pinnedAt ?? 0) - (b.pinnedAt ?? 0)),
    [chatMessages],
  )

  if (!hasFeature) {
    return (
      <div className="px-4 py-5">
        <p className="text-[10px] tracking-[3px] uppercase font-medium mb-4"
           style={{ color: 'rgba(255,107,26,.6)' }}>Чат команды</p>
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
               style={{ background: 'rgba(255,107,26,.1)', border: '1px solid rgba(255,107,26,.2)' }}>
            <Lock size={22} style={{ color: 'var(--color-gold)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-soft)' }}>
            Доступно на тарифах Стандарт и Pro
          </p>
          <p className="text-xs max-w-xs" style={{ color: 'var(--color-dim)' }}>
            Групповой чат команды — общий канал для всех сотрудников ресторана.
            Обновите тариф, чтобы общаться с персоналом прямо в панели.
          </p>
        </div>
      </div>
    )
  }

  const replaceMsg = (m: ChatMessage) =>
    setChatMessages(chatMessages.map(x => (x.id === m.id ? m : x)))

  const send = async () => {
    const body = text.trim()
    if (!body || sending || !djangoRestId) return
    setSending(true)
    try {
      const created = await api.sendChatMessage(djangoRestId, body)
      setChatMessages([...chatMessages, mapDjangoChatMessage(created)])
      setText('')
    } catch (e: any) {
      showToast('Не удалось отправить: ' + (e?.message ?? 'попробуйте ещё раз'))
    } finally {
      setSending(false)
    }
  }

  const togglePin = async (m: ChatMessage) => {
    if (!djangoRestId || busyId) return
    if (!m.isPinned && pinned.length >= MAX_PINNED) {
      showToast(`Можно закрепить не более ${MAX_PINNED} сообщений`)
      return
    }
    setBusyId(m.id)
    try {
      const updated = await api.pinChatMessage(djangoRestId, m.id, !m.isPinned)
      replaceMsg(mapDjangoChatMessage(updated))
    } catch (e: any) {
      showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
    } finally {
      setBusyId(null)
    }
  }

  const remove = (m: ChatMessage) => {
    if (!djangoRestId) return
    showConfirm('Удалить сообщение?', async () => {
      setBusyId(m.id)
      try {
        await api.deleteChatMessage(djangoRestId, m.id)
        setChatMessages(chatMessages.filter(x => x.id !== m.id))
      } catch (e: any) {
        showToast('Ошибка: ' + (e?.message ?? 'попробуйте ещё раз'))
      } finally {
        setBusyId(null)
      }
    })
  }

  const canDelete = (m: ChatMessage) => isAdmin || m.senderId === profile?.id

  const Bubble = ({ m, compact }: { m: ChatMessage; compact?: boolean }) => {
    const own = m.senderId === profile?.id
    return (
      <div className="adm-card p-3" style={{ background: own ? 'rgba(255,107,26,.08)' : 'var(--color-card)' }}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-bold" style={{ color: own ? 'var(--color-gold)' : 'var(--color-soft)' }}>
            {m.senderName || 'Сотрудник'}{own ? ' (вы)' : ''}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--color-dim)' }}>{fmtTime(m.createdAt)}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--color-soft)' }}>{m.text}</p>
        {!compact && (
          <div className="flex items-center gap-3 mt-2">
            <button onClick={() => togglePin(m)} disabled={busyId === m.id}
              className="flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
              style={{ color: m.isPinned ? 'var(--color-gold)' : 'var(--color-mid)' }}>
              {m.isPinned ? <PinOff size={13} /> : <Pin size={13} />}
              {m.isPinned ? 'Открепить' : 'Закрепить'}
            </button>
            {canDelete(m) && (
              <button onClick={() => remove(m)} disabled={busyId === m.id}
                className="flex items-center gap-1 text-[11px] font-semibold disabled:opacity-50"
                style={{ color: 'var(--color-red)' }}>
                <Trash2 size={13} /> Удалить
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="px-4 py-5 flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] tracking-[3px] uppercase font-medium"
           style={{ color: 'rgba(255,107,26,.6)' }}>Чат команды</p>
        <button onClick={() => setProfileOpen(true)}
          className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl"
          style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)', color: 'var(--color-mid)' }}>
          <Pencil size={12} /> {profile?.name || profile?.email || 'Профиль'}
        </button>
      </div>

      {/* Закреплённые */}
      {pinned.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Pin size={12} style={{ color: 'var(--color-gold)' }} />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--color-gold)' }}>
              Закреплённые ({pinned.length}/{MAX_PINNED})
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {pinned.map(m => (
              <div key={m.id} className="flex items-start gap-2">
                <div className="flex-1"><Bubble m={m} compact /></div>
                <button onClick={() => togglePin(m)} disabled={busyId === m.id}
                  title="Открепить"
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                  style={{ background: 'var(--color-card2)', border: '1px solid var(--color-rim)' }}>
                  <PinOff size={14} style={{ color: 'var(--color-gold)' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Лента */}
      <div className="flex-1 flex flex-col gap-2 mb-3">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <span className="text-4xl opacity-30">💬</span>
            <p className="text-sm" style={{ color: 'var(--color-dim)' }}>Сообщений пока нет</p>
          </div>
        ) : (
          chatMessages.map(m => <Bubble key={m.id} m={m} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Ввод */}
      <div className="sticky bottom-0 flex items-end gap-2 pt-2"
           style={{ background: 'var(--color-bg)' }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          rows={1}
          placeholder="Сообщение команде…"
          className="flex-1 px-3 py-2.5 rounded-2xl text-sm resize-none outline-none"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-rim)', color: 'var(--color-soft)', maxHeight: 120 }}
        />
        <button onClick={send} disabled={sending || !text.trim()}
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-40"
          style={{ background: 'var(--color-gold)' }}>
          <Send size={18} color="#fff" />
        </button>
      </div>
    </div>
  )
}
