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
  const [showNewModal, setShowNewModal] = useState(false)

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
          {/* Bouton : démarrer une nouvelle conversation avec un utilisateur */}
          <button
            onClick={() => setShowNewModal(true)}
            className="w-full mb-3 px-3 py-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-lg font-semibold text-sm transition flex items-center justify-center gap-2"
          >
            ✏️ Nouveau message à un utilisateur
          </button>

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

      {/* Modale : démarrer une conversation avec un utilisateur */}
      {showNewModal && (
        <NewConversationToUserModal
          onClose={() => setShowNewModal(false)}
          onCreated={async (convId, targetUser) => {
            setShowNewModal(false)
            showToast('success', `✉️ Message envoyé à ${targetUser.username}`)
            loadList()
            // Ouvre directement la nouvelle conversation
            try {
              const r = await api.adminConversation(convId)
              setActiveConv(r)
            } catch {}
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}
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


// =====================================================
// MODALE : Démarrer une conversation avec un utilisateur
// =====================================================

function NewConversationToUserModal({ onClose, onCreated, onError }) {
  const [users, setUsers] = useState([])
  const [searchUser, setSearchUser] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState([])
  const [sending, setSending] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)

  // Charge la liste des utilisateurs au montage
  useEffect(() => {
    let cancelled = false
    api.adminUsers()
      .then(list => {
        if (!cancelled) {
          // Trie : actifs récents en premier
          const sorted = [...list].sort((a, b) => {
            if (!a.last_seen_at && !b.last_seen_at) return 0
            if (!a.last_seen_at) return 1
            if (!b.last_seen_at) return -1
            return new Date(b.last_seen_at) - new Date(a.last_seen_at)
          })
          setUsers(sorted)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingUsers(false) })
    return () => { cancelled = true }
  }, [])

  // Coller depuis presse-papiers (image)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            if (attachments.length >= 5) return
            if (file.size > MAX_ATTACHMENT_SIZE) return
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

  const filteredUsers = useMemo(() => {
    if (!searchUser.trim()) return users.slice(0, 50)  // Top 50 par défaut
    const q = searchUser.toLowerCase()
    return users.filter(u =>
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    ).slice(0, 50)
  }, [users, searchUser])

  const handleFile = (e) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      if (!ALLOWED_MIMES.includes(file.type)) { onError(`Type non supporté : ${file.type}`); return }
      if (file.size > MAX_ATTACHMENT_SIZE) { onError(`Trop lourd : ${file.name}`); return }
      if (attachments.length >= 5) { onError('Max 5 PJ'); return }
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
    if (!selectedUser) { onError('Sélectionne un utilisateur'); return }
    if (!content.trim()) { onError('Le message ne peut pas être vide'); return }
    setSending(true)
    try {
      const r = await api.adminNewConversationToUser(
        selectedUser.id,
        subject.trim(),
        content.trim(),
        attachments
      )
      onCreated(r.conversation_id, r.target_user)
    } catch (e) {
      onError(e.message || 'Erreur')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-gradient-to-br from-[#0f1430] to-[#0a0e27] border border-orange-400/30 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-bold flex items-center gap-2">
            ✏️ Nouveau message à un utilisateur
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Sélection utilisateur */}
          <div>
            <label className="text-xs text-white/60 uppercase font-semibold mb-1 block">
              Destinataire
            </label>
            {selectedUser ? (
              <div className="flex items-center gap-3 p-3 bg-orange-500/20 border border-orange-400/40 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-black text-sm flex-shrink-0">
                  {selectedUser.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{selectedUser.username}</div>
                  <div className="text-xs text-white/60 truncate">{selectedUser.email}</div>
                </div>
                <button onClick={() => setSelectedUser(null)}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs">
                  Changer
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  placeholder="🔍 Rechercher par nom ou email..."
                  autoFocus
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
                />
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {loadingUsers ? (
                    <div className="text-center text-white/40 py-4 text-sm">Chargement...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center text-white/40 py-4 text-sm">Aucun utilisateur trouvé</div>
                  ) : (
                    filteredUsers.map(u => (
                      <button key={u.id} onClick={() => setSelectedUser(u)}
                        className="w-full flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-left transition">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-black text-xs flex-shrink-0">
                          {u.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {u.username}
                            {u.role === 'admin' && <span className="ml-1 text-[10px] text-red-300">[admin]</span>}
                            {u.role === 'leader' && <span className="ml-1 text-[10px] text-purple-300">[leader]</span>}
                          </div>
                          <div className="text-xs text-white/40 truncate">{u.email}</div>
                        </div>
                        {u.last_seen_at && (
                          <span className="text-[10px] text-white/30 whitespace-nowrap">
                            {formatTime(u.last_seen_at)}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Sujet */}
          <div>
            <label className="text-xs text-white/60 uppercase font-semibold mb-1 block">
              Sujet (optionnel)
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Bienvenue sur United Pronos"
              maxLength={100}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm"
            />
          </div>

          {/* Message */}
          <div>
            <label className="text-xs text-white/60 uppercase font-semibold mb-1 block">
              Message
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Écris ton message..."
              maxLength={10000}
              rows={6}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm resize-vertical"
            />
            <div className="flex items-center justify-between mt-1 text-xs text-white/30">
              <span>{content.length} / 10000 caractères</span>
              <span>💡 Tu peux coller (Ctrl+V) une capture d'écran</span>
            </div>
          </div>

          {/* Pièces jointes */}
          {attachments.length > 0 && (
            <div>
              <label className="text-xs text-white/60 uppercase font-semibold mb-1 block">
                📎 {attachments.length} pièce{attachments.length > 1 ? 's' : ''} jointe{attachments.length > 1 ? 's' : ''}
              </label>
              <div className="flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative">
                    <img src={a.data} alt={a.filename} className="w-16 h-16 object-cover rounded border border-white/10" />
                    <button onClick={() => removeAtt(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full text-xs text-white">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center gap-2 flex-wrap">
          <button onClick={send} disabled={sending || !selectedUser || !content.trim()}
            className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition">
            {sending ? '⏳ Envoi...' : '📤 Envoyer le message'}
          </button>
          <label className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer text-sm flex items-center gap-1.5">
            📎 <span className="hidden sm:inline">Ajouter image</span>
            <input type="file" accept="image/*" multiple onChange={handleFile} className="hidden" />
          </label>
          <button onClick={onClose} disabled={sending}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/60 transition">
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
