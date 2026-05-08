import { useState, useEffect, useMemo } from 'react'
import { Trophy, Calendar, Users, Newspaper, Settings, LogOut, Sparkles, RefreshCw, Trash2, Lock, AlertCircle, Check, LogIn, ChevronDown, ChevronUp, TrendingUp, Target, Zap, User, BookOpen } from 'lucide-react'
import { api, getToken, setToken } from './api'
import { TEAMS, GROUPS, HOST_COUNTRIES, teamName, Flag } from './teams.jsx'
import { useTranslation } from './i18n.jsx'
import { predictMatch, getMatchOdds } from './predictor.js'

// =====================================================
// GOOGLE ANALYTICS 4 — Chargement dynamique
// =====================================================
// Charge le script GA4 et configure le tracking si l'ID est défini.
// Appelé une seule fois au boot de l'app (après fetch /api/config).
let _gaLoaded = false
function loadGoogleAnalytics(measurementId) {
  if (_gaLoaded || !measurementId) return
  _gaLoaded = true

  // 1. Injecter le script gtag.js
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
  document.head.appendChild(script)

  // 2. Initialiser le dataLayer + gtag
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  // anonymize_ip pour le RGPD
  window.gtag('config', measurementId, { anonymize_ip: true })

  console.log('[Analytics] GA4 chargé', measurementId)
}

// Helper : tracker un changement de "page virtuelle" dans la SPA
// Utilisé quand l'utilisateur change d'onglet (matches, leaderboard, etc.)
function trackPageView(pageName) {
  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_title: pageName,
      page_location: window.location.href,
    })
  }
}


// =====================================================
// LANG SWITCH (FR / EN / ES)
// =====================================================
function LangSwitch() {
  const { lang, setLang } = useTranslation()
  const flags = {
    fr: 'https://flagcdn.com/w40/fr.png',
    en: 'https://flagcdn.com/w40/gb.png',
    es: 'https://flagcdn.com/w40/es.png',
  }
  const labels = { fr: 'Français', en: 'English', es: 'Español' }
  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
      {['fr', 'en', 'es'].map(code => (
        <button key={code}
          onClick={() => setLang(code)}
          title={labels[code]}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded transition ${lang === code ? 'bg-orange-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
        >
          <img src={flags[code]} alt={code} style={{width: '18px', height: '13px', borderRadius: '2px'}} />
          <span>{code.toUpperCase()}</span>
        </button>
      ))}
    </div>
  )
}

