import { useState, useEffect, useRef, useMemo } from 'react'
import { api } from './api'
import { useTranslation } from './i18n'

// =====================================================
// CHAT-BOX FLOTTANTE — Pour les utilisateurs connectés
// =====================================================
// Visible en bas à droite. Bouton 💬 avec badge si messages non lus.
// Au clic, ouvre une fenêtre de conversation style Crisp/Intercom.
// =====================================================

const POLL_INTERVAL_MS = 30_000  // 30 secondes (polling discret)
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
const MAX_ATTACHMENT_SIZE = 2_200_000  // 2.2 MB

function formatChatTime(iso) {
  if (!iso) return ''
  try {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now - date
    const diffMin = Math.floor(diffMs / 60000)
    const diffH = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffH / 24)
    if (diffMin < 1) return "à l'instant"
    if (diffMin < 60) return `il y a ${diffMin} min`
    if (diffH < 24) return `il y a ${diffH}h`
    if (diffDays === 1) return 'hier'
    if (diffDays < 7) return `il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  } catch {
    return ''
  }
}

export function FloatingChatBox({ user }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [view, setView] = useState('list')  // 'list' | 'conversation' | 'new'
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)  // { conversation, messages }
  const [loading, setLoading] = useState(false)

  // Polling pour le compteur non-lus
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const fetchUnread = async () => {
      try {
        const r = await api.myConversationsUnreadCount()
        if (!cancelled) setUnreadCount(r.unread || 0)
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [user])

  // Écoute l'événement global "open-chatbox" (déclenché par le bouton Contact)
  useEffect(() => {
    const handleOpen = async () => {
      setIsOpen(true)
      // Si l'utilisateur n'a encore aucune conversation, on l'amène direct
      // au formulaire de nouveau message (UX optimisée pour "je veux contacter le support")
      try {
        const list = await api.myConversations()
        setConversations(list)
        if (list.length === 0) {
          setView('new')
        } else {
          setView('list')
        }
      } catch {
        setView('list')
      }
    }
    window.addEventListener('open-chatbox', handleOpen)
    return () => window.removeEventListener('open-chatbox', handleOpen)
  }, [])

  // Charge la liste quand on ouvre la chat-box ou refresh
  const loadConversations = async () => {
    setLoading(true)
    try {
      const list = await api.myConversations()
      setConversations(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Quand on ouvre la box, on charge la liste si pas déjà fait
  useEffect(() => {
    if (isOpen && view === 'list' && !loading) {
      loadConversations()
    }
  }, [isOpen, view])

  // Quand on est en conversation, polling pour récupérer les nouveaux messages
  useEffect(() => {
    if (!isOpen || view !== 'conversation' || !activeConv) return
    const convId = activeConv.conversation.id
    let cancelled = false
    const fetchConv = async () => {
      try {
        const r = await api.myConversation(convId)
        if (!cancelled) {
          setActiveConv(r)
          // Reset le compteur unread global puisqu'on vient de lire
          const updated = await api.myConversationsUnreadCount()
          if (!cancelled) setUnreadCount(updated.unread || 0)
        }
      } catch {}
    }
    const interval = setInterval(fetchConv, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [isOpen, view, activeConv?.conversation?.id])

  const openConversation = async (convId) => {
    setLoading(true)
    try {
      const r = await api.myConversation(convId)
      setActiveConv(r)
      setView('conversation')
      // Rafraîchir le compteur après lecture
      const updated = await api.myConversationsUnreadCount()
      setUnreadCount(updated.unread || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const backToList = () => {
    setActiveConv(null)
    setView('list')
    loadConversations()
  }

  if (!user) return null

  return (
    <>
      {/* Bouton flottant */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 w-14 h-14 bg-gradient-to-br from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-full shadow-2xl flex items-center justify-center transition transform hover:scale-110 group"
          aria-label="Ouvrir la messagerie"
        >
          <span className="text-2xl">💬</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center border-2 border-[#0a0e27] animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Fenêtre de chat */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[380px] max-w-[380px] h-[600px] max-h-[calc(100vh-2rem)] bg-gradient-to-br from-[#0f1430] to-[#0a0e27] border border-orange-400/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              {view === 'conversation' && (
                <button onClick={backToList} className="p-1 hover:bg-white/10 rounded">
                  ←
                </button>
              )}
              <span className="text-xl">💬</span>
              <div className="min-w-0">
                <div className="font-bold truncate">
                  {view === 'new' ? 'Nouveau message'
                    : view === 'conversation' ? (activeConv?.conversation?.subject || 'Conversation')
                    : 'Support United Pronos'}
                </div>
                {view === 'list' && (
                  <div className="text-xs text-white/80">Pose ta question, on répond vite ✨</div>
                )}
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded text-xl leading-none">
              ✕
            </button>
          </div>

          {/* Contenu */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {view === 'list' && (
              <ConversationList
                conversations={conversations}
                loading={loading}
                onOpen={openConversation}
                onNew={() => setView('new')}
              />
            )}
            {view === 'new' && (
              <NewConversationForm
                onCancel={() => setView('list')}
                onCreated={(convId) => openConversation(convId)}
              />
            )}
            {view === 'conversation' && activeConv && (
              <ConversationView
                conv={activeConv}
                onMessageSent={async () => {
                  // Reload la conversation pour voir le nouveau message
                  try {
                    const r = await api.myConversation(activeConv.conversation.id)
                    setActiveConv(r)
                  } catch {}
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}


// ─────────────────────────────────────────────
// SOUS-COMPOSANT : Liste des conversations
// ─────────────────────────────────────────────
function ConversationList({ conversations, loading, onOpen, onNew }) {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {loading && conversations.length === 0 && (
        <div className="text-center text-white/40 py-8">Chargement...</div>
      )}
      {!loading && conversations.length === 0 && (
        <div className="text-center text-white/40 py-8 px-4">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-sm">Aucun message pour l'instant.</p>
          <p className="text-xs text-white/30 mt-2">Démarre une conversation pour poser tes questions.</p>
        </div>
      )}
      {conversations.map(c => (
        <button
          key={c.id}
          onClick={() => onOpen(c.id)}
          className={`w-full text-left p-3 rounded-lg border transition ${
            c.unread_user > 0
              ? 'bg-orange-500/10 border-orange-400/40 hover:bg-orange-500/20'
              : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {c.unread_user > 0 && (
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                )}
                <span className="font-semibold text-sm truncate">{c.subject || 'Sans sujet'}</span>
              </div>
              {c.last_preview && (
                <div className="text-xs text-white/50 truncate">
                  {c.last_preview.sender === 'admin' ? '🛠️ ' : ''}
                  {c.last_preview.content}
                </div>
              )}
            </div>
            <span className="text-xs text-white/30 whitespace-nowrap flex-shrink-0">
              {formatChatTime(c.last_message_at)}
            </span>
          </div>
          {c.status === 'closed' && (
            <span className="inline-block mt-1 px-1.5 py-0.5 bg-green-500/20 text-green-300 text-[10px] rounded">
              ✅ Résolu
            </span>
          )}
        </button>
      ))}

      <button
        onClick={onNew}
        className="w-full p-3 mt-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-lg font-semibold text-sm transition"
      >
        + Nouveau message
      </button>
    </div>
  )
}


