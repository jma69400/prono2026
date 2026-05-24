import { useState, useEffect, useRef, useMemo } from 'react'
import { api } from './api'

// =====================================================
// PANNEAU ADMIN — Gestion des conversations
// =====================================================

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
const MAX_ATTACHMENT_SIZE = 2_200_000
const POLL_INTERVAL_MS = 30_000

function formatTime(iso) {
  if (!iso) return ''
  try {
    const date = new Date(iso)
    const now = new Date()
    const diffMin = Math.floor((now - date) / 60000)
    const diffH = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffH / 24)
    if (diffMin < 1) return "à l'instant"
    if (diffMin < 60) return `il y a ${diffMin} min`
    if (diffH < 24) return `il y a ${diffH}h`
    if (diffDays === 1) return 'hier'
    if (diffDays < 7) return `il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch { return '' }
}

export function AdminConversationsPanel() {
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const loadList = async () => {
    setLoading(true)
    try {
      const list = await api.adminConversations(statusFilter === 'all' ? null : statusFilter)
      setConversations(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadList() }, [statusFilter])

  // Polling pour le rafraîchissement automatique de la liste
  useEffect(() => {
    const interval = setInterval(loadList, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [statusFilter])

  const openConv = async (id) => {
    try {
      const r = await api.adminConversation(id)
      setActiveConv(r)
    } catch (e) {
      console.error(e)
    }
  }

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const closeConversation = async (id) => {
    if (!confirm('Marquer cette conversation comme résolue ?')) return
    try {
      await api.adminCloseConversation(id)
      showToast('success', 'Conversation fermée')
      setActiveConv(null)
      loadList()
    } catch (e) {
      showToast('error', e.message)
    }
  }

  const deleteConv = async (id) => {
    if (!confirm('Supprimer définitivement cette conversation et tous ses messages ?')) return
    try {
      await api.adminDeleteConversation(id)
      showToast('success', 'Conversation supprimée')
      setActiveConv(null)
      loadList()
    } catch (e) {
      showToast('error', e.message)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter(c =>
      c.username?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.subject?.toLowerCase().includes(q)
    )
  }, [conversations, search])

  const counts = useMemo(() => ({
    all: conversations.length,
    unread: conversations.filter(c => c.unread_admin > 0).length,
    open: conversations.filter(c => c.status === 'open').length,
    closed: conversations.filter(c => c.status === 'closed').length,
  }), [conversations])

  return (
    <div className="relative">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Colonne gauche : liste des conversations */}
        <div className={`lg:col-span-5 ${activeConv ? 'hidden lg:block' : ''}`}>
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { id: 'all', label: 'Toutes', count: counts.all },
              { id: 'unread', label: '🔴 Non lus', count: counts.unread },
              { id: 'open', label: 'Ouverts', count: counts.open },
              { id: 'closed', label: 'Fermés', count: counts.closed },
            ].map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                  statusFilter === f.id ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}>
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Rechercher par nom, email ou sujet..."
            className="w-full px-3 py-1.5 mb-3 bg-white/5 border border-white/10 rounded-lg text-sm"
          />

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {loading && conversations.length === 0 && (
              <div className="text-center text-white/40 py-8">Chargement...</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-center text-white/40 py-8">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-sm">Aucune conversation</p>
              </div>
            )}
            {filtered.map(c => (
              <button key={c.id} onClick={() => openConv(c.id)}
                className={`w-full text-left p-3 rounded-lg border transition ${
                  activeConv?.conversation?.id === c.id
                    ? 'bg-orange-500/20 border-orange-400/50'
                    : c.unread_admin > 0
                      ? 'bg-orange-500/10 border-orange-400/30 hover:bg-orange-500/20'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  {c.unread_admin > 0 && (
                    <span className="min-w-[20px] h-[20px] px-1 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                      {c.unread_admin}
                    </span>
                  )}
                  <span className="font-semibold text-sm truncate flex-1">{c.username}</span>
                  <span className="text-xs text-white/30 whitespace-nowrap">{formatTime(c.last_message_at)}</span>
                </div>
                <div className="text-xs text-white/40 truncate mb-1">{c.email}</div>
                <div className="text-sm text-white/80 font-medium truncate">{c.subject || 'Sans sujet'}</div>
                {c.last_preview && (
                  <div className="text-xs text-white/50 truncate mt-1">
                    {c.last_preview.sender === 'admin' ? '↪ ' : ''}{c.last_preview.content}
                  </div>
                )}
                {c.status === 'closed' && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 bg-green-500/20 text-green-300 text-[10px] rounded">
                    ✅ Fermée
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Colonne droite : conversation active */}
        <div className={`lg:col-span-7 ${!activeConv ? 'hidden lg:block' : ''}`}>
          {activeConv ? (
            <AdminConversationView
              conv={activeConv}
              onClose={() => setActiveConv(null)}
              onMessageSent={async () => {
                try {
                  const r = await api.adminConversation(activeConv.conversation.id)
                  setActiveConv(r)
                  loadList()
                } catch {}
              }}
              onCloseConv={() => closeConversation(activeConv.conversation.id)}
              onDeleteConv={() => deleteConv(activeConv.conversation.id)}
            />
          ) : (
            <div className="hidden lg:flex items-center justify-center h-[600px] bg-white/5 border border-white/10 rounded-lg">
              <div className="text-center text-white/40">
                <div className="text-5xl mb-3">💬</div>
                <p>Sélectionne une conversation pour la lire</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


function AdminConversationView({ conv, onClose, onMessageSent, onCloseConv, onDeleteConv }) {
  const messagesEndRef = useRef(null)
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

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

  // Coller depuis presse-papiers
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            if (attachments.length >= 5) { setError('Max 5 PJ'); return }
            const reader = new FileReader()
            reader.onload = (ev) => {
              setAttachments(prev => [...prev, {
                filename: file.name || `capture-${Date.now()}.png`,
                data: ev.target.result, mime: file.type, size: file.size
              }])
            }
            reader.readAsDataURL(file)
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [attachments])

  const removeAtt = (i) => setAttachments(prev => prev.filter((_, idx) => idx !== i))

  const send = async () => {
    setError('')
    if (!content.trim()) return
    setSending(true)
    try {
      await api.adminReplyConversation(conv.conversation.id, content.trim(), attachments)
      setContent('')
      setAttachments([])
      onMessageSent()
    } catch (e) {
      setError(e.message || 'Erreur')
    } finally {
      setSending(false)
    }
  }

  const c = conv.conversation

  return (
    <div className="flex flex-col h-[700px] bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 border-b border-white/10 bg-white/5">
        <button onClick={onClose} className="lg:hidden p-1.5 hover:bg-white/10 rounded text-sm">←</button>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{c.username} <span className="text-xs text-white/40">({c.email})</span></div>
          <div className="text-xs text-white/60 truncate">{c.subject || 'Sans sujet'}</div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {c.status === 'open' && (
            <button onClick={onCloseConv} className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded text-xs font-semibold" title="Marquer comme résolu">
              ✅
            </button>
          )}
          <button onClick={onDeleteConv} className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs" title="Supprimer">
            🗑️
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {conv.messages.map(m => {
          const isAdmin = m.sender === 'admin'
          return (
            <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl p-3 ${
                isAdmin
                  ? 'bg-gradient-to-br from-orange-500/30 to-pink-500/30 border border-orange-400/30 text-white'
                  : 'bg-white/10 border border-white/10 text-white/90'
              }`}>
                <div className="text-[10px] font-semibold uppercase mb-1 opacity-70">
                  {isAdmin ? 'Toi (admin)' : `${c.username}`} · {formatTime(m.created_at)}
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
        <div className="text-xs text-white/30 mb-1.5">
          💡 Tu peux <strong>coller</strong> (Ctrl+V) une capture d'écran
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tape ta réponse..."
            rows={2}
            maxLength={10000}
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
