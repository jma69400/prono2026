/**
 * Kop United — Chat communautaire global de United Pronos
 *
 * Fonctionnement :
 * - Polling toutes les 7 secondes pour les nouveaux messages
 * - Pause auto si l'onglet n'est pas visible (économie batterie / requêtes)
 * - Scroll auto en bas à l'ouverture et à chaque nouveau message si déjà en bas
 * - Suppression possible par l'auteur (sa main) ou par un admin (modération)
 * - Filtre de mots interdits côté serveur (jamais côté front pour sécurité)
 *
 * Limites :
 * - 280 caractères max par message (Twitter-like)
 * - Anti-flood : 10 messages / 60s par utilisateur (géré côté serveur)
 */
import React, { useState, useEffect, useRef } from 'react'
import { Send, Trash2, Heart, Crown, AlertCircle, Sparkles } from 'lucide-react'
import { api } from './api'
import { useTranslation } from './i18n.jsx'

const MAX_LENGTH = 280
const POLL_INTERVAL_MS = 3000  // 3 secondes : style chat live, plus reactif
const MAX_MESSAGES_DISPLAYED = 50  // Limite affichage pour performance
const SLOW_MODE_SECONDS = 3  // Anti-spam : 3s entre 2 messages d'un meme user

// Emojis de reaction rapide (style TikTok Live / Twitch)
// Doit matcher EXACTEMENT ALLOWED_REACTIONS cote backend
const QUICK_REACTIONS = ['❤️', '🔥', '👏', '😂', '⚽']

/**
 * Parse le contenu d'un message Kop et génère du JSX avec liens cliquables.
 *
 * Syntaxe supportée :
 *   [Texte du lien](#faq:tag)  →  ouvre la FAQ au tag indiqué
 *
 * Exemple :
 *   "Salut ! Voir [comment installer l'app](#faq:pwa-install) en 30 secondes 🎉"
 *
 * Pour des raisons de sécurité, on n'autorise QUE le pattern interne #faq:tag.
 * Pas d'URLs http arbitraires (éviterait que des messages malicieux insèrent
 * des liens externes/phishing).
 *
 * Le tag doit matcher [a-z0-9-]+ (kebab-case seulement, pas de caractères spéciaux).
 */
function renderMessageContent(content, onFaqDeepLink) {
  if (!content) return null

  // Regex : capture [texte](#faq:tag)
  // - texte : tout sauf ] ou [
  // - tag : lettres minuscules, chiffres, tirets uniquement
  const pattern = /\[([^\[\]]+)\]\(#faq:([a-z0-9-]+)\)/g

  const parts = []
  let lastIndex = 0
  let match
  let keyCounter = 0

  while ((match = pattern.exec(content)) !== null) {
    // Texte avant le lien
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }
    const linkText = match[1]
    const tag = match[2]
    parts.push(
      <button
        key={`link-${keyCounter++}`}
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (onFaqDeepLink) onFaqDeepLink(tag)
        }}
        className="text-cta-300 hover:text-cta-200 underline decoration-cta-400/50 hover:decoration-cta-300 font-semibold inline transition"
      >
        {linkText}
      </button>
    )
    lastIndex = match.index + match[0].length
  }
  // Texte restant après le dernier lien
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  // Si aucun lien trouvé, on retourne le texte tel quel
  return parts.length === 0 ? content : parts
}