// ─────────────────────────────────────────────
// SOUS-COMPOSANT : Nouveau message
// ─────────────────────────────────────────────
function NewConversationForm({ onCancel, onCreated }) {
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleFile = (e) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      if (!ALLOWED_MIMES.includes(file.type)) {
        setError(`Type non supporté : ${file.type}`); return
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setError(`Trop lourd : ${file.name}`); return
      }
      if (attachments.length >= 5) {
        setError('Max 5 pièces jointes'); return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        setAttachments(prev => [...prev, {
          filename: file.name, data: ev.target.result, mime: file.type, size: file.size
        }])
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const removeAtt = (i) => setAttachments(prev => prev.filter((_, idx) => idx !== i))

  const submit = async () => {
    setError('')
    if (!content.trim()) { setError('Le message ne peut pas être vide'); return }
    setSending(true)
    try {
      const r = await api.createConversation(subject.trim(), content.trim(), attachments)
      onCreated(r.id)
    } catch (e) {
      setError(e.message || 'Erreur')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden">
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Sujet (optionnel)"
        maxLength={100}
        className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded-lg text-sm"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Décris ta question ou ton problème..."
        maxLength={5000}
        rows={6}
        autoFocus
        className="w-full flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm resize-none"
      />
      {attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <div key={i} className="relative">
              <img src={a.data} alt={a.filename} className="w-12 h-12 object-cover rounded border border-white/10" />
              <button onClick={() => removeAtt(i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full text-xs text-white">✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-white/30 mt-2">{content.length} / 5000</div>
      {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
      <div className="flex items-center gap-2 mt-3">
        <button onClick={submit} disabled={sending || !content.trim()}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition">
          {sending ? 'Envoi...' : '📤 Envoyer'}
        </button>
        <label className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer text-sm" title="Ajouter une image">
          📎
          <input type="file" accept="image/*" multiple onChange={handleFile} className="hidden" />
        </label>
        <button onClick={onCancel} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/60">
          Annuler
        </button>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────
// SOUS-COMPOSANT : Vue d'une conversation
// ─────────────────────────────────────────────
function ConversationView({ conv, onMessageSent }) {
  const messagesEndRef = useRef(null)
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // Scroll auto en bas quand nouveaux messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conv.messages?.length])

  const handleFile = (e) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      if (!ALLOWED_MIMES.includes(file.type)) { setError(`Type non supporté`); return }
      if (file.size > MAX_ATTACHMENT_SIZE) { setError(`Trop lourd`); return }
      if (attachments.length >= 5) { setError('Max 5 PJ'); return }
      const reader = new FileReader()
      reader.onload = (ev) => {
        setAttachments(prev => [...prev, {
          filename: file.name, data: ev.target.result, mime: file.type, size: file.size
        }])
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const removeAtt = (i) => setAttachments(prev => prev.filter((_, idx) => idx !== i))

  const send = async () => {
    setError('')
    if (!content.trim()) return
    setSending(true)
    try {
      await api.sendConversationMessage(conv.conversation.id, content.trim(), attachments)
      setContent('')
      setAttachments([])
      onMessageSent()
    } catch (e) {
      setError(e.message || 'Erreur')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {conv.messages.map(m => {
          const isAdmin = m.sender === 'admin'
          return (
            <div key={m.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-2xl p-3 ${
                isAdmin
                  ? 'bg-white/10 border border-white/10 text-white/90'
                  : 'bg-gradient-to-br from-orange-500/30 to-pink-500/30 border border-orange-400/30 text-white'
              }`}>
                <div className="text-[10px] font-semibold uppercase mb-1 opacity-70">
                  {isAdmin ? '🛠️ United Pronos' : 'Toi'} · {formatChatTime(m.created_at)}
                </div>
                <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.attachments.map((a, i) => (
                      <a key={i} href={a.data} target="_blank" rel="noopener noreferrer"
                        className="block w-16 h-16 rounded border border-white/10 overflow-hidden hover:opacity-80">
                        <img src={a.data} alt={a.filename} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-3">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative">
                <img src={a.data} alt={a.filename} className="w-10 h-10 object-cover rounded border border-white/10" />
                <button onClick={() => removeAtt(i)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white">✕</button>
              </div>
            ))}
          </div>
        )}
        {error && <div className="text-xs text-red-300 mb-2">{error}</div>}
        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder="Écris ton message..."
            rows={1}
            maxLength={5000}
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm resize-none max-h-32"
          />
          <label className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer text-sm" title="Ajouter une image">
            📎
            <input type="file" accept="image/*" multiple onChange={handleFile} className="hidden" />
          </label>
          <button onClick={send} disabled={sending || !content.trim()}
            className="p-2 bg-gradient-to-r from-orange-500 to-pink-500 disabled:opacity-40 text-white rounded-lg transition w-10 h-10 flex items-center justify-center text-sm">
            {sending ? '⏳' : '📤'}
          </button>
        </div>
      </div>
    </div>
  )
}
