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

// Son de notification (base64 court "ding" intégré au code, pas de fichier externe à charger)
// Bruit discret de notification ~0.3s
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRkQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSAGAACAhpKduMHJysC0pZWGdmxhWE9JREE6NS4tKygmJSQiIB0aFhMQDQsIBQQDAgIBAQECAwQGCAsOERUYHB8jJikrLjA0OkBHT1ZdZWtwdHd5enl3dXFsZmBaVE5HQTw3MzAuLCsqKigmJCEfHBgVEg8MCggGBAMCAgECBAYIDA8TFxsfIyYpKy0vMjU5PUNJUFdeZmxxdXh6e3p4dnJtaGNcVlBJQz04MzAuLSwrKignJSQiIB4cGRcUEQ4LCQYEAwIBAQIDBQcKDREVGB0gJCgrLS8xMzc8QEZNVFtiaG1yd3l6e3p4dHBraWNeWFFLRT83MzEvLi0sKykoJiUjIR8dGxgVEw8MCgcEAwICAQIEBgkMDxIWGRwfJCcqLC4wMjU4PUFITlVcZGptcnZ5enp6eHVxbWdiXFdQS0Q+ODQxLy4tLCsqKCcmJCMhHx0bGRYUEAwKBwUDAgEBAgQGCAwPExcaHSEkKCotLzAyNjk9Q0lQV15kanByd3l6enl3dHBrZWBbVU9JQz03My8uLCsqKSgnJiUkIyIgHx0cGhcUEg4LCQYEAwICAgMEBgoNERQXGyAjJiotLzAyNTc6P0VLUVliaG1yd3l5enp5dnRwa2VgWlNNRkE7NjMwLi0sKykoJyclJSQjIiAfHRsZFxQRDgsHBQMCAgIDBAYJDA8SFhkdISQnKy0vMTM2OD1ESVBXXmRpb3R3eXp6eXh1cm5oYltVTkhCPDcyMC4tKyopKCcmJSQjIiEgHx0cGhgVEg8MCQcFAwICAwQGCAsOERUYHB8jJikrLjA0OD5DSlBXXmRqb3R3eXp6eXd0cGtmYFtUTkhCPDgzMTEwLy4sLCspKSgnJyYlJSQjIiEgHh0cGxoZGBcWFRMRDw0LCAYEAwIBAQICAwQFBwgKDA4QExUYGh0gIyYoKy0wMjQ3OTw+QURGSU1QU1ZZXF9iZWhrbW9xc3V2d3h5enp6eXh3dnVzcW9tampnZWNgXltZVlNQTUtIRkRBPjw6Nzc1MzIxLy8uLS0sLCsrKioqKSkpKSkpKSoqKy0uLzAxMzQ2ODg7PUBCQ0VHSUtNT1FSU1RVVlZXV1dXV1dXVldYWFlaW1xeYGFjZmhqbG9xc3V3eXt8fX5+f39/f39+fnx7eXh1c3FvbGppZ2RhX1xZV1RSUE5MSklIR0ZGRUVERERFRURERkdISktNTk9RUlRVV1lbXF5gYmRmaGptb3FzdXd5e3x9fn5+fn5+fX18e3p4dnRzcG9ta2lnZWNiYF5dW1pZWFdWVVRTU1NSUlJSUlJTU1RVVldYWVtcXl9hY2VnaGptbm9xc3R2d3h6e3x9fX5+fn5+fX18e3p4d3VzcnFvbm1samhnZmRjYmFgX19eXVxcW1tbWlpaWlpaW1tbXFxdXl5fYGFiY2RlZmhpaWttbnBxcnN0dXZ3eHl5ent7e3x8fHx8fHx7e3p6eXl4d3d2dnV0c3NycXBwb25tbWxraGloZ2dmZWVlZGRkZGRkZGRkZWVlZWZmZ2dnaGhpampra21ucG5wcXJzdHV2d3d4eXl6eg=='

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

// Lit la préférence son depuis localStorage (default: activé)
function getSoundEnabled() {
  try { return localStorage.getItem('prono26_chat_sound') !== '0' } catch { return true }
}
function setSoundEnabled(enabled) {
  try { localStorage.setItem('prono26_chat_sound', enabled ? '1' : '0') } catch {}
}

