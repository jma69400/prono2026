// Client API centralisé
const TOKEN_KEY = 'prono26_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)

async function request(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`/api${path}`, { ...options, headers })
  } catch (networkErr) {
    // Erreur réseau réelle (backend down, CORS, DNS, etc.)
    throw new Error('Erreur réseau — le serveur backend ne répond pas. Vérifie qu\'il tourne sur http://localhost:8000')
  }

  if (res.status === 401) {
    setToken(null)
    throw new Error('Session expirée — reconnecte-toi')
  }

  if (!res.ok) {
    let errMsg = `Erreur ${res.status}`
    // Cas spéciaux qui ne renvoient pas du JSON (gérés par nginx/Caddy avant FastAPI)
    if (res.status === 413) {
      errMsg = "Fichier trop volumineux. Limite : 1,5 MB par image."
    } else if (res.status === 502 || res.status === 503 || res.status === 504) {
      errMsg = "Le serveur est temporairement indisponible. Réessaie dans quelques secondes."
    } else if (res.status >= 500) {
      // 500 par défaut, sera surchargé si le body contient un detail JSON
      errMsg = "Erreur serveur (500). L'équipe a été notifiée."
    }
    try {
      const err = await res.json()
      // Cas 1 : FastAPI HTTPException → { detail: "string" }
      if (typeof err.detail === 'string') {
        errMsg = err.detail
      }
      // Cas 2 : FastAPI validation error 422 → { detail: [{ loc, msg, type }] }
      else if (Array.isArray(err.detail)) {
        errMsg = err.detail.map(e => {
          const field = e.loc?.[e.loc.length - 1] || ''
          // Messages plus parlants pour erreurs courantes
          if (e.type === 'value_error' && field === 'email') return 'Email invalide'
          if (e.type === 'string_too_short' && field === 'username') return 'Pseudo trop court (min. 2 caractères)'
          if (e.type === 'string_too_short' && field === 'password') return 'Mot de passe trop court (min. 6 caractères)'
          return `${field}: ${e.msg}`
        }).join(' · ')
      }
    } catch {
      // pas de JSON dans la réponse (typiquement nginx/Caddy 413/502)
    }
    throw new Error(errMsg)
  }

  return res.json()
}