export default function KopUnitedTab({ user, isGuest, onLoginPrompt, onFaqDeepLink }) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState([])
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesContainerRef = useRef(null)
  const wasAtTopRef = useRef(true)

  const isAdmin = user?.role === 'admin'

  // Détection : l'utilisateur est-il déjà scrollé tout en haut ?
  // Si oui, scroll auto en haut à chaque nouveau message. Sinon, on ne déplace pas
  // (l'utilisateur lit l'historique plus ancien, pas la peine de l'interrompre).
  const checkIfAtTop = () => {
    const c = messagesContainerRef.current
    if (!c) return true
    return c.scrollTop < 50  // tolerance 50px
  }

  const scrollToTop = (smooth = false) => {
    const c = messagesContainerRef.current
    if (c) c.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
  }

  // Chargement initial
  const fetchMessages = async () => {
    try {
      const data = await api.kopListMessages()
      // PROTECTION : si la réponse est vide ou invalide, on garde l'état actuel
      // (évite de "vider" l'historique sur erreur réseau transitoire)
      if (data && Array.isArray(data.messages)) {
        wasAtTopRef.current = checkIfAtTop()
        setMessages(data.messages)
      }
    } catch (e) {
      console.error('[KopUnited] fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
    scrollToTop(false)
  }, [])

  // Polling avec pause si onglet caché
  useEffect(() => {
    let interval = null
    const start = () => {
      if (interval) clearInterval(interval)
      interval = setInterval(fetchMessages, POLL_INTERVAL_MS)
    }
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null }
    }
    start()
    const onVisibility = () => {
      if (document.hidden) stop()
      else { fetchMessages(); start() }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Scroll auto en haut si l'utilisateur y était déjà
  useEffect(() => {
    if (wasAtTopRef.current) {
      scrollToTop(true)
    }
  }, [messages.length])

  const handleSend = async () => {
    if (isGuest || !user) { onLoginPrompt?.(); return }
    const text = content.trim()
    if (!text) return
    setSending(true); setError('')
    try {
      const newMsg = await api.kopPostMessage(text)
      setContent('')
      // Ajoute le message immédiatement à la liste (avant le prochain polling)
      // pour un feedback instantané
      setMessages(prev => [...prev, newMsg])
      // Force scroll bottom car c'est SON message
      setTimeout(() => scrollToBottom(true), 50)
    } catch (e) {
      setError(e.message || 'Erreur envoi')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (msgId) => {
    if (!confirm(t('kop.deleteConfirm'))) return
    try {
      await api.kopDeleteMessage(msgId)
      // Retire le message localement
      setMessages(prev => prev.filter(m => m.id !== msgId))
    } catch (e) {
      alert(e.message || 'Erreur suppression')
    }
  }

  /**
   * Ajoute ou retire une reaction emoji sur un message (toggle).
   * Optimistic UI : on met à jour immédiatement le state local pour fluidité,
   * puis on appelle l'API. Si l'API échoue, on revert.
   */
  const handleReact = async (msgId, emoji) => {
    if (!user || isGuest) {
      onLoginPrompt?.()
      return
    }

    // Snapshot pour rollback en cas d'erreur
    const previousMessages = messages

    // Mise a jour optimiste du state
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m
      const myReactions = m.my_reactions || []
      const reactions = { ...(m.reactions || {}) }
      const hadIt = myReactions.includes(emoji)
      // Toggle
      const newMyReactions = hadIt ? myReactions.filter(e => e !== emoji) : [...myReactions, emoji]
      reactions[emoji] = (reactions[emoji] || 0) + (hadIt ? -1 : 1)
      // Si compteur 0, on retire la clé pour propreté
      if (reactions[emoji] <= 0) delete reactions[emoji]
      return { ...m, reactions, my_reactions: newMyReactions }
    }))

    try {
      await api.kopReact(msgId, emoji)
    } catch (e) {
      // Rollback en cas d'erreur (rare)
      setMessages(previousMessages)
    }
  }

  const handleKeyDown = (e) => {
    // Entrée = envoi, Shift+Entrée = nouvelle ligne (mais on ne supporte qu'une ligne ici)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Parse robuste d'une date BDD :
  // - Si format ISO 8601 avec timezone (ex: "2026-06-11T18:30:00+00:00") → JS le gère bien
  // - Si format "YYYY-MM-DD HH:MM:SS" (ancien CURRENT_TIMESTAMP SQLite, sans timezone) →
  //   JS l'interprète comme heure LOCALE par défaut, ce qui est faux (en réalité c'est UTC).
  //   Donc on force l'interprétation UTC en ajoutant "Z" ou en remplaçant l'espace par "T".
  const parseUtcDate = (iso) => {
    if (!iso) return null
    let s = String(iso).trim()
    // Format SQLite "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SSZ" pour forcer UTC
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s) && !/[Zz+]|[+-]\d{2}:?\d{2}$/.test(s)) {
      s = s.replace(' ', 'T') + 'Z'
    }
    // Format ISO sans timezone (ex: "2026-06-11T18:30:00") → ajoute Z
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      s = s + 'Z'
    }
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }

  const formatTime = (iso) => {
    try {
      const d = parseUtcDate(iso)
      if (!d) return ''
      const now = new Date()
      const diffMin = Math.floor((now - d) / 60000)
      if (diffMin < 1) return t('kop.justNow')
      if (diffMin < 60) return `${diffMin} min`
      // Si < 24h : afficher juste l'heure (heure locale du visiteur)
      const sameDay = d.toDateString() === now.toDateString()
      if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) +
             ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  // Compteur de personnes en ligne pour effet "chat live actif"
  const [onlineCount, setOnlineCount] = useState(null)
  // ID du message dont le picker emoji est ouvert (null = aucun ouvert)
  const [pickerOpenForMsg, setPickerOpenForMsg] = useState(null)
  useEffect(() => {
    let cancelled = false
    const fetchOnline = async () => {
      try {
        const r = await api.statsOnline()
        if (!cancelled) setOnlineCount(r.online)
      } catch {}
    }
    fetchOnline()
    const interval = setInterval(fetchOnline, 15000)  // Refresh 15s
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4">
      {/* En-tête "LIVE UP" — vert néon style Spotify avec point pulsant */}
      <div className="mb-4 p-4 bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-green-500/15 border border-green-400/40 rounded-2xl shadow-lg shadow-green-500/10">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {/* Point pulsant vert (style Spotify online) */}
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <h2 className="text-2xl font-black tracking-tight" style={{
            color: '#22c55e',
            textShadow: '0 0 20px rgba(34, 197, 94, 0.5)',
          }}>
            LIVE UP
          </h2>
          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-200 border border-green-400/40 rounded-full font-bold">
            EN DIRECT
          </span>
          {/* Compteur live "X regardent" — effet preuve sociale */}
          {onlineCount !== null && onlineCount > 0 && (
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-green-500/15 border border-green-400/30 rounded-full">
              <span className="text-xs font-bold text-green-200">
                👀 {onlineCount} {t('kop.watchingNow')}
              </span>
            </div>
          )}
        </div>
        <p className="text-sm text-white/70 leading-relaxed">
          {t('kop.intro')}
        </p>
        <p className="text-xs text-white/40 mt-2">
          {t('kop.rules')}
        </p>
      </div>

      {/* Zone de saisie EN HAUT — plus accessible, ergonomie chat live moderne */}
      <div className="mb-3">
        {isGuest || !user ? (
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
            <p className="text-sm text-white/60 mb-2">{t('kop.loginPrompt')}</p>
            <button onClick={onLoginPrompt}
              className="px-4 py-2 bg-cta-500 hover:bg-cta-600 text-white rounded-lg text-sm font-bold transition">
              {t('kop.loginButton')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 items-stretch">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, MAX_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder={t('kop.placeholder')}
                disabled={sending}
                rows={1}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 focus:border-green-400/50 focus:outline-none rounded-lg text-sm resize-none placeholder-white/30"
                style={{ minHeight: '42px', maxHeight: '120px' }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !content.trim()}
                className="px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold transition flex items-center justify-center"
                title={t('kop.send')}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {/* Compteur caractères + erreur */}
            <div className="flex items-center justify-between mt-1.5 text-xs">
              {error ? (
                <span className="text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {error}
                </span>
              ) : (
                <span className="text-white/40">{t('kop.hint')}</span>
              )}
              <span className={`font-mono ${
                content.length > MAX_LENGTH - 20 ? 'text-amber-400' : 'text-white/40'
              }`}>
                {content.length} / {MAX_LENGTH}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Zone des messages (en dessous de la saisie) */}
      <div
        ref={messagesContainerRef}
        className="bg-base-surface/40 border border-white/10 rounded-2xl overflow-y-auto p-3 space-y-2"
        style={{ height: '60vh', minHeight: '300px', maxHeight: '600px' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-white/40 text-sm">
            {t('kop.loading')}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40 text-center">
            <Sparkles className="w-10 h-10 mb-2 text-sport-400/50" />
            <p className="font-semibold">{t('kop.emptyTitle')}</p>
            <p className="text-xs mt-1">{t('kop.emptySub')}</p>
          </div>
        ) : (
          // Limite à 50 messages affichés (les plus récents)
          // Animation slide-up pour les nouveaux messages
          // Dernier message EN HAUT (style Twitter/Threads)
          // On prend les 50 plus récents et on les affiche en ordre inversé
          messages.slice(-MAX_MESSAGES_DISPLAYED).slice().reverse().map(msg => {
            const isMine = user && msg.user_id === user.id
            const isAuthorAdmin = msg.role === 'admin'
            return (
              <div key={msg.id} className={`flex gap-2 kop-message-slide-up ${isMine ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className="shrink-0">
                  {msg.avatar_data ? (
                    <img src={msg.avatar_data} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-sport-500/30 flex items-center justify-center text-xs font-bold text-sport-100">
                      {(msg.username || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                {/* Contenu */}
                <div className={`flex-1 min-w-0 ${isMine ? 'text-right' : ''}`}>
                  <div className={`flex items-center gap-1.5 text-xs mb-0.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <span className={`font-semibold ${isAuthorAdmin ? 'text-amber-300' : 'text-white/80'}`}>
                      {msg.username}
                    </span>
                    {isAuthorAdmin && <Crown className="w-3 h-3 text-amber-400" title="Admin" />}
                    {!!msg.is_supporter && <Heart className="w-3 h-3 text-pink-400 fill-pink-400" title="Supporter" />}
                    <span className="text-white/30">·</span>
                    <span className="text-white/30">{formatTime(msg.created_at)}</span>
                  </div>
                  <div className={`inline-block max-w-full px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                    isMine
                      ? 'bg-cta-500/20 text-white border border-cta-400/30 rounded-tr-sm'
                      : 'bg-white/5 text-white/90 border border-white/10 rounded-tl-sm'
                  }`}>
                    {renderMessageContent(msg.content, onFaqDeepLink)}
                  </div>

                  {/* === BARRE DE REACTIONS === */}
                  {/* Affiche les reactions deja posees (compteurs) + bouton "+" pour reagir */}
                  <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'} flex-wrap`}>
                    {/* Compteurs des reactions existantes */}
                    {Object.entries(msg.reactions || {}).map(([emoji, count]) => {
                      const hasReacted = (msg.my_reactions || []).includes(emoji)
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReact(msg.id, emoji)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition ${
                            hasReacted
                              ? 'bg-cta-500/30 border border-cta-400/50 text-white'
                              : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                          }`}
                          title={t('kop.reactToggle')}
                        >
                          <span>{emoji}</span>
                          <span className="font-bold">{count}</span>
                        </button>
                      )
                    })}

                    {/* Bouton "+ reagir" : ouvre un picker des 5 emojis rapides (au CLIC) */}
                    {user && !isGuest && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setPickerOpenForMsg(pickerOpenForMsg === msg.id ? null : msg.id)
                          }}
                          className="px-2 py-1 text-sm bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white/80 transition"
                          title={t('kop.reactAdd')}
                        >
                          + 😀
                        </button>
                        {/* Popover des emojis : ouvert au CLIC, gros boutons visibles */}
                        {pickerOpenForMsg === msg.id && (
                          <>
                            {/* Backdrop : clic ailleurs ferme le picker */}
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setPickerOpenForMsg(null)}
                            />
                            <div className="absolute z-40 bottom-full left-0 mb-2 flex bg-gradient-to-b from-base-deep to-black border border-white/20 rounded-xl shadow-2xl p-2 gap-1">
                              {QUICK_REACTIONS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleReact(msg.id, emoji)
                                    setPickerOpenForMsg(null)
                                  }}
                                  className="w-10 h-10 flex items-center justify-center hover:bg-white/15 active:scale-90 rounded-lg text-2xl transition shadow-md"
                                  title={emoji}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Bouton suppression : visible si message à soi OU admin */}
                    {(isMine || isAdmin) && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="ml-1 text-white/30 hover:text-red-400 transition"
                        title={t('kop.delete')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