export function FloatingChatBox({ user }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [view, setView] = useState('list')  // 'list' | 'conversation' | 'new'
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [loading, setLoading] = useState(false)
  // UX : préview + nouveau-message
  const [latestPreview, setLatestPreview] = useState(null)  // { content, sender } du dernier message non-lu
  const [showBubblePreview, setShowBubblePreview] = useState(false)
  const [justGotNewMessage, setJustGotNewMessage] = useState(false)
  const [showTooltipFirstTime, setShowTooltipFirstTime] = useState(false)
  const [soundEnabled, setSoundEnabledState] = useState(getSoundEnabled())

  // Refs pour son et titre
  const audioRef = useRef(null)
  const originalTitleRef = useRef(typeof document !== 'undefined' ? document.title : '')
  const titleBlinkIntervalRef = useRef(null)
  const previousUnreadRef = useRef(0)

  // Initialise l'audio une seule fois
  useEffect(() => {
    if (typeof Audio !== 'undefined') {
      try {
        audioRef.current = new Audio(NOTIFICATION_SOUND)
        audioRef.current.volume = 0.4
      } catch {}
    }
  }, [])

  // Joue le son de notification (si activé)
  const playNotification = () => {
    if (!soundEnabled || !audioRef.current) return
    try {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})  // Ignore "user hasn't interacted" errors
    } catch {}
  }

  // Active le clignotement du titre quand onglet inactif et messages non-lus
  useEffect(() => {
    if (typeof document === 'undefined') return
    // Stop blink si pas de message non-lu OU onglet actif OU chat ouvert
    const stopBlink = () => {
      if (titleBlinkIntervalRef.current) {
        clearInterval(titleBlinkIntervalRef.current)
        titleBlinkIntervalRef.current = null
      }
      document.title = originalTitleRef.current
    }

    if (unreadCount === 0 || isOpen) {
      stopBlink()
      return
    }

    // Blink toutes les 1.5 sec : "(N) United Pronos" ↔ "💬 Nouveau message !"
    let toggle = false
    const updateTitle = () => {
      if (!document.hidden) {
        // Onglet visible : titre normal
        document.title = originalTitleRef.current
        return
      }
      toggle = !toggle
      document.title = toggle
        ? `💬 (${unreadCount}) Nouveau message !`
        : `(${unreadCount}) United Pronos`
    }
    updateTitle()
    titleBlinkIntervalRef.current = setInterval(updateTitle, 1500)

    // Quand l'utilisateur revient sur l'onglet, on remet le titre normal
    const handleVisibility = () => {
      if (!document.hidden) {
        document.title = originalTitleRef.current
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopBlink()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [unreadCount, isOpen])

  // Polling pour le compteur non-lus + détection de nouveau message
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const fetchUnread = async () => {
      try {
        const r = await api.myConversationsUnreadCount()
        if (cancelled) return
        const newCount = r.unread || 0
        // Détecte une NOUVELLE arrivée de message
        if (newCount > previousUnreadRef.current) {
          // L'utilisateur a reçu un nouveau message depuis le dernier polling
          handleNewMessageReceived(newCount)
        }
        previousUnreadRef.current = newCount
        setUnreadCount(newCount)
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [user, soundEnabled])

  // Gère l'arrivée d'un nouveau message : son, animation, bulle preview, tooltip
  const handleNewMessageReceived = async (newCount) => {
    // 1. Son
    playNotification()

    // 2. Animation du bouton flottant (wiggle pendant 4 sec)
    setJustGotNewMessage(true)
    setTimeout(() => setJustGotNewMessage(false), 4000)

    // 3. Récupère le dernier message pour aperçu dans la bulle
    if (!isOpen) {
      try {
        const list = await api.myConversations()
        // Trouve la conversation la plus récente avec messages non-lus
        const recentUnread = list.find(c => c.unread_user > 0)
        if (recentUnread && recentUnread.last_preview) {
          setLatestPreview({
            content: recentUnread.last_preview.content,
            sender: recentUnread.last_preview.sender,
            convId: recentUnread.id,
          })
          setShowBubblePreview(true)
          // Auto-fermeture de la bulle preview après 8 secondes
          setTimeout(() => setShowBubblePreview(false), 8000)
        }
      } catch {}
    }
  }

  // Tooltip "Tu as un nouveau message" au premier affichage du badge
  useEffect(() => {
    if (unreadCount > 0 && !isOpen) {
      try {
        const tooltipSeen = localStorage.getItem('prono26_chat_tooltip_seen')
        if (!tooltipSeen) {
          setShowTooltipFirstTime(true)
          // Masque le tooltip après 10 sec ou au clic
          setTimeout(() => setShowTooltipFirstTime(false), 10000)
        }
      } catch {}
    }
  }, [unreadCount, isOpen])

  // Écoute l'événement global "open-chatbox" (déclenché par le bouton Contact)
  useEffect(() => {
    const handleOpen = async () => {
      setIsOpen(true)
      setShowBubblePreview(false)
      setShowTooltipFirstTime(false)
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

  // Quand on ouvre, ferme la bulle preview et marque le tooltip comme vu
  const openChatbox = (convId = null) => {
    setIsOpen(true)
    setShowBubblePreview(false)
    setShowTooltipFirstTime(false)
    try { localStorage.setItem('prono26_chat_tooltip_seen', '1') } catch {}
    if (convId) {
      openConversation(convId)
    }
  }

  // Toggle son
  const toggleSound = () => {
    const newVal = !soundEnabled
    setSoundEnabledState(newVal)
    setSoundEnabled(newVal)
  }

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

  const hasUnread = unreadCount > 0

  return (
    <>
      {/* Bouton flottant + UX engageante */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">

          {/* Bulle preview du dernier message (apparaît quand nouveau message reçu) */}
          {showBubblePreview && latestPreview && (
            <button
              onClick={() => {
                setShowBubblePreview(false)
                openChatbox(latestPreview.convId)
              }}
              className="max-w-[300px] bg-white text-[#0a0e27] rounded-2xl shadow-2xl p-3 animate-bubble-in cursor-pointer hover:shadow-orange-400/50 transition border-2 border-orange-400"
              style={{ animation: 'bubbleIn 0.4s ease-out' }}
            >
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-sm flex-shrink-0">
                  🛠️
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-xs font-bold text-orange-600 mb-0.5">
                    United Pronos · Nouveau message
                  </div>
                  <div className="text-sm text-gray-800 line-clamp-2">
                    {latestPreview.content}
                  </div>
                  <div className="text-xs text-orange-500 font-semibold mt-1">
                    👉 Cliquer pour lire
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowBubblePreview(false) }}
                  className="text-gray-400 hover:text-gray-700 text-xs"
                >✕</button>
              </div>
            </button>
          )}

          {/* Tooltip "Tu as un nouveau message" (premier passage) */}
          {showTooltipFirstTime && !showBubblePreview && (
            <div className="bg-orange-500 text-white px-3 py-2 rounded-lg shadow-2xl text-sm font-semibold flex items-center gap-2 animate-bounce">
              <span>👋</span>
              <span>Tu as {unreadCount > 1 ? `${unreadCount} nouveaux messages` : 'un nouveau message'} !</span>
              {/* Petit triangle pointant vers le bas */}
              <span className="absolute -bottom-1 right-6 w-3 h-3 bg-orange-500 rotate-45"></span>
            </div>
          )}

          {/* Bouton principal */}
          <button
            onClick={() => openChatbox()}
            className={`relative w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-full shadow-2xl flex items-center justify-center transition transform hover:scale-110 ${
              justGotNewMessage ? 'animate-wiggle' : ''
            } ${hasUnread ? 'shadow-orange-400/50' : ''}`}
            style={{
              animation: justGotNewMessage
                ? 'wiggle 0.5s ease-in-out 6'
                : hasUnread
                  ? 'gentle-pulse 2s ease-in-out infinite'
                  : 'none',
            }}
            aria-label={hasUnread ? `Ouvrir la messagerie (${unreadCount} non-lu)` : 'Ouvrir la messagerie'}
          >
            <span className="text-3xl">💬</span>

            {/* Badge nombre non-lus (plus gros et plus visible) */}
            {hasUnread && (
              <>
                {/* Halo lumineux derrière le badge */}
                <span className="absolute -top-1 -right-1 w-7 h-7 bg-red-500 rounded-full animate-ping opacity-75"></span>
                <span className="absolute -top-1 -right-1 min-w-[28px] h-7 px-1.5 rounded-full bg-red-500 text-white text-sm font-black flex items-center justify-center border-2 border-white shadow-lg z-10">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </>
            )}

            {/* Indicateur "en ligne" (point vert en bas) - rassure les non-experts */}
            {!hasUnread && (
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></span>
            )}
          </button>
        </div>
      )}

      {/* Style CSS pour animations (inline pour pas dépendre du Tailwind config) */}
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-12deg); }
          75% { transform: rotate(12deg); }
        }
        @keyframes gentle-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.7); }
          50% { box-shadow: 0 0 0 12px rgba(251, 146, 60, 0); }
        }
        @keyframes bubbleIn {
          0% { opacity: 0; transform: translateY(20px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-bubble-in { animation: bubbleIn 0.4s ease-out; }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

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
            <div className="flex items-center gap-1">
              {/* Toggle son */}
              <button
                onClick={toggleSound}
                className="p-1.5 hover:bg-white/10 rounded text-sm"
                title={soundEnabled ? 'Désactiver le son' : 'Activer le son'}
              >
                {soundEnabled ? '🔔' : '🔕'}
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded text-xl leading-none">
                ✕
              </button>
            </div>
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