export const api = {
  signup: (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/me'),
  matches: () => request('/matches'),
  myPredictions: () => request('/predictions'),
  savePrediction: (match_id, home_score, away_score, over_under = null, btts = null) =>
    request('/predictions', {
      method: 'POST',
      body: JSON.stringify({ match_id, home_score, away_score, over_under, btts })
    }),
  // Renvoie l'objet complet { ranked: [...], ranked_count, excluded_admins, total_users }
  // Rétrocompatible : si une version ancienne du backend renvoie un tableau, on l'enveloppe.
  leaderboard: async () => {
    const data = await request('/leaderboard')
    if (Array.isArray(data)) {
      // Ancien format (tableau direct) — on encapsule pour compatibilité
      return { ranked: data, ranked_count: data.length, excluded_admins: 0, total_users: data.length }
    }
    return data
  },
  // Classement des GROUPES (score équilibré performance × engagement)
  leaderboardGroups: () => request('/leaderboard/groups'),
  // Récupère les logos pour une liste d'IDs (chargé en parallèle après la liste)
  leaderboardGroupsLogos: (ids) => request(`/leaderboard/groups/logos?ids=${ids.join(',')}`),
  // Stats du dernier match termine + pronostiqueurs ayant trouve le score exact
  lastMatchWinners: () => request('/stats/last-match-winners'),

  // Reactions emoji sur les messages Kop
  kopReact: (messageId, emoji) => request(`/kop/messages/${messageId}/react?emoji=${encodeURIComponent(emoji)}`, { method: 'POST' }),

  // Bilan personnalise au login (modale festive avec points gagnes)
  meLoginSummary: () => request('/me/login-summary'),

  // Liste des matchs recemment termines avec son prono (pour modale temps reel)
  meRecentMatchResults: () => request('/me/recent-match-results'),
  // === Donations / Supporters ===
  donationsStats: () => request('/donations/stats'),
  declareDonation: () => request('/donations/declare', { method: 'POST' }),
  meIsSupporter: () => request('/me/is-supporter'),
  // Upgrade rôle solo → leader (pour pouvoir créer un groupe)
  upgradeToLeader: () => request('/me/upgrade-to-leader', { method: 'POST' }),
  // Leader retire un membre de son groupe (le membre redevient solo, ses pronos conservés)
  removeMember: (groupId, userId) => request(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  // Récupère les pronos du groupe pour les matchs DÉJÀ COMMENCÉS (règle fair-play)
  // Retourne { members, matches, predictions: {match_id: {user_id: {home_score, away_score, points}}} }
  groupPredictions: (groupId) => request(`/groups/${groupId}/predictions`),

  // Statistiques temps réel : nombre d'utilisateurs en ligne (5 dernières minutes)
  statsOnline: () => request('/stats/online'),

  // === ADMIN : Injection de pronostic ===
  // Permet à un admin de saisir un prono pour un user (cas de récupération après bug).
  // Marche pour TOUS les matchs, recalcule les points si match terminé.
  adminInjectPrediction: (userId, matchId, homeScore, awayScore, reason) => request('/admin/predictions/inject', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      match_id: matchId,
      home_score: homeScore,
      away_score: awayScore,
      reason: reason || null,
    }),
  }),
  adminListInjectedPredictions: (limit = 50) => request(`/admin/predictions/injected?limit=${limit}`),
  // Endpoint optimisé : retourne matches + leaderboard + news en 1 appel
  // Utilisé par le polling principal pour réduire la charge serveur
  snapshot: (lang) => request('/snapshot' + (lang ? `?lang=${lang}` : '')),

  // === KOP UNITED — Chat communautaire ===
  kopListMessages: (beforeId = null, limit = 50) => {
    const params = new URLSearchParams()
    if (beforeId) params.set('before_id', beforeId)
    if (limit !== 50) params.set('limit', limit)
    const q = params.toString()
    return request('/kop/messages' + (q ? '?' + q : ''))
  },
  kopPostMessage: (content) => request('/kop/messages', {
    method: 'POST',
    body: JSON.stringify({ content }),
  }),
  kopDeleteMessage: (msgId) => request(`/kop/messages/${msgId}`, { method: 'DELETE' }),
  news: (team, lang) => {
    const params = new URLSearchParams()
    if (team) params.set('team', team)
    if (lang) params.set('lang', lang)
    const qs = params.toString()
    return request(`/news${qs ? `?${qs}` : ''}`)
  },
  refreshNews: () => request('/news/refresh', { method: 'POST' }),  // admin only
  refreshNewsPublic: () => request('/news/refresh-public', { method: 'POST' }),  // tous users (rate-limit 1/min serveur)
  translateMissingNews: () => request('/news/translate-missing', { method: 'POST' }),
  fetchResults: () => request('/admin/results/fetch', { method: 'POST' }),
  // Profil
  getProfile: () => request('/profile'),
  updateProfile: (data) => request('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (data) => request('/profile/password', { method: 'PUT', body: JSON.stringify(data) }),
  // Groupes
  myGroup: () => request('/groups/me'),
  createGroup: (data) => request('/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateGroup: (id, data) => request(`/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  groupMembers: (id) => request(`/groups/${id}/members`),
  joinGroup: (code) => request(`/groups/join/${code}`, { method: 'POST' }),
  previewGroup: (code) => request(`/groups/preview/${code}`),
  // Admin groupes
  adminListGroups: () => request('/admin/groups'),
  adminDeleteGroup: (id) => request(`/admin/groups/${id}`, { method: 'DELETE' }),
  adminRemoveMember: (groupId, userId) => request(`/admin/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  adminRegenerateCode: (groupId) => request(`/admin/groups/${groupId}/regenerate-code`, { method: 'POST' }),
  // Contact
  contact: (data) => request('/contact', { method: 'POST', body: JSON.stringify(data) }),
  // Admin
  adminUsers: () => request('/admin/users'),
  adminDeleteUser: (id, options = {}) => {
    const params = new URLSearchParams()
    if (options.reason) params.set('reason', options.reason)
    if (options.notify === false) params.set('notify', 'false')
    const query = params.toString() ? `?${params.toString()}` : ''
    return request(`/admin/users/${id}${query}`, { method: 'DELETE' })
  },
  adminUserPredictions: (id) => request(`/admin/users/${id}/predictions`),
  adminSetPrediction: (data) => request('/admin/predictions', { method: 'PUT', body: JSON.stringify(data) }),
  adminSetScore: (match_id, home_score, away_score) =>
    request(`/admin/matches/${match_id}/score`, { method: 'POST', body: JSON.stringify({ home_score, away_score }) }),
  adminResetScore: (match_id) =>
    request(`/admin/matches/${match_id}/reset-score`, { method: 'POST' }),
  adminAuditLog: () => request('/admin/audit-log'),
  adminContactMessages: (status) => request(`/admin/contact-messages${status ? `?status=${status}` : ''}`),
  adminUpdateContactStatus: (id, status) => request(`/admin/contact-messages/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  adminReplyContact: (id, reply, attachments) => request(`/admin/contact-messages/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ reply, attachments: attachments || [] })
  }),
  adminDeleteContact: (id) => request(`/admin/contact-messages/${id}`, { method: 'DELETE' }),

  // ===== AUTH : Reset password & welcome email =====
  passwordResetRequest: (email) => request('/auth/password-reset-request', {
    method: 'POST',
    body: JSON.stringify({ email })
  }),
  passwordResetConfirm: (token, password) => request('/auth/password-reset-confirm', {
    method: 'POST',
    body: JSON.stringify({ token, password })
  }),
  resendWelcomeEmail: () => request('/me/resend-welcome', { method: 'POST' }),

  // ===== CHAT-BOX : Messagerie interne user ↔ admin =====
  // Côté utilisateur
  myConversations: () => request('/me/conversations'),
  myConversationsUnreadCount: () => request('/me/conversations/unread-count'),
  myConversation: (id) => request(`/me/conversations/${id}`),
  createConversation: (subject, content, attachments) => request('/me/conversations', {
    method: 'POST',
    body: JSON.stringify({ subject, content, attachments: attachments || [] })
  }),
  sendConversationMessage: (convId, content, attachments) => request(`/me/conversations/${convId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, attachments: attachments || [] })
  }),
  // Côté admin
  adminConversations: (status) => request(`/admin/conversations${status ? `?status=${status}` : ''}`),
  adminConversationsUnreadCount: () => request('/admin/conversations/unread-count'),
  adminConversation: (id) => request(`/admin/conversations/${id}`),
  adminNewConversationToUser: (userId, subject, content, attachments) => request('/admin/conversations/new-to-user', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, subject, content, attachments: attachments || [] })
  }),
  adminReplyConversation: (convId, content, attachments) => request(`/admin/conversations/${convId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ content, attachments: attachments || [] })
  }),
  adminCloseConversation: (id) => request(`/admin/conversations/${id}/close`, { method: 'POST' }),
  adminDeleteConversation: (id) => request(`/admin/conversations/${id}`, { method: 'DELETE' }),
}