// =====================================================
// AUTH SCREEN
// =====================================================
function AuthScreen({ onLogin, onGuest, initialMode = 'login', inviteCode = null, invitedGroup = null }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState(inviteCode ? 'signup' : initialMode)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [signupRole, setSignupRole] = useState(inviteCode ? 'solo' : 'solo')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const fn = mode === 'login' ? api.login : api.signup
      let data
      if (mode === 'login') {
        data = { email, password }
      } else {
        data = { email, username, password, role: inviteCode ? 'solo' : signupRole }
        if (inviteCode) data.invite_code = inviteCode
      }
      const result = await fn(data)
      setToken(result.token)
      onLogin(result.user)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
      <div className="absolute top-4 right-4"><LangSwitch /></div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <Trophy className="w-12 h-12 text-orange-400" />
            <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">United Pronos</h1>
          </div>
          <p className="text-white/60">{t('auth.subtitle')}</p>
        </div>

        {/* Bandeau invitation */}
        {invitedGroup && (
          <div className="mb-4 p-4 bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-400/30 rounded-2xl text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              {invitedGroup.logo_data ? (
                <img src={invitedGroup.logo_data} alt={invitedGroup.name} className="w-12 h-12 rounded-full object-cover border-2 border-orange-400" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-orange-500/30 flex items-center justify-center text-2xl">🏆</div>
              )}
              <div className="text-left">
                <div className="text-xs text-white/60">{t('signup.invitedTo')}</div>
                <div className="font-bold text-lg">{invitedGroup.name}</div>
              </div>
            </div>
            {invitedGroup.description && <p className="text-sm text-white/70">{invitedGroup.description}</p>}
            <div className="text-xs text-white/40 mt-2">{invitedGroup.member_count} {t('group.membersCount').replace('{count} ', '')}</div>
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
          <div className="flex gap-2 mb-6">
            <button type="button" onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${mode === 'login' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
              {t('auth.login')}
            </button>
            <button type="button" onClick={() => { setMode('signup'); setError('') }}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${mode === 'signup' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
              {t('auth.signup')}
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <input type="email" placeholder={t('auth.email')} required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400" />
            {mode === 'signup' && (
              <input type="text" placeholder={t('auth.username')} required minLength={2} value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400" />
            )}
            <input type="password" placeholder={t('auth.password')} required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400" />

            {/* Choix du rôle (uniquement à l'inscription, sauf si invité) */}
            {mode === 'signup' && !inviteCode && (
              <div className="space-y-2 pt-2">
                <label className="text-sm font-semibold text-white/70">{t('signup.chooseRole')}</label>
                <button type="button" onClick={() => setSignupRole('solo')}
                  className={`w-full p-3 rounded-lg border text-left transition ${
                    signupRole === 'solo'
                      ? 'bg-orange-500/20 border-orange-400/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🏃</div>
                    <div className="flex-1">
                      <div className="font-semibold">{t('role.solo')}</div>
                      <div className="text-xs text-white/60">{t('role.solo.desc')}</div>
                    </div>
                    {signupRole === 'solo' && <Check className="w-5 h-5 text-orange-400" />}
                  </div>
                </button>
                <button type="button" onClick={() => setSignupRole('leader')}
                  className={`w-full p-3 rounded-lg border text-left transition ${
                    signupRole === 'leader'
                      ? 'bg-orange-500/20 border-orange-400/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">👥</div>
                    <div className="flex-1">
                      <div className="font-semibold">{t('role.leader')}</div>
                      <div className="text-xs text-white/60">{t('role.leader.desc')}</div>
                    </div>
                    {signupRole === 'leader' && <Check className="w-5 h-5 text-orange-400" />}
                  </div>
                </button>
                {signupRole === 'leader' && (
                  <p className="text-xs text-orange-300/80 italic">→ {t('signup.continueAsLeader')}</p>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 rounded-lg font-bold transition">
              {loading ? '...' : (mode === 'login' ? t('auth.loginBtn') : t('auth.signupBtn'))}
            </button>
          </form>

          {/* Lien retour visiteur */}
          {onGuest && (
            <div className="mt-4 text-center">
              <button onClick={onGuest} className="text-sm text-white/50 hover:text-orange-400 transition">
                ← {t('auth.guestBack')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =====================================================
// HELPERS
// =====================================================
const isTBD = (code) => !code || code.startsWith('R32_') || code.startsWith('R16_') ||
                       code.startsWith('QF_') || code.startsWith('SF_') || code.startsWith('TBD_')

const stageLabel = (stage, t) => ({
  group: t('matches.stage.group'), r32: t('matches.stage.r32'), r16: t('matches.stage.r16'),
  qf: t('matches.stage.qf'), sf: t('matches.stage.sf'), '3rd': t('matches.stage.3rd'),
  final: t('matches.stage.final'),
}[stage] || stage)

// =====================================================
// MATCH CARD avec analyse IA détaillée
// =====================================================
function MatchCard({ match, prediction, onSave, isAdmin, onAdminSetScore, isGuest, onGuestPrompt }) {
  const { t, lang } = useTranslation()
  const [predH, setPredH] = useState(prediction?.home_score ?? '')
  const [predA, setPredA] = useState(prediction?.away_score ?? '')
  const [adminH, setAdminH] = useState(match.home_score ?? '')
  const [adminA, setAdminA] = useState(match.away_score ?? '')
  const [saved, setSaved] = useState(false)
  const [showAI, setShowAI] = useState(false)

  useEffect(() => {
    setPredH(prediction?.home_score ?? '')
    setPredA(prediction?.away_score ?? '')
  }, [prediction])

  useEffect(() => {
    setAdminH(match.home_score ?? '')
    setAdminA(match.away_score ?? '')
  }, [match])

  const homeTBD = isTBD(match.home_team)
  const awayTBD = isTBD(match.away_team)
  const anyTBD = homeTBD || awayTBD

  const ai = useMemo(() => {
    if (anyTBD) return null
    const isHostCountry = HOST_COUNTRIES.includes(match.home_team)
    return predictMatch(match.home_team, match.away_team, { isHostCountry })
  }, [match.home_team, match.away_team, anyTBD])

  const odds = useMemo(() => ai ? getMatchOdds(ai) : null, [ai])

  const locked = match.status === 'finished'
  const isLive = match.status === 'live'

  const save = async () => {
    if (predH === '' || predA === '' || anyTBD) return
    if (isGuest) { onGuestPrompt(); return }
    await onSave(match.id, parseInt(predH), parseInt(predA))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const date = new Date(match.match_date.replace(' ', 'T'))
  const dateLabel = date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  const isFinal = match.stage === 'final'

  return (
    <div className={`backdrop-blur border rounded-2xl p-5 transition ${
      isFinal ? 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-400/40'
              : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
    }`}>
      <div className="flex items-center justify-between mb-3 text-xs text-white/50 flex-wrap gap-2">
        <span className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-300 rounded font-bold animate-pulse">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
              {t('matches.live')}
            </span>
          )}
          <Calendar className="w-3 h-3" /> {dateLabel}
        </span>
        <span className="flex items-center gap-2 flex-wrap justify-end">
          {match.stage !== 'group' && (
            <span className={`px-2 py-0.5 rounded font-semibold ${
              isFinal ? 'bg-yellow-400/20 text-yellow-300' : 'bg-purple-500/20 text-purple-300'
            }`}>{stageLabel(match.stage, t)}</span>
          )}
          {match.group_letter && <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded">{t('matches.stage.group')} {match.group_letter}</span>}
          <span className="text-white/40">{match.stadium}</span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-right">
          <div className="mb-2 flex justify-end">{homeTBD ? <TBDBadge /> : <Flag code={match.home_team} size={48} />}</div>
          <div className="font-bold">{homeTBD ? t('matches.tbd') : teamName(match.home_team, lang)}</div>
          {odds && !locked && !isLive && <div className="text-xs text-orange-300 mt-1 font-mono">@{odds.home}</div>}
        </div>

        <div className="text-center min-w-[120px]">
          {(locked || isLive) ? (
            <div className={`text-3xl font-black ${isLive ? 'text-red-400' : 'text-orange-400'}`}>
              {match.home_score} - {match.away_score}
            </div>
          ) : (
            <>
              <div className="text-white/40 text-sm">{t('common.vs')}</div>
              {odds && <div className="text-xs text-white/50 mt-1 font-mono">{t('matches.draw')}@{odds.draw}</div>}
            </>
          )}
        </div>

        <div className="flex-1 text-left">
          <div className="mb-2 flex justify-start">{awayTBD ? <TBDBadge /> : <Flag code={match.away_team} size={48} />}</div>
          <div className="font-bold">{awayTBD ? t('matches.tbd') : teamName(match.away_team, lang)}</div>
          {odds && !locked && <div className="text-xs text-orange-300 mt-1 font-mono">@{odds.away}</div>}
        </div>
      </div>

      {/* Bandeau IA principal */}
      {ai && !locked && (
        <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <button onClick={() => setShowAI(!showAI)} className="w-full flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-purple-300">
              <Sparkles className="w-4 h-4" /> {t('matches.aiPredict')} : <strong className="text-white">{ai.home}-{ai.away}</strong>
              <span className="text-purple-400 text-xs">({ai.probability}%)</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-white/40 text-xs">
                {t('matches.confidence')} {t(`matches.confidence${ai.confidence === 'high' ? 'High' : ai.confidence === 'medium' ? 'Medium' : 'Low'}`)}
              </span>
              {showAI ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
            </span>
          </button>

          {/* Détail IA dépliable */}
          {showAI && (
            <div className="mt-3 pt-3 border-t border-purple-500/20 space-y-3">
              {/* Probabilités 1X2 */}
              <div>
                <div className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> 1X2</div>
                <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                  <div style={{ width: `${ai.probHome}%` }} className="bg-orange-500" title={`${ai.probHome}%`}></div>
                  <div style={{ width: `${ai.probDraw}%` }} className="bg-white/30" title={`${ai.probDraw}%`}></div>
                  <div style={{ width: `${ai.probAway}%` }} className="bg-pink-500" title={`${ai.probAway}%`}></div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-orange-300">{teamName(match.home_team, lang)} {ai.probHome}%</span>
                  <span className="text-white/50">{t('matches.draw')} {ai.probDraw}%</span>
                  <span className="text-pink-300">{teamName(match.away_team, lang)} {ai.probAway}%</span>
                </div>
              </div>

              {/* Scores les plus probables */}
              <div>
                <div className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><Target className="w-3 h-3" /> {t('matches.topScores')}</div>
                <div className="flex flex-wrap gap-2">
                  {ai.topScores.map((s, i) => (
                    <div key={i} className={`px-2 py-1 rounded text-xs font-mono ${i === 0 ? 'bg-purple-500/30 text-purple-200 border border-purple-400/30' : 'bg-white/5 text-white/60'}`}>
                      {s.home}-{s.away} <span className="text-white/40">({s.probability}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats avancées */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 rounded p-2">
                  <div className="text-xs text-white/50 mb-1">{t('matches.expectedGoals')}</div>
                  <div className="font-mono font-bold text-sm">{ai.expectedGoals.total}</div>
                </div>
                <div className="bg-white/5 rounded p-2">
                  <div className="text-xs text-white/50 mb-1">{t('matches.over25')}</div>
                  <div className="font-mono font-bold text-sm text-orange-300">{ai.over25}%</div>
                </div>
                <div className="bg-white/5 rounded p-2">
                  <div className="text-xs text-white/50 mb-1">{t('matches.btts')}</div>
                  <div className="font-mono font-bold text-sm text-orange-300">{ai.btts}%</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saisie prono */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {anyTBD ? (
          <div className="text-white/40 text-sm italic">{t('matches.tbd')}</div>
        ) : locked ? (
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Lock className="w-4 h-4" />
            {prediction ? (
              <>
                {t('matches.yourPred')} : <strong>{prediction.home_score}-{prediction.away_score}</strong>
                <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded text-xs">
                  {prediction.points} {t('matches.points')}
                </span>
              </>
            ) : (
              <span>{t('matches.noPrediction')}</span>
            )}
          </div>
        ) : (
          <>
            <input type="number" min="0" max="20" value={predH} onChange={(e) => setPredH(e.target.value)}
              disabled={isGuest}
              className="w-16 px-2 py-1 bg-white/5 border border-white/10 rounded text-center font-bold disabled:opacity-50" />
            <span className="text-white/40">-</span>
            <input type="number" min="0" max="20" value={predA} onChange={(e) => setPredA(e.target.value)}
              disabled={isGuest}
              className="w-16 px-2 py-1 bg-white/5 border border-white/10 rounded text-center font-bold disabled:opacity-50" />
            <button onClick={save}
              disabled={!isGuest && (predH === '' || predA === '')}
              className="ml-2 px-4 py-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 rounded font-semibold text-sm transition flex items-center gap-1">
              {isGuest ? <><LogIn className="w-3 h-3" /> {t('auth.guestLogin')}</> : (saved ? <><Check className="w-3 h-3" /> OK</> : t('matches.pronostic'))}
            </button>
          </>
        )}
      </div>

      {/* Admin score */}
      {isAdmin && !locked && !anyTBD && (
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-center gap-2">
          <span className="text-xs text-white/40">{t('matches.adminScore')} :</span>
          <input type="number" min="0" max="20" value={adminH} onChange={(e) => setAdminH(e.target.value)}
            className="w-14 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-center text-sm" />
          <span className="text-white/40">-</span>
          <input type="number" min="0" max="20" value={adminA} onChange={(e) => setAdminA(e.target.value)}
            className="w-14 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-center text-sm" />
          <button onClick={() => onAdminSetScore(match.id, parseInt(adminH), parseInt(adminA))}
            disabled={adminH === '' || adminA === ''}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-30 rounded text-sm transition">
            {t('matches.validate')}
          </button>
        </div>
      )}
    </div>
  )
}

function TBDBadge() {
  return <div style={{
    width: 48, height: 32, background: 'rgba(255,255,255,0.05)',
    border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 3,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500,
  }}>?</div>
}

// =====================================================
// MATCHES TAB
// =====================================================
function MatchesTab({ matches, predictions, onSave, isAdmin, onAdminSetScore, isGuest, onGuestPrompt }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')

  const filtered = matches.filter(m => {
    if (filter !== 'all' && m.status !== filter) return false
    if (stageFilter !== 'all' && m.stage !== stageFilter) return false
    return true
  })

  const stages = ['all', 'group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final']

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: 'all', label: t('matches.all'), count: matches.length },
          { id: 'scheduled', label: t('matches.upcoming'), count: matches.filter(m => m.status === 'scheduled').length },
          { id: 'finished', label: t('matches.finished'), count: matches.filter(m => m.status === 'finished').length },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${filter === f.id ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-white/10">
        {stages.map(s => {
          const count = s === 'all' ? matches.length : matches.filter(m => m.stage === s).length
          if (count === 0 && s !== 'all') return null
          return (
            <button key={s} onClick={() => setStageFilter(s)}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${stageFilter === s ? 'bg-purple-500/30 text-purple-200 border border-purple-400/30' : 'bg-white/5 text-white/40 hover:bg-white/10 border border-transparent'}`}>
              {s === 'all' ? t('matches.all') : stageLabel(s, t)} {count > 0 && `(${count})`}
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-white/40">Aucun match</div>
        ) : (
          filtered.map(m => (
            <MatchCard key={m.id} match={m} prediction={predictions.find(p => p.match_id === m.id)}
              onSave={onSave} isAdmin={isAdmin} onAdminSetScore={onAdminSetScore}
              isGuest={isGuest} onGuestPrompt={onGuestPrompt} />
          ))
        )}
      </div>
    </div>
  )
}

// =====================================================
// LEADERBOARD TAB
// =====================================================
function LeaderboardTab({ leaderboard, currentUserId }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      {leaderboard.length === 0 ? (
        <div className="text-center py-12 text-white/40">Aucun participant</div>
      ) : leaderboard.map((entry, i) => (
        <div key={entry.id}
          className={`flex items-center gap-3 p-4 rounded-xl border transition ${
            entry.id === currentUserId ? 'bg-orange-500/10 border-orange-400/40' : 'bg-white/5 border-white/10'
          }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 ${
            i === 0 ? 'bg-yellow-400/20 text-yellow-300' :
            i === 1 ? 'bg-gray-300/20 text-gray-200' :
            i === 2 ? 'bg-orange-700/30 text-orange-400' : 'bg-white/5 text-white/60'
          }`}>{i + 1}</div>
          {/* Avatar utilisateur (ou initiales si pas d'avatar) */}
          {entry.avatar_data ? (
            <img src={entry.avatar_data} alt={entry.username}
              className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-xs font-black shrink-0">
              {entry.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          {/* Logo du groupe si l'utilisateur en fait partie */}
          {entry.group_logo ? (
            <img src={entry.group_logo} alt={entry.group_name} title={entry.group_name}
              className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0" />
          ) : entry.group_name ? (
            <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center text-sm shrink-0" title={entry.group_name}>
              🏆
            </div>
          ) : null}
          <div className="flex-1 min-w-0">
            <div className="font-bold flex items-center gap-2 flex-wrap">
              {entry.username}
              {entry.role === 'leader' && <span className="text-xs text-purple-300">👑</span>}
            </div>
            <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap">
              {entry.group_name && <span className="text-orange-300/70">{entry.group_name} ·</span>}
              <span>{entry.predictions_count} {entry.predictions_count > 1 ? t('leaderboard.predictions_plural') : t('leaderboard.predictions')}</span>
            </div>
          </div>
          <div className="text-2xl font-black text-orange-400 shrink-0">
            {entry.total_points}<span className="text-sm text-white/40 ml-1">{t('matches.points')}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// =====================================================
// GROUPS TAB
// =====================================================
function GroupsTab() {
  const { t, lang } = useTranslation()
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.entries(GROUPS).map(([letter, teams]) => (
        <div key={letter} className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-black">{letter}</div>
            <span className="text-sm text-white/50">{t('groups.title')} {letter}</span>
          </div>
          <div className="space-y-2">
            {teams.map(code => (
              <div key={code} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                <Flag code={code} size={28} />
                <span className="font-semibold">{teamName(code, lang)}</span>
                <span className="ml-auto text-xs text-white/40">{t('groups.elo')} {TEAMS[code]?.elo ?? '?'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// =====================================================
// NEWS TAB avec filtre langue
// =====================================================
function NewsTab({ news, onRefresh, isAdmin }) {
  const { t, lang } = useTranslation()
  const [teamFilter, setTeamFilter] = useState('')
  const [translating, setTranslating] = useState(false)
  const [translateMsg, setTranslateMsg] = useState('')

  const filtered = news.filter(n => !teamFilter || n.team === teamFilter)
  const availableTeams = [...new Set(news.map(n => n.team).filter(Boolean))].slice(0, 12)

  const handleTranslate = async () => {
    setTranslating(true); setTranslateMsg('')
    try {
      const res = await api.translateMissingNews()
      setTranslateMsg(`✓ ${res.translated} news traduites (${res.failed} échecs sur ${res.checked})`)
      // Refresh la liste
      if (onRefresh) await onRefresh()
    } catch (e) {
      setTranslateMsg('✗ ' + (e.message || 'Erreur'))
    } finally {
      setTranslating(false)
      setTimeout(() => setTranslateMsg(''), 8000)
    }
  }

  return (
    <div>
      {/* Filtre par équipe */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTeamFilter('')} className={`px-3 py-1.5 rounded-full text-sm ${!teamFilter ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
            {t('news.all')}
          </button>
          {availableTeams.map(team => (
            <button key={team} onClick={() => setTeamFilter(team)}
              className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 ${teamFilter === team ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
              <Flag code={team} size={20} /> {teamName(team, lang)}
            </button>
          ))}
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleTranslate} disabled={translating}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
              🌍 {translating ? '...' : 'Traduire manquantes'}
            </button>
            <button onClick={onRefresh} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> {t('news.refresh')}
            </button>
          </div>
        )}
      </div>

      {translateMsg && (
        <div className="mb-3 p-2 bg-orange-500/10 border border-orange-400/30 rounded-lg text-sm text-orange-200 text-center">
          {translateMsg}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t('news.empty')}</p>
          <p className="text-sm mt-2">{t('news.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(n => (
            <a key={n.id} href={n.link} target="_blank" rel="noopener noreferrer"
              className="block p-4 bg-white/5 hover:bg-white/[0.08] border border-white/10 rounded-xl transition">
              <div className="flex items-start gap-3">
                {n.team && <Flag code={n.team} size={32} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 text-xs text-white/40 flex-wrap">
                    <span className="px-2 py-0.5 bg-white/5 rounded">{n.source}</span>
                    {n.translated && (
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded uppercase text-[10px] font-semibold" title={`Traduit depuis ${n.lang}`}>
                        🌐 {n.lang} → {lang}
                      </span>
                    )}
                    {n.team && <span>· {teamName(n.team, lang)}</span>}
                    <span className={`ml-auto px-2 py-0.5 rounded ${
                      n.sentiment === 'positive' ? 'bg-green-500/20 text-green-300' :
                      n.sentiment === 'negative' ? 'bg-red-500/20 text-red-300' :
                      'bg-white/5 text-white/60'
                    }`}>
                      {n.sentiment === 'positive' ? `↗ ${t('news.positive')}` : n.sentiment === 'negative' ? `↘ ${t('news.negative')}` : `→ ${t('news.neutral')}`}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1">{n.title}</h3>
                  {n.summary && <p className="text-sm text-white/60 line-clamp-2">{n.summary.replace(/<[^>]+>/g, '')}</p>}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// =====================================================
// ADMIN SCORES PANEL — Gestion rapide des scores des matchs
// =====================================================
function AdminScoresPanel() {
  const { t, lang } = useTranslation()
  const [matches, setMatches] = useState([])
  const [filter, setFilter] = useState('today')
  const [savingId, setSavingId] = useState(null)
  const [scores, setScores] = useState({}) // { matchId: { h: '2', a: '1' } }
  const [toast, setToast] = useState(null) // { type: 'success'|'error', msg: '...' }

  const loadMatches = async () => {
    try {
      const data = await api.matches()
      setMatches(data)
      // Initialiser les scores avec les valeurs actuelles
      const init = {}
      data.forEach(m => {
        init[m.id] = {
          h: m.home_score !== null ? String(m.home_score) : '',
          a: m.away_score !== null ? String(m.away_score) : ''
        }
      })
      setScores(init)
    } catch (e) {
      showToast('error', e.message || 'Erreur de chargement')
    }
  }

  useEffect(() => { loadMatches() }, [])

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const updateScore = (matchId, field, value) => {
    // Restreindre à entiers 0-20
    if (value !== '' && (!/^\d+$/.test(value) || parseInt(value) > 20)) return
    setScores(s => ({ ...s, [matchId]: { ...s[matchId], [field]: value } }))
  }

  const saveScore = async (match) => {
    const s = scores[match.id]
    if (!s || s.h === '' || s.a === '') {
      showToast('error', 'Saisis les deux scores')
      return
    }
    setSavingId(match.id)
    try {
      const res = await api.adminSetScore(match.id, parseInt(s.h), parseInt(s.a))
      showToast('success', `✓ Score enregistré · ${res.predictions_recalculated || 0} pronostic(s) recalculé(s)`)
      await loadMatches()
    } catch (e) {
      showToast('error', e.message || 'Erreur')
    } finally {
      setSavingId(null)
    }
  }

  const resetScore = async (match) => {
    if (!confirm(`Annuler le score de ${teamName(match.home_team, lang)} vs ${teamName(match.away_team, lang)} ?\nLes points des pronostiqueurs seront remis à 0.`)) return
    setSavingId(match.id)
    try {
      await api.adminResetScore(match.id)
      showToast('success', '✓ Score annulé · pronostics remis à 0')
      await loadMatches()
    } catch (e) {
      showToast('error', e.message || 'Erreur')
    } finally {
      setSavingId(null)
    }
  }

  // Filtrage
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  const filtered = matches.filter(m => {
    const d = new Date(m.match_date.replace(' ', 'T'))
    if (filter === 'today') return d >= today && d < tomorrow
    if (filter === 'live') return m.status === 'live' || m.status === 'in_play'
    if (filter === 'finished') return m.status === 'finished'
    if (filter === 'scheduled') return m.status === 'scheduled' && d >= today
    if (filter === 'past_unfinished') {
      // matchs passés mais pas terminés (à saisir en priorité !)
      return d < today && m.status !== 'finished'
    }
    return true
  }).sort((a, b) => new Date(a.match_date) - new Date(b.match_date))

  // Stats
  const stats = {
    total: matches.length,
    finished: matches.filter(m => m.status === 'finished').length,
    today: matches.filter(m => {
      const d = new Date(m.match_date.replace(' ', 'T'))
      return d >= today && d < tomorrow
    }).length,
    pastUnfinished: matches.filter(m => {
      const d = new Date(m.match_date.replace(' ', 'T'))
      return d < today && m.status !== 'finished'
    }).length
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border max-w-md ${
          toast.type === 'success'
            ? 'bg-green-500/90 border-green-400 text-white'
            : 'bg-red-500/90 border-red-400 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-orange-300">{stats.total}</div>
          <div className="text-xs text-white/50 mt-0.5">Matchs total</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-green-300">{stats.finished}</div>
          <div className="text-xs text-white/50 mt-0.5">Joués</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-orange-300">{stats.today}</div>
          <div className="text-xs text-white/50 mt-0.5">Aujourd'hui</div>
        </div>
        <div className={`border rounded-xl p-3 text-center ${
          stats.pastUnfinished > 0 ? 'bg-red-500/10 border-red-500/40' : 'bg-white/5 border-white/10'
        }`}>
          <div className={`text-2xl font-black ${stats.pastUnfinished > 0 ? 'text-red-300' : 'text-white/40'}`}>
            {stats.pastUnfinished}
          </div>
          <div className="text-xs text-white/50 mt-0.5">À saisir ⚠️</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { id: 'today', label: '📅 Aujourd\'hui', count: stats.today },
          { id: 'past_unfinished', label: '⚠️ À saisir', count: stats.pastUnfinished, urgent: true },
          { id: 'scheduled', label: '🗓 À venir', count: matches.filter(m => {
            const d = new Date(m.match_date.replace(' ', 'T'))
            return m.status === 'scheduled' && d >= today
          }).length },
          { id: 'finished', label: '✅ Terminés', count: stats.finished },
          { id: 'all', label: 'Tous', count: stats.total },
        ].map(f => (
          <button key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
              filter === f.id
                ? (f.urgent && f.count > 0 ? 'bg-red-500 text-white' : 'bg-orange-500 text-white')
                : f.urgent && f.count > 0
                ? 'bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
            }`}>
            {f.label} <span className="ml-1 opacity-70">({f.count})</span>
          </button>
        ))}
      </div>

      {/* Liste des matchs */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucun match dans ce filtre</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const d = new Date(m.match_date.replace(' ', 'T'))
            const dateLabel = d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US', {
              weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            })
            const isFinished = m.status === 'finished'
            const isPastUnfinished = d < today && !isFinished
            const s = scores[m.id] || { h: '', a: '' }
            const isSaving = savingId === m.id
            const homeTBD = !m.home_team || m.home_team === 'TBD'
            const awayTBD = !m.away_team || m.away_team === 'TBD'

            return (
              <div key={m.id} className={`p-3 rounded-xl border transition ${
                isFinished ? 'bg-green-500/5 border-green-500/30' :
                isPastUnfinished ? 'bg-red-500/5 border-red-500/40' :
                'bg-white/5 border-white/10'
              }`}>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Date + Badge */}
                  <div className="text-xs text-white/50 min-w-[140px]">
                    {dateLabel}
                    {isPastUnfinished && (
                      <div className="text-red-300 font-bold mt-1">⚠️ À saisir !</div>
                    )}
                    {isFinished && (
                      <div className="text-green-300 font-bold mt-1">✓ Terminé</div>
                    )}
                  </div>

                  {/* Match */}
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <div className="flex items-center gap-1">
                      {!homeTBD && <Flag code={m.home_team} size={20} />}
                      <span className="font-semibold text-sm">{homeTBD ? 'TBD' : teamName(m.home_team, lang)}</span>
                    </div>
                    <span className="text-white/30 text-xs">vs</span>
                    <div className="flex items-center gap-1">
                      {!awayTBD && <Flag code={m.away_team} size={20} />}
                      <span className="font-semibold text-sm">{awayTBD ? 'TBD' : teamName(m.away_team, lang)}</span>
                    </div>
                  </div>

                  {/* Inputs score */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={s.h}
                      onChange={(e) => updateScore(m.id, 'h', e.target.value)}
                      disabled={isSaving || homeTBD || awayTBD}
                      placeholder="–"
                      className="w-12 px-2 py-1.5 bg-white/5 border border-white/20 rounded text-center font-bold focus:outline-none focus:border-orange-400 disabled:opacity-30"
                    />
                    <span className="text-white/40">-</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={s.a}
                      onChange={(e) => updateScore(m.id, 'a', e.target.value)}
                      disabled={isSaving || homeTBD || awayTBD}
                      placeholder="–"
                      className="w-12 px-2 py-1.5 bg-white/5 border border-white/20 rounded text-center font-bold focus:outline-none focus:border-orange-400 disabled:opacity-30"
                    />
                  </div>

                  {/* Boutons */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => saveScore(m)}
                      disabled={isSaving || s.h === '' || s.a === '' || homeTBD || awayTBD}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 rounded text-sm font-bold transition flex items-center gap-1"
                      title={isFinished ? 'Modifier le score' : 'Valider le score'}
                    >
                      {isSaving ? '...' : isFinished ? '✏️' : <Check className="w-4 h-4" />}
                    </button>
                    {isFinished && (
                      <button
                        onClick={() => resetScore(m)}
                        disabled={isSaving}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 disabled:opacity-30 rounded text-sm transition"
                        title="Annuler le score (remettre le match comme non joué)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-white/30 text-center mt-4 italic">
        💡 Les points des pronostiqueurs sont recalculés automatiquement après chaque modification.
      </p>
    </div>
  )
}


// =====================================================
// ADMIN TAB
// =====================================================
function AdminTab({ user }) {
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [tab, setTab] = useState('scores')
  const [fetchingResults, setFetchingResults] = useState(false)
  const [resultsMsg, setResultsMsg] = useState('')

  useEffect(() => {
    api.adminUsers().then(setUsers).catch(() => {})
    api.adminAuditLog().then(setAuditLog).catch(() => {})
  }, [])

  const deleteUser = async (id) => {
    if (!confirm(t('admin.deleteConfirm'))) return
    await api.adminDeleteUser(id)
    setUsers(await api.adminUsers())
  }

  const handleFetchResults = async () => {
    setFetchingResults(true); setResultsMsg('')
    try {
      const r = await api.fetchResults()
      if (r.ok) {
        setResultsMsg(`✓ ${r.updated} match(s) mis à jour, ${r.skipped} déjà à jour, ${r.errors} erreurs sur ${r.checked} vérifiés`)
      } else {
        setResultsMsg(`✗ ${r.error || 'Erreur'}`)
      }
    } catch (e) {
      setResultsMsg('✗ ' + (e.message || 'Erreur'))
    } finally {
      setFetchingResults(false)
      setTimeout(() => setResultsMsg(''), 12000)
    }
  }

  return (
    <div>
      {/* Bouton fetch résultats — toujours visible pour l'admin */}
      <div className="mb-4 p-4 bg-gradient-to-br from-orange-500/10 to-pink-500/5 border border-orange-400/30 rounded-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-bold text-orange-200 mb-0.5">⚽ Résultats des matchs</div>
            <div className="text-xs text-white/50">Récupération automatique toutes les 5 min via Football-Data.org</div>
          </div>
          <button onClick={handleFetchResults} disabled={fetchingResults}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg text-sm font-semibold flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${fetchingResults ? 'animate-spin' : ''}`} />
            {fetchingResults ? '...' : 'Actualiser maintenant'}
          </button>
        </div>
        {resultsMsg && (
          <div className="mt-3 p-2 bg-white/5 border border-white/10 rounded text-sm text-orange-100">
            {resultsMsg}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setTab('scores')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'scores' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
          ⚽ Scores
        </button>
        <button onClick={() => setTab('users')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'users' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
          {t('admin.users')} ({users.length})
        </button>
        <button onClick={() => setTab('groups')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'groups' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
          👥 {t('admin.groups')}
        </button>
        <button onClick={() => setTab('contact')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'contact' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
          ✉️ {t('contact.adminTitle')}
        </button>
        <button onClick={() => setTab('audit')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'audit' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
          {t('admin.audit')}
        </button>
      </div>

      {tab === 'scores' && <AdminScoresPanel />}

      {tab === 'users' && (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-black text-sm">
                {u.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{u.username}</div>
                <div className="text-xs text-white/40 truncate">{u.email}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${
                u.role === 'admin' ? 'bg-red-500/20 text-red-300' :
                u.role === 'leader' ? 'bg-purple-500/20 text-purple-300' :
                'bg-white/5 text-white/60'
              }`}>
                {u.role}
              </span>
              {u.id !== user.id && (
                <button onClick={() => deleteUser(u.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'groups' && <AdminGroupsPanel />}

      {tab === 'contact' && <AdminContactPanel />}

      {tab === 'audit' && (
        <div className="space-y-1">
          {auditLog.map(log => (
            <div key={log.id} className="flex items-center gap-3 p-2 bg-white/5 rounded text-sm flex-wrap">
              <span className="text-xs text-white/40 w-32 shrink-0">{log.created_at}</span>
              <span className="font-semibold text-orange-300 w-32 shrink-0">{log.action}</span>
              <span className="text-white/60 truncate flex-1">{log.username || 'anonyme'} {log.details && `· ${log.details}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =====================================================
// GUEST PROMPT MODAL
// =====================================================
function GuestPrompt({ onClose, onSignin }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gradient-to-br from-[#1a1f3a] to-[#0a0e27] border border-orange-400/30 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <Lock className="w-6 h-6 text-orange-400" />
          <h3 className="text-xl font-bold">{t('auth.guestPromptTitle')}</h3>
        </div>
        <p className="text-white/70 mb-6">{t('auth.guestPromptText')}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm">
            {t('auth.guestBack')}
          </button>
          <button onClick={onSignin} className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 rounded-lg font-bold text-sm">
            {t('auth.guestPromptBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// HOMEPAGE (page d'accueil vendeuse)
// =====================================================
function HomePage({ onSignup, onLogin, onContinueAsGuest, onContact }) {
  const { t, lang } = useTranslation()

  // URLs SEO adaptées à la langue active
  const seoUrls = {
    fr: {
      schedule: '/seo/calendrier-coupe-du-monde-2026.html',
      groups: '/seo/groupes-coupe-du-monde-2026.html',
      teams: '/seo/equipes-qualifiees-mondial-2026.html',
      stadiums: '/seo/stades-coupe-du-monde-2026.html',
      format: '/seo/format-48-equipes-mondial-2026.html',
      favorites: '/seo/favoris-coupe-du-monde-2026.html',
    },
    en: {
      schedule: '/seo/en/world-cup-2026-schedule.html',
      groups: '/seo/en/world-cup-2026-groups.html',
      teams: '/seo/en/qualified-teams-world-cup-2026.html',
      stadiums: '/seo/en/world-cup-2026-stadiums.html',
      format: '/seo/en/48-teams-format-world-cup-2026.html',
      favorites: '/seo/en/world-cup-2026-favorites.html',
    },
    es: {
      schedule: '/seo/es/calendario-mundial-2026.html',
      groups: '/seo/es/grupos-mundial-2026.html',
      teams: '/seo/es/equipos-clasificados-mundial-2026.html',
      stadiums: '/seo/es/estadios-mundial-2026.html',
      format: '/seo/es/formato-48-equipos-mundial-2026.html',
      favorites: '/seo/es/favoritos-mundial-2026.html',
    },
  }
  const urls = seoUrls[lang] || seoUrls.fr

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
      {/* Top nav */}
      <header className="border-b border-white/10 backdrop-blur bg-black/20 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Trophy className="w-7 h-7 text-orange-400" />
            <h1 className="font-black text-xl bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">United Pronos</h1>
          </div>
          <div className="flex items-center gap-2">
            <LangSwitch />
            {onContact && (
              <button onClick={onContact} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                title={t('contact.title')}>
                ✉️ <span className="hidden sm:inline">{t('contact.menuItem')}</span>
              </button>
            )}
            <button onClick={onLogin} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-semibold flex items-center gap-1.5">
              <LogIn className="w-3.5 h-3.5" /> {t('auth.login')}
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/10 via-transparent to-transparent pointer-events-none"></div>
        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-orange-500/10 border border-orange-400/20 rounded-full text-sm text-orange-200">
            <Zap className="w-4 h-4" /> 11 juin – 19 juillet 2026 · USA · Canada · Mexique
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black mb-6 leading-tight">
            <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-orange-400 bg-clip-text text-transparent">
              {t('home.heroTitle')}
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-4">
            {t('home.heroSubtitle')}
          </p>
          <p className="text-base text-orange-300/90 max-w-2xl mx-auto mb-10 font-semibold">
            {t('home.heroPitch')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={onSignup}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition">
              <Sparkles className="w-5 h-5" /> {t('home.startCta')}
            </button>
            <button onClick={onLogin}
              className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-semibold transition">
              {t('home.loginCta')}
            </button>
          </div>
          <button onClick={onContinueAsGuest} className="mt-6 text-sm text-white/40 hover:text-white/70 transition">
            ↓ {t('home.scrollHint')}
          </button>
        </div>
      </section>

      {/* SECTION SEO — Tout sur le Mondial 2026 (mise en avant en haut) */}
      <section className="py-10 border-y border-white/10 bg-black/20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-6">
            <div className="inline-block px-3 py-1 mb-2 bg-orange-500/10 border border-orange-400/30 rounded-full text-xs font-bold text-orange-300 uppercase tracking-wider">
              📚 {t('home.seoBadge')}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-2">{t('home.seoLinksTitle')}</h2>
            <p className="text-sm text-white/50">{t('home.seoLinksSubtitle')}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <a href={urls.favorites}
              className="group relative p-4 bg-gradient-to-br from-yellow-400/15 to-orange-500/10 hover:from-yellow-400/25 hover:to-orange-500/20 border border-yellow-400/40 hover:border-yellow-400/70 rounded-xl transition text-center md:col-span-1">
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full">⭐ {t('home.seoNew')}</div>
              <div className="text-2xl mb-1.5">🥇</div>
              <div className="font-bold text-sm">{t('home.seoFavorites')}</div>
              <div className="text-xs text-white/40 mt-0.5">{t('home.seoFavoritesSub')}</div>
            </a>
            <a href={urls.schedule}
              className="group relative p-4 bg-gradient-to-br from-orange-500/10 to-pink-500/5 hover:from-orange-500/20 hover:to-pink-500/10 border border-white/10 hover:border-orange-400/50 rounded-xl transition text-center">
              <div className="text-2xl mb-1.5">📅</div>
              <div className="font-bold text-sm">{t('home.seoSchedule')}</div>
              <div className="text-xs text-white/40 mt-0.5">{t('home.seoScheduleSub')}</div>
            </a>
            <a href={urls.groups}
              className="group relative p-4 bg-gradient-to-br from-orange-500/10 to-pink-500/5 hover:from-orange-500/20 hover:to-pink-500/10 border border-white/10 hover:border-orange-400/50 rounded-xl transition text-center">
              <div className="text-2xl mb-1.5">👥</div>
              <div className="font-bold text-sm">{t('home.seoGroups')}</div>
              <div className="text-xs text-white/40 mt-0.5">{t('home.seoGroupsSub')}</div>
            </a>
            <a href={urls.teams}
              className="group relative p-4 bg-gradient-to-br from-orange-500/10 to-pink-500/5 hover:from-orange-500/20 hover:to-pink-500/10 border border-white/10 hover:border-orange-400/50 rounded-xl transition text-center">
              <div className="text-2xl mb-1.5">🌍</div>
              <div className="font-bold text-sm">{t('home.seoTeams')}</div>
              <div className="text-xs text-white/40 mt-0.5">{t('home.seoTeamsSub')}</div>
            </a>
            <a href={urls.stadiums}
              className="group relative p-4 bg-gradient-to-br from-orange-500/10 to-pink-500/5 hover:from-orange-500/20 hover:to-pink-500/10 border border-white/10 hover:border-orange-400/50 rounded-xl transition text-center">
              <div className="text-2xl mb-1.5">🏟️</div>
              <div className="font-bold text-sm">{t('home.seoStadiums')}</div>
              <div className="text-xs text-white/40 mt-0.5">{t('home.seoStadiumsSub')}</div>
            </a>
            <a href={urls.format}
              className="group relative p-4 bg-gradient-to-br from-orange-500/10 to-pink-500/5 hover:from-orange-500/20 hover:to-pink-500/10 border border-white/10 hover:border-orange-400/50 rounded-xl transition text-center">
              <div className="text-2xl mb-1.5">📋</div>
              <div className="font-bold text-sm">{t('home.seoFormat')}</div>
              <div className="text-xs text-white/40 mt-0.5">{t('home.seoFormatSub')}</div>
            </a>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-10 border-y border-white/10 bg-black/20">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-4xl font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">104</div>
            <div className="text-sm text-white/50 mt-1">{t('home.statsMatches')}</div>
          </div>
          <div>
            <div className="text-4xl font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">48</div>
            <div className="text-sm text-white/50 mt-1">{t('home.statsTeams')}</div>
          </div>
          <div>
            <div className="text-4xl font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">3</div>
            <div className="text-sm text-white/50 mt-1">{t('home.statsLanguages')}</div>
          </div>
          <div>
            <div className="text-4xl font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">100%</div>
            <div className="text-sm text-white/50 mt-1">{t('home.statsFree')}</div>
          </div>
        </div>
      </section>

      {/* ===== 3 MODES (le cœur de la page) ===== */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 mb-4 bg-orange-500/10 border border-orange-400/30 rounded-full text-xs font-bold text-orange-300 uppercase tracking-wider">
              {t('home.modes.badge')}
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-4">{t('home.modes.title')}</h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">{t('home.modes.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* MODE 1 — SOLO */}
            <div className="relative bg-white/5 border border-white/10 rounded-3xl p-8 hover:border-orange-400/40 transition group">
              <div className="text-5xl mb-4">🏃</div>
              <h3 className="text-2xl font-black mb-2">{t('home.modes.solo.title')}</h3>
              <p className="text-orange-300 font-semibold mb-4 text-sm">{t('home.modes.solo.tagline')}</p>
              <p className="text-white/70 text-sm mb-6 leading-relaxed">{t('home.modes.solo.desc')}</p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.solo.bullet1')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.solo.bullet2')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.solo.bullet3')}</span></li>
              </ul>
              <button onClick={onSignup}
                className="w-full py-3 bg-white/5 hover:bg-orange-500 border border-white/10 hover:border-orange-500 rounded-lg font-bold text-sm transition group-hover:bg-orange-500/10">
                {t('home.modes.solo.cta')} →
              </button>
              <div className="mt-3 text-center text-xs text-white/40">{t('home.modes.free')}</div>
            </div>

            {/* MODE 2 — GROUPE (mis en avant) */}
            <div className="relative bg-gradient-to-br from-orange-500/10 to-pink-500/10 border-2 border-orange-400/40 rounded-3xl p-8 hover:border-orange-400/60 transition group shadow-xl shadow-orange-500/10 md:scale-105">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap">
                ⭐ {t('home.modes.popular')}
              </div>
              <div className="text-5xl mb-4">👥</div>
              <h3 className="text-2xl font-black mb-2">{t('home.modes.group.title')}</h3>
              <p className="text-orange-300 font-semibold mb-4 text-sm">{t('home.modes.group.tagline')}</p>
              <p className="text-white/70 text-sm mb-6 leading-relaxed">{t('home.modes.group.desc')}</p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.group.bullet1')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.group.bullet2')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.group.bullet3')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.group.bullet4')}</span></li>
              </ul>
              <button onClick={onSignup}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 rounded-lg font-bold text-sm transition shadow-lg shadow-orange-500/20">
                {t('home.modes.group.cta')} →
              </button>
              <div className="mt-3 text-center text-xs text-white/40">{t('home.modes.free')}</div>
            </div>

            {/* MODE 3 — PRO ENTREPRISE */}
            <div className="relative bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-400/30 rounded-3xl p-8 hover:border-purple-400/50 transition group">
              <div className="text-5xl mb-4">🏢</div>
              <h3 className="text-2xl font-black mb-2">{t('home.modes.pro.title')}</h3>
              <p className="text-purple-300 font-semibold mb-4 text-sm">{t('home.modes.pro.tagline')}</p>
              <p className="text-white/70 text-sm mb-6 leading-relaxed">{t('home.modes.pro.desc')}</p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.pro.bullet1')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.pro.bullet2')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.pro.bullet3')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.pro.bullet4')}</span></li>
              </ul>
              <button onClick={onSignup}
                className="w-full py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500 hover:to-blue-500 border border-purple-400/40 hover:border-purple-400 rounded-lg font-bold text-sm transition">
                {t('home.modes.pro.cta')} →
              </button>
              <div className="mt-3 text-center text-xs text-white/40">{t('home.modes.free')}</div>
            </div>

          </div>

          {/* Mention rassurante */}
          <p className="text-center text-sm text-white/50 mt-10">
            🔒 {t('home.modes.reassurance')}
          </p>
        </div>
      </section>

      {/* ===== FONCTIONNALITÉS ===== */}
      <section className="py-20 border-t border-white/10 bg-black/20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-3">{t('home.featuresTitle')}</h2>
            <p className="text-white/60">{t('home.featuresSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-700/10 border border-orange-400/20 rounded-2xl p-6">
              <Calendar className="w-10 h-10 mb-3 text-orange-300" />
              <h3 className="text-xl font-bold mb-2">{t('home.feature1Title')}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{t('home.feature1Desc')}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-700/10 border border-purple-400/20 rounded-2xl p-6">
              <Sparkles className="w-10 h-10 mb-3 text-purple-300" />
              <h3 className="text-xl font-bold mb-2">{t('home.feature2Title')}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{t('home.feature2Desc')}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-700/10 border border-yellow-400/20 rounded-2xl p-6">
              <Trophy className="w-10 h-10 mb-3 text-yellow-300" />
              <h3 className="text-xl font-bold mb-2">{t('home.feature3Title')}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{t('home.feature3Desc')}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-700/10 border border-blue-400/20 rounded-2xl p-6">
              <Newspaper className="w-10 h-10 mb-3 text-blue-300" />
              <h3 className="text-xl font-bold mb-2">{t('home.feature4Title')}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{t('home.feature4Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 border-t border-white/10">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-black text-center mb-12">{t('home.scoringTitle')}</h2>
          <div className="space-y-4">
            {[t('home.scoringStep1'), t('home.scoringStep2'), t('home.scoringStep3'), t('home.scoringStep4')].map((step, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-black">
                  {i + 1}
                </div>
                <div className="font-semibold">{step}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-white/5 border border-white/10 rounded-2xl p-6">
            <p className="text-center text-sm text-white/60 mb-4 font-semibold">{t('home.scoringSystem')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-orange-500/10 border border-orange-400/30 rounded-lg">
                <div className="text-2xl font-black text-orange-400">15</div>
                <div className="text-xs text-white/60 mt-1">{t('home.points15')}</div>
              </div>
              <div className="p-3 bg-orange-500/5 border border-orange-400/20 rounded-lg">
                <div className="text-2xl font-black text-orange-300">8</div>
                <div className="text-xs text-white/60 mt-1">{t('home.points8')}</div>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="text-2xl font-black text-white/70">5</div>
                <div className="text-xs text-white/60 mt-1">{t('home.points5')}</div>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="text-2xl font-black text-white/30">0</div>
                <div className="text-xs text-white/60 mt-1">{t('home.points0')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 border-t border-white/10 bg-black/20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-6 text-orange-400" />
          <h2 className="text-3xl sm:text-4xl font-black mb-4">{t('home.finalCta')}</h2>
          <p className="text-white/60 mb-8">{t('home.finalCtaSub')}</p>
          <button onClick={onSignup}
            className="px-10 py-5 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 transition inline-flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> {t('home.signupNow')}
          </button>
          <button onClick={onContinueAsGuest} className="block mx-auto mt-4 text-sm text-white/40 hover:text-white/70 transition">
            {t('auth.continueAsGuest')} →
          </button>
        </div>
      </section>

      <footer className="py-6 text-center text-xs text-white/30 border-t border-white/10">
        {t('common.footer')}
      </footer>
    </div>
  )
}


// =====================================================
// DONATE MODAL
// =====================================================
function DonateModal({ onClose, links }) {
  const { t } = useTranslation()
  if (!links) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gradient-to-br from-[#1a1f3a] to-[#0a0e27] border border-orange-400/30 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-3xl">
            ☕
          </div>
          <h3 className="text-2xl font-black mb-2">{t('donate.title')}</h3>
          <p className="text-white/60 text-sm">{t('donate.subtitle')}</p>
        </div>
        <div className="space-y-2">
          {links.stripe && (
            <a href={links.stripe} target="_blank" rel="noopener noreferrer"
              className="block w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 rounded-lg font-bold text-center transition">
              💳 {t('donate.viaStripe')}
            </a>
          )}
          {links.paypal && (
            <a href={links.paypal} target="_blank" rel="noopener noreferrer"
              className="block w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 rounded-lg font-bold text-center transition">
              🅿️ {t('donate.viaPaypal')}
            </a>
          )}
          {links.kofi && (
            <a href={links.kofi} target="_blank" rel="noopener noreferrer"
              className="block w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-lg font-bold text-center transition">
              ☕ {t('donate.viaKofi')}
            </a>
          )}
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 text-sm text-white/40 hover:text-white/70 transition">
          ← {t('auth.guestBack')}
        </button>
      </div>
    </div>
  )
}


// =====================================================
// CONTACT MODAL
// =====================================================
function ContactModal({ onClose, currentUser, turnstileSiteKey }) {
  const { t } = useTranslation()
  const [name, setName] = useState(currentUser?.username || '')
  const [email, setEmail] = useState(currentUser?.email || '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')  // honeypot
  const [turnstileToken, setTurnstileToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  // Timestamp d'ouverture du formulaire (anti-bot : remplissage trop rapide)
  const [formLoadedAt] = useState(() => Date.now())

  // Charger Turnstile dynamiquement si configuré
  useEffect(() => {
    if (!turnstileSiteKey) return
    if (document.getElementById('cf-turnstile-script')) return
    const script = document.createElement('script')
    script.id = 'cf-turnstile-script'
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [turnstileSiteKey])

  // Setup callback Turnstile global
  useEffect(() => {
    if (!turnstileSiteKey) return
    window.onTurnstileSuccess = (token) => setTurnstileToken(token)
    return () => { delete window.onTurnstileSuccess }
  }, [turnstileSiteKey])

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)

    // Si Turnstile actif et pas de token, refuser
    if (turnstileSiteKey && !turnstileToken) {
      setError('Vérification anti-bot requise')
      setLoading(false)
      return
    }

    try {
      await api.contact({
        name, email, subject, message, website,
        form_loaded_at: formLoadedAt,
        turnstile_token: turnstileToken || undefined,
      })
      setSuccess(true)
      setTimeout(onClose, 2500)
    } catch (err) {
      if (err.message.includes('429') || err.message.toLowerCase().includes('trop')) {
        setError(t('contact.tooMany'))
      } else if (err.message.toLowerCase().includes('expir')) {
        setError('Formulaire expiré, recharge la page')
      } else if (err.message.toLowerCase().includes('bot')) {
        setError('Vérification anti-bot échouée')
      } else {
        setError(t('contact.error'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gradient-to-br from-[#1a1f3a] to-[#0a0e27] border border-orange-400/30 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-2xl">
            ✉️
          </div>
          <h3 className="text-xl font-black mb-1">{t('contact.title')}</h3>
          <p className="text-white/60 text-sm">{t('contact.subtitle')}</p>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-green-300 font-semibold">{t('contact.success')}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input type="text" placeholder={t('contact.name')} required minLength={2} maxLength={80} value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400 text-sm" />
            <input type="email" placeholder={t('contact.email')} required value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400 text-sm" />
            <input type="text" placeholder={t('contact.subjectPlaceholder')} maxLength={120} value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400 text-sm" />
            <textarea placeholder={t('contact.messagePlaceholder')} required minLength={10} maxLength={2000} rows={5} value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400 text-sm resize-none" />

            {/* Compteur de caractères + indication minimum */}
            <div className="flex justify-between items-center text-xs -mt-1">
              <span className={message.length < 10 ? 'text-orange-400' : 'text-white/40'}>
                {message.length < 10
                  ? `Minimum 10 caractères (${10 - message.length} de plus)`
                  : `${message.length} / 2000 caractères`}
              </span>
            </div>

            {/* Honeypot anti-bot, caché aux humains */}
            <input type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)}
              tabIndex={-1} autoComplete="off"
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }} />

            {/* Cloudflare Turnstile widget si configuré */}
            {turnstileSiteKey && (
              <div className="flex justify-center my-2">
                <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-callback="onTurnstileSuccess" data-theme="dark"></div>
              </div>
            )}

            <p className="text-xs text-white/40 text-center">
              🔒 Protégé contre le spam
            </p>

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading || message.length < 10}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 rounded-lg font-bold transition">
              {loading ? t('contact.sending') : t('contact.send')}
            </button>

            <button type="button" onClick={onClose} className="w-full py-2 text-sm text-white/40 hover:text-white/70 transition">
              ← {t('auth.guestBack')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}


// =====================================================
// ADMIN CONTACT PANEL
// =====================================================
function AdminContactPanel() {
  const { t } = useTranslation()
  const [messages, setMessages] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')

  const reload = async () => {
    const data = await api.adminContactMessages(statusFilter === 'all' ? null : statusFilter)
    setMessages(data)
  }

  useEffect(() => { reload() }, [statusFilter])

  const updateStatus = async (id, status) => {
    await api.adminUpdateContactStatus(id, status)
    reload()
  }

  const deleteMsg = async (id) => {
    if (!confirm('Supprimer ce message ?')) return
    await api.adminDeleteContact(id)
    reload()
  }

  const statusColor = (s) => ({
    new: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
    read: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    replied: 'bg-green-500/20 text-green-300 border-green-400/30',
    archived: 'bg-white/5 text-white/40 border-white/10',
  }[s] || '')

  const statusLabel = (s) => ({
    new: t('contact.statusNew'), read: t('contact.statusRead'),
    replied: t('contact.statusReplied'), archived: t('contact.statusArchived'),
  }[s] || s)

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'new', 'read', 'replied', 'archived'].map(s => {
          const count = s === 'all' ? messages.length : messages.filter(m => m.status === s).length
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                statusFilter === s ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}>
              {s === 'all' ? t('matches.all') : statusLabel(s)}
            </button>
          )
        })}
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <span style={{ fontSize: 40 }}>✉️</span>
          <p className="mt-3">Aucun message</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusColor(m.status)}`}>
                    {statusLabel(m.status)}
                  </span>
                  <span className="font-bold">{m.name}</span>
                  <a href={`mailto:${m.email}?subject=Re: ${m.subject || 'United Pronos'}`}
                     className="text-sm text-orange-300 hover:text-orange-200">
                    {m.email}
                  </a>
                </div>
                <span className="text-xs text-white/40">{m.created_at}</span>
              </div>
              {m.subject && <div className="text-sm font-semibold text-white/80 mb-1">{m.subject}</div>}
              <p className="text-sm text-white/70 whitespace-pre-wrap mb-3">{m.message}</p>
              <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-white/5">
                <a href={`mailto:${m.email}?subject=Re: ${m.subject || 'United Pronos'}`}
                   className="px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded text-xs font-semibold transition">
                  ↪ {t('contact.reply')}
                </a>
                {m.status !== 'read' && (
                  <button onClick={() => updateStatus(m.id, 'read')}
                    className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded text-xs font-semibold transition">
                    {t('contact.markRead')}
                  </button>
                )}
                {m.status !== 'replied' && (
                  <button onClick={() => updateStatus(m.id, 'replied')}
                    className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded text-xs font-semibold transition">
                    {t('contact.markReplied')}
                  </button>
                )}
                {m.status !== 'archived' && (
                  <button onClick={() => updateStatus(m.id, 'archived')}
                    className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/60 rounded text-xs transition">
                    {t('contact.archive')}
                  </button>
                )}
                <button onClick={() => deleteMsg(m.id)}
                  className="ml-auto p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// =====================================================
// INFO TAB — accès aux pages SEO depuis l'app
// =====================================================
function InfoTab() {
  const { t, lang } = useTranslation()

  // URLs SEO adaptées à la langue active
  const seoUrls = {
    fr: {
      schedule: '/seo/calendrier-coupe-du-monde-2026.html',
      groups: '/seo/groupes-coupe-du-monde-2026.html',
      teams: '/seo/equipes-qualifiees-mondial-2026.html',
      stadiums: '/seo/stades-coupe-du-monde-2026.html',
      format: '/seo/format-48-equipes-mondial-2026.html',
      favorites: '/seo/favoris-coupe-du-monde-2026.html',
    },
    en: {
      schedule: '/seo/en/world-cup-2026-schedule.html',
      groups: '/seo/en/world-cup-2026-groups.html',
      teams: '/seo/en/qualified-teams-world-cup-2026.html',
      stadiums: '/seo/en/world-cup-2026-stadiums.html',
      format: '/seo/en/48-teams-format-world-cup-2026.html',
      favorites: '/seo/en/world-cup-2026-favorites.html',
    },
    es: {
      schedule: '/seo/es/calendario-mundial-2026.html',
      groups: '/seo/es/grupos-mundial-2026.html',
      teams: '/seo/es/equipos-clasificados-mundial-2026.html',
      stadiums: '/seo/es/estadios-mundial-2026.html',
      format: '/seo/es/formato-48-equipos-mundial-2026.html',
      favorites: '/seo/es/favoritos-mundial-2026.html',
    },
  }
  const urls = seoUrls[lang] || seoUrls.fr

  // 6 cards à afficher (favoris en premier, c'est le contenu phare)
  const cards = [
    {
      url: urls.favorites,
      icon: '🥇',
      title: t('info.favorites'),
      subtitle: t('info.favoritesSub'),
      featured: true,
    },
    { url: urls.schedule, icon: '📅', title: t('info.schedule'), subtitle: t('info.scheduleSub') },
    { url: urls.groups, icon: '👥', title: t('info.groups'), subtitle: t('info.groupsSub') },
    { url: urls.teams, icon: '🌍', title: t('info.teams'), subtitle: t('info.teamsSub') },
    { url: urls.stadiums, icon: '🏟️', title: t('info.stadiums'), subtitle: t('info.stadiumsSub') },
    { url: urls.format, icon: '📋', title: t('info.format'), subtitle: t('info.formatSub') },
  ]

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-block px-3 py-1 mb-3 bg-orange-500/10 border border-orange-400/30 rounded-full text-xs font-bold text-orange-300 uppercase tracking-wider">
          📚 {t('info.badge')}
        </div>
        <h2 className="text-2xl sm:text-3xl font-black mb-2">{t('info.title')}</h2>
        <p className="text-sm text-white/60 max-w-2xl mx-auto">{t('info.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, idx) => (
          <a key={idx} href={card.url} target="_blank" rel="noopener"
            className={`group relative p-5 rounded-2xl border transition transform hover:scale-105 ${
              card.featured
                ? 'bg-gradient-to-br from-yellow-400/15 to-orange-500/10 hover:from-yellow-400/25 hover:to-orange-500/20 border-yellow-400/40 hover:border-yellow-400/70'
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-orange-400/50'
            }`}>
            {card.featured && (
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                ⭐ {t('info.new')}
              </div>
            )}
            <div className="text-4xl mb-3">{card.icon}</div>
            <div className="font-bold text-base mb-1">{card.title}</div>
            <div className="text-sm text-white/50">{card.subtitle}</div>
            <div className="mt-3 text-xs text-orange-300 group-hover:text-orange-200 font-semibold">
              {t('info.readMore')} →
            </div>
          </a>
        ))}
      </div>

      <p className="text-center text-xs text-white/30 mt-8 italic">
        {t('info.opensInNewTab')}
      </p>
    </div>
  )
}


// =====================================================
// PROFILE TAB — espace utilisateur (avatar, bio, mot de passe, langue, thème)
// =====================================================
function ProfileTab({ currentUser, onUserUpdate }) {
  const { t, lang, setLang } = useTranslation()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState('')
  const [error, setError] = useState('')

  // Form fields
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarData, setAvatarData] = useState(null)
  const [profileLang, setProfileLang] = useState('fr')
  const [profileTheme, setProfileTheme] = useState('dark')

  // Password
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdSuccess, setPwdSuccess] = useState(false)

  useEffect(() => {
    api.getProfile().then(p => {
      setProfile(p)
      setUsername(p.username || '')
      setBio(p.bio || '')
      setAvatarData(p.avatar_data)
      setProfileLang(p.lang || 'fr')
      setProfileTheme(p.theme || 'dark')
    }).catch(e => setError(e.message))
    .finally(() => setLoading(false))
  }, [])

  const handleAvatarUpload = (e) => {
    setError('')
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 500_000) { setError(t('profile.avatarTooLarge')); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Format non supporté (JPG, PNG ou WebP)'); return
    }
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarData(ev.target.result)
    reader.readAsDataURL(file)
  }

  const removeAvatar = () => { setAvatarData(null) }

  const saveProfile = async () => {
    setError(''); setSaving(true); setSavedFlash('')
    try {
      const updated = await api.updateProfile({
        username, bio,
        avatar_data: avatarData || '',  // string vide = retire l'avatar
        lang: profileLang, theme: profileTheme,
      })
      setProfile(updated)
      // Si la langue a changé, on bascule l'interface
      if (profileLang !== lang) setLang(profileLang)
      // Update parent's user
      if (onUserUpdate) onUserUpdate({ ...currentUser, ...updated })
      setSavedFlash(t('profile.saved'))
      setTimeout(() => setSavedFlash(''), 3000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const submitPassword = async (e) => {
    e.preventDefault()
    setPwdError(''); setPwdSuccess(false)
    if (newPwd !== confirmPwd) {
      setPwdError(t('profile.pwdMismatch'))
      return
    }
    if (newPwd.length < 6) {
      setPwdError(t('profile.pwdTooShort'))
      return
    }
    setPwdLoading(true)
    try {
      await api.changePassword({ current_password: currentPwd, new_password: newPwd })
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
      setPwdSuccess(true)
      setTimeout(() => setPwdSuccess(false), 4000)
    } catch (e) { setPwdError(e.message) }
    finally { setPwdLoading(false) }
  }

  if (loading) return <div className="text-center py-12 text-white/40">{t('common.loading')}</div>
  if (!profile) return <div className="text-center py-12 text-red-400">{error || 'Erreur'}</div>

  // Avatar par défaut : initiales sur fond coloré généré à partir du username
  const initials = (username || profile.email).slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* SECTION PROFIL */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2">👤 {t('profile.title')}</h2>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-3">
            {avatarData ? (
              <img src={avatarData} alt="Avatar" className="w-28 h-28 rounded-full object-cover border-4 border-orange-400/50 shadow-lg" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-3xl font-black text-white border-4 border-orange-400/50 shadow-lg">
                {initials}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
            <label htmlFor="avatar-upload" className="cursor-pointer px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-semibold transition">
              📷 {avatarData ? t('profile.avatarChange') : t('profile.avatarChoose')}
            </label>
            {avatarData && (
              <button onClick={removeAvatar} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm">
                ✕ {t('profile.avatarRemove')}
              </button>
            )}
          </div>
          <p className="text-xs text-white/40 mt-2">{t('profile.avatarHint')}</p>
        </div>

        {/* Username */}
        <div className="mb-4">
          <label className="text-sm font-semibold text-white/70 block mb-1">{t('profile.username')}</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            minLength={2} maxLength={40}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-400" />
        </div>

        {/* Bio */}
        <div className="mb-4">
          <label className="text-sm font-semibold text-white/70 block mb-1">{t('profile.bio')}</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)}
            maxLength={140} rows={2} placeholder={t('profile.bioPlaceholder')}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400 resize-none" />
          <div className="text-xs text-white/40 text-right mt-1">{bio.length} / 140</div>
        </div>

        {/* Email (readonly) */}
        <div className="mb-4">
          <label className="text-sm font-semibold text-white/70 block mb-1">{t('profile.email')}</label>
          <input type="email" value={profile.email} disabled
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white/50 cursor-not-allowed" />
        </div>

        {/* Langue */}
        <div className="mb-4">
          <label className="text-sm font-semibold text-white/70 block mb-2">{t('profile.lang')}</label>
          <div className="flex gap-2">
            {[
              { code: 'fr', label: 'Français', flag: 'fr' },
              { code: 'en', label: 'English', flag: 'gb' },
              { code: 'es', label: 'Español', flag: 'es' },
            ].map(l => (
              <button key={l.code} type="button" onClick={() => setProfileLang(l.code)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${
                  profileLang === l.code
                    ? 'bg-orange-500/20 border-orange-400/50 text-orange-200'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}>
                <img src={`https://flagcdn.com/w40/${l.flag}.png`} alt={l.code} style={{width: '20px', height: '15px', borderRadius: '2px'}} />
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Thème */}
        <div className="mb-4">
          <label className="text-sm font-semibold text-white/70 block mb-2">{t('profile.theme')}</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setProfileTheme('dark')}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm transition ${
                profileTheme === 'dark'
                  ? 'bg-orange-500/20 border-orange-400/50 text-orange-200'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}>
              🌙 {t('profile.themeDark')}
            </button>
            <button type="button" onClick={() => setProfileTheme('light')}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm transition ${
                profileTheme === 'light'
                  ? 'bg-orange-500/20 border-orange-400/50 text-orange-200'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}>
              ☀️ {t('profile.themeLight')}
            </button>
          </div>
          <p className="text-xs text-white/40 mt-1 italic">{t('profile.themeNote')}</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg mb-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}
        {savedFlash && (
          <div className="text-green-400 text-sm bg-green-500/10 p-3 rounded-lg mb-3 text-center">
            ✓ {savedFlash}
          </div>
        )}

        <button onClick={saveProfile} disabled={saving}
          className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 rounded-lg font-bold transition">
          {saving ? '...' : '💾 ' + t('profile.save')}
        </button>
      </div>

      {/* SECTION SÉCURITÉ */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2">🔒 {t('profile.securityTitle')}</h2>

        <form onSubmit={submitPassword} className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-white/70 block mb-1">{t('profile.currentPwd')}</label>
            <input type="password" required value={currentPwd} onChange={e => setCurrentPwd(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-400" />
          </div>
          <div>
            <label className="text-sm font-semibold text-white/70 block mb-1">{t('profile.newPwd')}</label>
            <input type="password" required minLength={6} value={newPwd} onChange={e => setNewPwd(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-400" />
          </div>
          <div>
            <label className="text-sm font-semibold text-white/70 block mb-1">{t('profile.confirmPwd')}</label>
            <input type="password" required minLength={6} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-400" />
          </div>

          {pwdError && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{pwdError}</span>
            </div>
          )}
          {pwdSuccess && (
            <div className="text-green-400 text-sm bg-green-500/10 p-3 rounded-lg text-center">
              ✓ {t('profile.pwdSuccess')}
            </div>
          )}

          <button type="submit" disabled={pwdLoading}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 rounded-lg font-semibold transition">
            {pwdLoading ? '...' : '🔐 ' + t('profile.changePwd')}
          </button>
        </form>
      </div>
    </div>
  )
}


// =====================================================
// GROUP CREATE SCREEN (étape post-inscription leader)
// =====================================================
function GroupCreateScreen({ onCreated, onSkip }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoData, setLogoData] = useState(null)
  const [logoError, setLogoError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogoUpload = (e) => {
    setLogoError('')
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 500_000) {
      setLogoError('Image trop lourde (max 500 KB)')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setLogoError('Format non supporté (JPG, PNG ou WebP)')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => setLogoData(ev.target.result)
    reader.readAsDataURL(file)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const group = await api.createGroup({ name, description, logo_data: logoData })
      onCreated(group)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Trophy className="w-12 h-12 text-orange-400 mx-auto mb-2" />
          <h1 className="text-3xl font-black mb-2">{t('group.create.title')}</h1>
          <p className="text-white/60">{t('group.create.subtitle')}</p>
        </div>

        <form onSubmit={submit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">

          {/* Logo upload */}
          <div className="flex flex-col items-center">
            <label className="text-sm font-semibold text-white/70 mb-2 self-start">{t('group.logo')}</label>
            <div className="flex items-center gap-4 w-full">
              <div className="w-24 h-24 rounded-2xl bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden">
                {logoData ? <img src={logoData} alt="Logo" className="w-full h-full object-cover" /> : <span className="text-3xl">🏆</span>}
              </div>
              <div className="flex-1">
                <input id="logo-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} className="hidden" />
                <label htmlFor="logo-upload" className="cursor-pointer inline-block px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-sm font-semibold transition">
                  {logoData ? t('group.logoChange') : t('group.logoChoose')}
                </label>
                {logoData && (
                  <button type="button" onClick={() => setLogoData(null)} className="ml-2 text-sm text-red-300 hover:text-red-200">
                    {t('group.logoRemove')}
                  </button>
                )}
                <p className="text-xs text-white/40 mt-2">{t('group.logoHint')}</p>
                {logoError && <p className="text-xs text-red-400 mt-1">{logoError}</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-white/70 block mb-1">{t('group.name')}</label>
            <input type="text" required minLength={2} maxLength={80} placeholder={t('group.namePlaceholder')} value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400" />
          </div>

          <div>
            <label className="text-sm font-semibold text-white/70 block mb-1">{t('group.description')}</label>
            <textarea maxLength={500} rows={3} placeholder={t('group.descriptionPlaceholder')} value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400 resize-none" />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading || name.length < 2}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 rounded-lg font-bold transition">
            {loading ? t('group.creating') : t('group.create.cta')}
          </button>
        </form>
      </div>
    </div>
  )
}


// =====================================================
// JOIN GROUP SCREEN (depuis lien d'invitation)
// =====================================================
function JoinGroupScreen({ inviteCode, onJoined, onCancel, currentUser }) {
  const { t } = useTranslation()
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.previewGroup(inviteCode)
      .then(setPreview)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [inviteCode])

  const join = async () => {
    setJoining(true)
    try {
      await api.joinGroup(inviteCode)
      const refreshedUser = await api.me()
      onJoined(refreshedUser)
    } catch (err) {
      setError(err.message)
    } finally { setJoining(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white/60">{t('common.loading')}</div>

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Trophy className="w-12 h-12 text-orange-400 mx-auto mb-2" />
          <h1 className="text-2xl font-black">{t('group.joinTitle')}</h1>
        </div>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-300">{error}</p>
            <button onClick={onCancel} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">
              ← {t('auth.guestBack')}
            </button>
          </div>
        ) : preview && (
          <div className="bg-white/5 backdrop-blur-xl border border-orange-400/30 rounded-2xl p-6">
            <div className="flex flex-col items-center gap-3 mb-4">
              {preview.logo_data ? (
                <img src={preview.logo_data} alt={preview.name} className="w-24 h-24 rounded-2xl object-cover border-2 border-orange-400/50" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-orange-500/20 flex items-center justify-center text-4xl">🏆</div>
              )}
              <h2 className="text-2xl font-black text-center">{preview.name}</h2>
              {preview.description && <p className="text-sm text-white/70 text-center">{preview.description}</p>}
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span>👥 {preview.member_count} {preview.member_count > 1 ? 'membres' : 'membre'}</span>
                {preview.leader_username && <span>👑 {preview.leader_username}</span>}
              </div>
            </div>

            <div className="bg-orange-500/10 border border-orange-400/30 rounded-lg p-3 text-xs text-orange-200 mb-4">
              {t('group.joinNote')}
            </div>

            {!currentUser ? (
              <p className="text-center text-sm text-white/60 mb-4">{t('signup.invitedTo')} <strong>{preview.name}</strong>. {t('auth.signup')} pour rejoindre.</p>
            ) : (
              <button onClick={join} disabled={joining}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 disabled:opacity-50 rounded-lg font-bold transition">
                {joining ? '...' : t('group.joinCta')}
              </button>
            )}

            <button onClick={onCancel} className="block mx-auto mt-3 text-sm text-white/40 hover:text-white/70">
              ← {t('auth.guestBack')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


// =====================================================
// GROUP TAB (mon groupe — leader ou membre)
// =====================================================
function GroupTab({ user }) {
  const { t } = useTranslation()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoData, setLogoData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [copyMsg, setCopyMsg] = useState(false)

  const isLeader = user?.role === 'leader'
  const isMember = user?.role === 'solo' && user?.group_id

  const reload = async () => {
    setLoading(true)
    try {
      const g = await api.myGroup()
      setGroup(g)
      if (g) {
        setName(g.name); setDescription(g.description || ''); setLogoData(g.logo_data)
        if (isLeader) {
          const m = await api.groupMembers(g.id)
          setMembers(m)
        }
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [])

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 500_000) { alert('Image trop lourde (max 500 KB)'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setLogoData(ev.target.result)
    reader.readAsDataURL(file)
  }

  const save = async () => {
    setSaving(true)
    try {
      const updated = await api.updateGroup(group.id, { name, description, logo_data: logoData })
      setGroup(updated)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      setEditing(false)
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${group.invite_code}`
    navigator.clipboard.writeText(link)
    setCopyMsg(true)
    setTimeout(() => setCopyMsg(false), 2000)
  }

  if (loading) return <div className="text-center py-12 text-white/40">{t('common.loading')}</div>

  if (!group) {
    return (
      <div className="text-center py-12 text-white/40">
        <p>Tu n'es pas dans un groupe.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Carte groupe */}
      <div className="bg-gradient-to-br from-orange-500/10 to-pink-500/10 border border-orange-400/30 rounded-2xl p-5">
        <div className="flex items-start gap-4 mb-4">
          {group.logo_data ? (
            <img src={group.logo_data} alt={group.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-orange-400/50" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-orange-500/20 flex items-center justify-center text-3xl">🏆</div>
          )}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={80}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xl font-bold mb-2" />
            ) : (
              <h2 className="text-2xl font-black">{group.name}</h2>
            )}
            {editing ? (
              <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={2}
                placeholder={t('group.descriptionPlaceholder')}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm resize-none" />
            ) : (
              group.description && <p className="text-sm text-white/70">{group.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-white/50 flex-wrap">
              <span>👥 {group.member_count} {t('group.membersCount').replace('{count} ', '').replace('s)', group.member_count > 1 ? 's)' : ')')}</span>
              {group.leader && <span>👑 {group.leader.username}</span>}
            </div>
          </div>
        </div>

        {/* Edition (leader uniquement) */}
        {isLeader && (
          editing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input id="logo-edit-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} className="hidden" />
              <label htmlFor="logo-edit-upload" className="cursor-pointer px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-sm">
                {t('group.logoChange')}
              </label>
              {logoData && <button onClick={() => setLogoData(null)} className="text-sm text-red-300">{t('group.logoRemove')}</button>}
              <button onClick={save} disabled={saving} className="ml-auto px-4 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-semibold">
                {saving ? '...' : t('group.save')}
              </button>
              <button onClick={() => { setEditing(false); reload() }} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm">
                {t('common.cancel') || 'Annuler'}
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-sm">
              ✏️ Modifier
            </button>
          )
        )}
        {savedFlash && <p className="text-green-400 text-sm mt-2">{t('group.saved')}</p>}
      </div>

      {/* Code d'invitation (leader uniquement) */}
      {isLeader && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">{t('group.inviteLink')}</h3>
          <div className="flex items-center gap-2 mb-2">
            <code className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-orange-300 text-sm break-all">
              {window.location.origin}/join/{group.invite_code}
            </code>
            <button onClick={copyInviteLink} className="shrink-0 px-3 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-semibold whitespace-nowrap">
              {copyMsg ? '✓ ' + t('group.inviteCopied') : '📋 ' + t('group.inviteCopy')}
            </button>
          </div>
          <p className="text-xs text-white/40">{t('group.inviteCode')} : <strong>{group.invite_code}</strong></p>
        </div>
      )}

      {/* Liste des membres (leader uniquement) */}
      {isLeader && members.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">{t('group.members')} ({members.length})</h3>
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-bold text-sm">
                    {m.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">
                      {m.username}
                      {m.role === 'leader' && <span className="ml-2 text-xs text-orange-300">👑 {t('group.leader')}</span>}
                    </div>
                    <div className="text-xs text-white/40">{m.email}</div>
                  </div>
                </div>
                <div className="text-sm text-orange-300 font-bold">{m.points} {t('group.points')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


// =====================================================
// ADMIN GROUPS PANEL
// =====================================================
function AdminGroupsPanel() {
  const { t } = useTranslation()
  const [groups, setGroups] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [members, setMembers] = useState({})

  const reload = async () => {
    const g = await api.adminListGroups()
    setGroups(g)
  }

  useEffect(() => { reload() }, [])

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!members[id]) {
      try {
        const m = await api.groupMembers(id)
        setMembers(prev => ({ ...prev, [id]: m }))
      } catch (e) { console.error(e) }
    }
  }

  const deleteGroup = async (id) => {
    if (!confirm(t('admin.deleteGroupConfirm'))) return
    await api.adminDeleteGroup(id); reload()
  }

  const removeMember = async (groupId, userId) => {
    if (!confirm(t('admin.removeMemberConfirm'))) return
    await api.adminRemoveMember(groupId, userId)
    const m = await api.groupMembers(groupId)
    setMembers(prev => ({ ...prev, [groupId]: m }))
    reload()
  }

  const regenerateCode = async (groupId) => {
    if (!confirm(t('admin.regenerateCodeConfirm'))) return
    await api.adminRegenerateCode(groupId); reload()
  }

  if (groups.length === 0) return <div className="text-center py-12 text-white/40">Aucun groupe</div>

  return (
    <div className="space-y-3">
      {groups.map(g => (
        <div key={g.id} className="bg-white/5 border border-white/10 rounded-xl">
          <div className="p-4 flex items-center gap-3">
            {g.logo_data ? <img src={g.logo_data} className="w-12 h-12 rounded-lg object-cover" alt={g.name} />
              : <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center text-xl">🏆</div>}
            <div className="flex-1 min-w-0">
              <div className="font-bold">{g.name}</div>
              <div className="text-xs text-white/50 flex items-center gap-3 flex-wrap">
                <span>👥 {g.member_count}</span>
                <span>👑 {g.leader?.username}</span>
                <code className="text-orange-300">{g.invite_code}</code>
              </div>
            </div>
            <button onClick={() => toggleExpand(g.id)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm">
              {expandedId === g.id ? '▼' : '▶'}
            </button>
            <button onClick={() => regenerateCode(g.id)} className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-xs">
              🔄 Code
            </button>
            <button onClick={() => deleteGroup(g.id)} className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          {expandedId === g.id && members[g.id] && (
            <div className="px-4 pb-4 space-y-1 border-t border-white/5 pt-3">
              {members[g.id].map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span>{m.username}</span>
                    <span className="text-xs text-white/40">{m.email}</span>
                    {m.role === 'leader' && <span className="text-xs text-orange-300">👑</span>}
                  </div>
                  {m.role !== 'leader' && (
                    <button onClick={() => removeMember(g.id, m.id)} className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs">
                      Retirer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}


// =====================================================
// AUTH SCREEN AVEC INVITATION (chargé depuis /join/CODE)
// =====================================================
function AuthScreenWithInvite({ inviteCode, onLogin, onCancel }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.previewGroup(inviteCode)
      .then(setPreview)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [inviteCode])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white/60">Chargement…</div>

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
        <div className="max-w-md text-center bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 mb-4">Code d'invitation invalide</p>
          <button onClick={onCancel} className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg">
            ← Retour
          </button>
        </div>
      </div>
    )
  }

  return <AuthScreen onLogin={onLogin} onGuest={onCancel} initialMode="signup" inviteCode={inviteCode} invitedGroup={preview} />
}


// =====================================================
// MAIN APP
// =====================================================
export default function App() {
  const { t, lang } = useTranslation()
  const [user, setUser] = useState(null)
  // mode visiteur, mais l'utilisateur doit explicitement cliquer "Continuer en visiteur"
  const [isGuest, setIsGuest] = useState(false)
  // showHome=true → on affiche la HomePage vendeuse au démarrage
  const [showHome, setShowHome] = useState(true)
  const [showAuth, setShowAuth] = useState(false)
  const [authInitialMode, setAuthInitialMode] = useState('login')
  const [showGuestPrompt, setShowGuestPrompt] = useState(false)
  const [showDonate, setShowDonate] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('matches')
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [news, setNews] = useState([])
  const [config, setConfig] = useState({ donations: { enabled: false } })

  // === GROUPES ===
  // Si l'URL est /join/ABC123 → on affiche l'écran de rejoindre groupe
  const [inviteCode, setInviteCode] = useState(() => {
    const m = window.location.pathname.match(/^\/join\/([A-Z0-9]+)$/i)
    return m ? m[1].toUpperCase() : null
  })
  // Si user vient de s'inscrire en leader → écran création groupe
  const [needsGroupCreation, setNeedsGroupCreation] = useState(false)

  // Init : vérifier token + charger config publique + initialiser GA4
  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(cfg => {
      setConfig(cfg)
      // Initialiser Google Analytics 4 si configuré
      if (cfg?.analytics?.enabled && cfg?.analytics?.ga_measurement_id) {
        loadGoogleAnalytics(cfg.analytics.ga_measurement_id)
      }
    }).catch(() => {})

    if (getToken()) {
      api.me().then(u => {
        setUser(u); setIsGuest(false); setShowHome(false)
        // Appliquer la langue préférée du profil utilisateur (si différente de l'actuelle)
        if (u.lang && u.lang !== lang) {
          setLang(u.lang)
        }
        // Si leader sans groupe encore créé → afficher l'écran de création
        if (u.role === 'leader' && !u.group_id) {
          setNeedsGroupCreation(true)
        }
      })
        .catch(() => { setToken(null) })
        .finally(() => setLoading(false))
    } else {
      // par défaut : on reste sur la HomePage (showHome=true), mode connecté ni visiteur
      setLoading(false)
    }
  }, [])

  // Charger les données publiques quand on n'est pas sur la HomePage
  useEffect(() => {
    if (loading || showHome) return
    loadPublic()
    const interval = setInterval(loadPublic, 30000)
    return () => clearInterval(interval)
  }, [loading, user, lang, showHome])

  const loadPublic = async () => {
    try {
      const [m, l, n] = await Promise.all([api.matches(), api.leaderboard(), api.news(null, lang)])
      setMatches(m); setLeaderboard(l); setNews(n)
      if (user) {
        const p = await api.myPredictions()
        setPredictions(p)
      } else {
        setPredictions([])
      }
    } catch (e) { console.error(e) }
  }

  const handleSavePrediction = async (matchId, h, a) => {
    await api.savePrediction(matchId, h, a)
    const [p, l] = await Promise.all([api.myPredictions(), api.leaderboard()])
    setPredictions(p); setLeaderboard(l)
  }

  const handleAdminSetScore = async (matchId, h, a) => {
    await api.adminSetScore(matchId, h, a)
    await loadPublic()
  }

  const handleRefreshNews = async () => {
    await api.refreshNews()
    setNews(await api.news(null, lang))
  }

  const handleSignup = () => { setAuthInitialMode('signup'); setShowAuth(true); setShowHome(false) }
  const handleLogin = () => { setAuthInitialMode('login'); setShowAuth(true); setShowHome(false) }
  const handleGuest = () => { setIsGuest(true); setShowHome(false) }

  const onLogin = (u) => {
    setUser(u); setIsGuest(false); setShowAuth(false); setShowHome(false)
    // Appliquer la langue préférée du profil
    if (u.lang && u.lang !== lang) {
      setLang(u.lang)
    }
    // Si l'utilisateur vient de s'inscrire en leader → écran création de groupe
    if (u.role === 'leader' && !u.group_id) {
      setNeedsGroupCreation(true)
    }
    // Si on était sur /join/CODE et qu'on s'est inscrit avec invite_code → user a déjà group_id
    if (inviteCode && u.group_id) {
      setInviteCode(null)
      window.history.replaceState({}, '', '/')
    }
  }
  const logout = () => { setToken(null); setUser(null); setIsGuest(false); setShowHome(true); setNeedsGroupCreation(false) }
  const onGuestPrompt = () => setShowGuestPrompt(true)
  const goToAuth = () => { setShowGuestPrompt(false); setShowAuth(true); setShowHome(false) }
  const backToGuest = () => { setShowAuth(false); if (!user) setShowHome(true) }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white/60">{t('common.loading')}</div>

  // 0. URL /join/CODE → écran d'invitation (avant tout)
  if (inviteCode) {
    // Si user déjà connecté ET pas dans un groupe → peut rejoindre directement
    if (user && !user.group_id && user.role !== 'leader' && user.role !== 'admin') {
      return <JoinGroupScreen
        inviteCode={inviteCode}
        currentUser={user}
        onJoined={(u) => {
          setUser(u); setInviteCode(null)
          window.history.replaceState({}, '', '/')
        }}
        onCancel={() => { setInviteCode(null); window.history.replaceState({}, '', '/') }}
      />
    }
    // Si pas connecté → page d'inscription pré-remplie avec invite_code
    if (!user) {
      // Récupère le preview pour afficher le bandeau
      return <AuthScreenWithInvite
        inviteCode={inviteCode}
        onLogin={onLogin}
        onCancel={() => { setInviteCode(null); window.history.replaceState({}, '', '/'); setShowHome(true) }}
      />
    }
    // Si user connecté mais déjà dans un groupe ou admin/leader → message d'erreur
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
        <div className="max-w-md text-center bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 mb-4">{t('group.joinErrorAlreadyIn')}</p>
          <button onClick={() => { setInviteCode(null); window.history.replaceState({}, '', '/') }}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg">
            ← {t('auth.guestBack')}
          </button>
        </div>
      </div>
    )
  }

  // 1. HomePage par défaut (premier visit)
  if (showHome && !user) {
    return <HomePage onSignup={handleSignup} onLogin={handleLogin} onContinueAsGuest={handleGuest} onContact={() => setShowContact(true)} />
  }

  // 2. Écran d'auth si demandé
  if (showAuth) return <AuthScreen onLogin={onLogin} onGuest={backToGuest} initialMode={authInitialMode} />

  // 2.5 — Leader fraîchement inscrit → doit créer son groupe avant d'accéder à l'app
  if (needsGroupCreation && user?.role === 'leader') {
    return <GroupCreateScreen
      onCreated={async (g) => {
        const refreshed = await api.me()
        setUser(refreshed)
        setNeedsGroupCreation(false)
      }}
    />
  }

  const isAdmin = user?.role === 'admin'
  const isLeader = user?.role === 'leader'
  const hasGroup = !!user?.group_id

  const tabs = [
    { id: 'matches', label: t('tabs.matches'), icon: Calendar },
    { id: 'leaderboard', label: t('tabs.leaderboard'), icon: Trophy },
    { id: 'groups', label: t('tabs.groups'), icon: Users },
    ...((isLeader || (hasGroup && !isAdmin)) ? [{ id: 'mygroup', label: t('group.title'), icon: Users }] : []),
    { id: 'news', label: t('tabs.news'), icon: Newspaper },
    { id: 'info', label: t('tabs.info'), icon: BookOpen },
    ...(user ? [{ id: 'profile', label: t('profile.title'), icon: User }] : []),
    ...(isAdmin ? [{ id: 'admin', label: t('tabs.admin'), icon: Settings }] : []),
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
      {/* Bandeau visiteur */}
      {isGuest && (
        <div className="bg-gradient-to-r from-orange-500/20 to-pink-500/20 border-b border-orange-400/30 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-orange-200 flex items-center gap-2">
              <Zap className="w-4 h-4" /> {t('auth.guestBanner')}
            </span>
            <button onClick={() => setShowAuth(true)} className="px-3 py-1 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-bold flex items-center gap-1.5">
              <LogIn className="w-3.5 h-3.5" /> {t('auth.guestLogin')}
            </button>
          </div>
        </div>
      )}

      <header className="border-b border-white/10 backdrop-blur-xl bg-black/20 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Trophy className="w-7 h-7 text-orange-400 shrink-0" />
            <h1 className="font-black text-xl bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent truncate">United Pronos</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LangSwitch />
            <button onClick={() => setShowContact(true)}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-semibold flex items-center gap-1.5"
              title={t('contact.title')}>
              ✉️ <span className="hidden sm:inline">{t('contact.menuItem')}</span>
            </button>
            {config.donations?.enabled && (
              <button onClick={() => setShowDonate(true)}
                className="px-2.5 py-1.5 bg-gradient-to-r from-orange-500/20 to-pink-500/20 hover:from-orange-500/30 hover:to-pink-500/30 border border-orange-400/30 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                title={t('donate.title')}>
                ☕ <span className="hidden sm:inline">{t('donate.menuItem')}</span>
              </button>
            )}
            {user ? (
              <>
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold">{user.username}</div>
                  <div className="text-xs text-white/40">{isAdmin && '👑 '}{user.role}</div>
                </div>
                <button onClick={logout} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg" title={t('common.logout')}>
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button onClick={() => setShowAuth(true)}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-bold flex items-center gap-1.5">
                <LogIn className="w-3.5 h-3.5" /> {t('auth.login')}
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="border-b border-white/10 bg-black/10 backdrop-blur sticky z-10" style={{ top: isGuest ? '93px' : '57px' }}>
        <div className="max-w-6xl mx-auto px-4 flex overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); trackPageView(tab.label) }}
                className={`px-4 py-3 flex items-center gap-2 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                  activeTab === tab.id ? 'border-orange-400 text-orange-400' : 'border-transparent text-white/60 hover:text-white'
                }`}>
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            )
          })}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'matches' && (
          <MatchesTab matches={matches} predictions={predictions}
            onSave={handleSavePrediction}
            isAdmin={isAdmin} onAdminSetScore={handleAdminSetScore}
            isGuest={isGuest} onGuestPrompt={onGuestPrompt} />
        )}
        {activeTab === 'leaderboard' && <LeaderboardTab leaderboard={leaderboard} currentUserId={user?.id} />}
        {activeTab === 'groups' && <GroupsTab />}
        {activeTab === 'mygroup' && <GroupTab user={user} />}
        {activeTab === 'profile' && user && <ProfileTab currentUser={user} onUserUpdate={setUser} />}
        {activeTab === 'news' && <NewsTab news={news} onRefresh={handleRefreshNews} isAdmin={isAdmin} />}
        {activeTab === 'info' && <InfoTab />}
        {activeTab === 'admin' && isAdmin && <AdminTab user={user} />}
      </main>

      {/* Footer enrichi avec liens vers les articles SEO (boost SEO interne + UX) */}
      <footer className="border-t border-white/10 mt-12 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-6">
            <h3 className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">
              📚 {t('info.badge')}
            </h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {(() => {
                const seoUrls = {
                  fr: { schedule: '/seo/calendrier-coupe-du-monde-2026.html', groups: '/seo/groupes-coupe-du-monde-2026.html', teams: '/seo/equipes-qualifiees-mondial-2026.html', stadiums: '/seo/stades-coupe-du-monde-2026.html', format: '/seo/format-48-equipes-mondial-2026.html', favorites: '/seo/favoris-coupe-du-monde-2026.html' },
                  en: { schedule: '/seo/en/world-cup-2026-schedule.html', groups: '/seo/en/world-cup-2026-groups.html', teams: '/seo/en/qualified-teams-world-cup-2026.html', stadiums: '/seo/en/world-cup-2026-stadiums.html', format: '/seo/en/48-teams-format-world-cup-2026.html', favorites: '/seo/en/world-cup-2026-favorites.html' },
                  es: { schedule: '/seo/es/calendario-mundial-2026.html', groups: '/seo/es/grupos-mundial-2026.html', teams: '/seo/es/equipos-clasificados-mundial-2026.html', stadiums: '/seo/es/estadios-mundial-2026.html', format: '/seo/es/formato-48-equipos-mundial-2026.html', favorites: '/seo/es/favoritos-mundial-2026.html' },
                }
                const urls = seoUrls[lang] || seoUrls.fr
                const links = [
                  { url: urls.favorites, label: '🥇 ' + t('info.favorites') },
                  { url: urls.schedule, label: '📅 ' + t('info.schedule') },
                  { url: urls.groups, label: '👥 ' + t('info.groups') },
                  { url: urls.teams, label: '🌍 ' + t('info.teams') },
                  { url: urls.stadiums, label: '🏟️ ' + t('info.stadiums') },
                  { url: urls.format, label: '📋 ' + t('info.format') },
                ]
                return links.map((link, idx) => (
                  <a key={idx} href={link.url} target="_blank" rel="noopener"
                    className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-400/40 rounded-full text-white/70 hover:text-orange-300 transition">
                    {link.label}
                  </a>
                ))
              })()}
            </div>
          </div>
          <div className="text-center text-xs text-white/30">
            {t('common.footer')}
          </div>
        </div>
      </footer>

      {showGuestPrompt && <GuestPrompt onClose={() => setShowGuestPrompt(false)} onSignin={goToAuth} />}
      {showDonate && config.donations?.enabled && <DonateModal onClose={() => setShowDonate(false)} links={config.donations} />}
      {showContact && <ContactModal onClose={() => setShowContact(false)} currentUser={user} turnstileSiteKey={config.turnstile?.site_key} />}
    </div>
  )
}
