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
const POLL_INTERVAL_MS = 7000  // 7 secondes, équilibre fluidité/charge serveur

export default function KopUnitedTab({ user, isGuest, onLoginPrompt }) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState([])
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const wasAtBottomRef = useRef(true)

  const isAdmin = user?.role === 'admin'

  // Détection : l'utilisateur est-il déjà scrollé tout en bas ?
  // Si oui, scroll auto en bas à chaque nouveau message. Sinon, on ne déplace pas
  // (l'utilisateur lit l'historique, pas la peine de l'interrompre).
  const checkIfAtBottom = () => {
    const c = messagesContainerRef.current
    if (!c) return true
    const threshold = 50  // tolérance 50px
    return c.scrollHeight - c.scrollTop - c.clientHeight < threshold
  }

  const scrollToBottom = (smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }

  // Chargement initial
  const fetchMessages = async () => {
    try {
      const data = await api.kopListMessages()
      // PROTECTION : si la réponse est vide ou invalide, on garde l'état actuel
      // (évite de "vider" l'historique sur erreur réseau transitoire)
      if (data && Array.isArray(data.messages)) {
        wasAtBottomRef.current = checkIfAtBottom()
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
    scrollToBottom(false)
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

  // Scroll auto en bas si l'utilisateur y était déjà
  useEffect(() => {
    if (wasAtBottomRef.current) {
      scrollToBottom(true)
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

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4">
      {/* En-tête avec présentation et règles */}
      <div className="mb-4 p-4 bg-gradient-to-br from-sport-500/15 to-cta-500/10 border border-sport-400/30 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-3xl">💬</span>
          <h2 className="text-2xl font-black bg-gradient-to-r from-brand-orange to-brand-pink bg-clip-text text-transparent">
            Kop United
          </h2>
          <span className="ml-auto text-xs px-2 py-0.5 bg-cta-500/20 text-cta-200 border border-cta-400/40 rounded-full font-bold">
            ✨ NEW
          </span>
        </div>
        <p className="text-sm text-white/70 leading-relaxed">
          {t('kop.intro')}
        </p>
        <p className="text-xs text-white/40 mt-2">
          {t('kop.rules')}
        </p>
      </div>

      {/* Zone des messages */}
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
          messages.map(msg => {
            const isMine = user && msg.user_id === user.id
            const isAuthorAdmin = msg.role === 'admin'
            return (
              <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
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
                    {msg.content}
                  </div>
                  {/* Bouton suppression : visible si message à soi OU admin */}
                  {(isMine || isAdmin) && (
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="ml-2 inline-block text-xs text-white/30 hover:text-red-400 transition mt-0.5"
                      title={t('kop.delete')}
                    >
                      <Trash2 className="w-3 h-3 inline" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Zone de saisie */}
      <div className="mt-3">
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
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 focus:border-sport-400/50 focus:outline-none rounded-lg text-sm resize-none placeholder-white/30"
                style={{ minHeight: '42px', maxHeight: '120px' }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !content.trim()}
                className="px-4 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold transition flex items-center justify-center"
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
    </div>
  )
}
