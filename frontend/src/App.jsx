import { useState, useEffect, useMemo } from 'react'
import { Trophy, Calendar, Users, Newspaper, Settings, LogOut, Sparkles, RefreshCw, Trash2, Lock, AlertCircle, Check, LogIn, ChevronDown, ChevronUp, TrendingUp, Target, Zap, User, BookOpen, HelpCircle, MessageSquare } from 'lucide-react'
import { api, getToken, setToken } from './api'
import { TEAMS, GROUPS, HOST_COUNTRIES, teamName, Flag } from './teams.jsx'
import { useTranslation } from './i18n.jsx'
import { predictMatch, getMatchOdds } from './predictor.js'
import { FloatingChatBox } from './ChatBox.jsx'
import { AdminConversationsPanel } from './AdminConversationsPanel.jsx'
import { FAQTab } from './FAQTab.jsx'
import KopUnitedTab from './KopUnitedTab.jsx'
import { ForgotPasswordForm, ResetPasswordPage } from './ResetPassword.jsx'
import { GroupsLeaderboardTab } from './GroupsLeaderboardTab.jsx'
import {
  HeaderSupportButton,
  HeaderSupportButtonMobile,
  SupportPage,
  SupporterBadge,
  ContextualDonationModal,
  shouldShowContextualModal,
  markContextualModalShown,
  SupportersWallPage,
} from './SupportSystem.jsx'

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
          className={`flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded transition ${lang === code ? 'bg-cta-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
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
  const [showForgotPassword, setShowForgotPassword] = useState(false)

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
          <div className="mb-4 p-4 bg-gradient-to-r from-sport-500/20 to-sport-600/20 border border-sport-400/30 rounded-2xl text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              {invitedGroup.logo_data ? (
                <img src={invitedGroup.logo_data} alt={invitedGroup.name} className="w-12 h-12 rounded-full object-cover border-2 border-sport-400" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-sport-500/30 flex items-center justify-center text-2xl">🏆</div>
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
          {showForgotPassword ? (
            <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
          ) : (
            <>
          <div className="flex gap-2 mb-6">
            <button type="button" onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${mode === 'login' ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60'}`}>
              {t('auth.login')}
            </button>
            <button type="button" onClick={() => { setMode('signup'); setError('') }}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${mode === 'signup' ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60'}`}>
              {t('auth.signup')}
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <input type="email" placeholder={t('auth.email')} required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-sport-400" />
            {mode === 'signup' && (
              <input type="text" placeholder={t('auth.username')} required minLength={2} value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-sport-400" />
            )}
            <input type="password" placeholder={t('auth.password')} required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-sport-400" />

            {/* Lien Mot de passe oublié (uniquement en mode login) */}
            {mode === 'login' && (
              <button type="button" onClick={() => setShowForgotPassword(true)}
                className="text-sm text-sport-400 hover:text-sport-300 transition self-start -mt-2 underline-offset-2 hover:underline">
                🔐 Mot de passe oublié ?
              </button>
            )}

            {/* Choix du rôle (uniquement à l'inscription, sauf si invité) */}
            {mode === 'signup' && !inviteCode && (
              <div className="space-y-2 pt-2">
                <label className="text-sm font-semibold text-white/70">{t('signup.chooseRole')}</label>
                <button type="button" onClick={() => setSignupRole('solo')}
                  className={`w-full p-3 rounded-lg border text-left transition ${
                    signupRole === 'solo'
                      ? 'bg-sport-500/20 border-sport-400/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🏃</div>
                    <div className="flex-1">
                      <div className="font-semibold">{t('role.solo')}</div>
                      <div className="text-xs text-white/60">{t('role.solo.desc')}</div>
                    </div>
                    {signupRole === 'solo' && <Check className="w-5 h-5 text-sport-400" />}
                  </div>
                </button>
                <button type="button" onClick={() => setSignupRole('leader')}
                  className={`w-full p-3 rounded-lg border text-left transition ${
                    signupRole === 'leader'
                      ? 'bg-sport-500/20 border-sport-400/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">👥</div>
                    <div className="flex-1">
                      <div className="font-semibold">{t('role.leader')}</div>
                      <div className="text-xs text-white/60">{t('role.leader.desc')}</div>
                    </div>
                    {signupRole === 'leader' && <Check className="w-5 h-5 text-sport-400" />}
                  </div>
                </button>
                {signupRole === 'leader' && (
                  <p className="text-xs text-sport-300/80 italic">→ {t('signup.continueAsLeader')}</p>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 disabled:opacity-50 rounded-lg font-bold transition">
              {loading ? '...' : (mode === 'login' ? t('auth.loginBtn') : t('auth.signupBtn'))}
            </button>
          </form>

          {/* Lien retour visiteur */}
          {onGuest && (
            <div className="mt-4 text-center">
              <button onClick={onGuest} className="text-sm text-white/50 hover:text-sport-400 transition">
                ← {t('auth.guestBack')}
              </button>
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// =====================================================
// HELPERS
// =====================================================
// Un code est "TBD" (équipe non encore connue) s'il est vide OU s'il s'agit d'un placeholder
// de match de phase finale. Les vrais codes sont des trigrammes ISO (FRA, BRA, MEX...).
// Placeholders : R32_xx (16es), R16_xx (8es), QF_xx (quarts), SF_xx (demis),
//                TP_xx (3e place), FINAL_xx, TBD_xx (legacy)
const isTBD = (code) => !code || code.startsWith('R32_') || code.startsWith('R16_') ||
                       code.startsWith('QF_') || code.startsWith('SF_') ||
                       code.startsWith('TP_') || code.startsWith('FINAL_') ||
                       code.startsWith('TBD_')

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
  // Fuseau horaire du visiteur (ex : "Europe/Paris", "America/New_York")
  // Affiché en tooltip pour transparence (les utilisateurs voient leur heure locale)
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const dateTitle = `Heure affichée dans ton fuseau (${userTimezone})`

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
          {/* Badge "sans pronostic" : visible si match à venir, pas de prédiction, user connecté,
              ET les deux équipes sont connues (pas un placeholder TBD type R32_xx, QF_xx, etc.) */}
          {!isGuest && !locked && !isLive && !prediction && !homeTBD && !awayTBD && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-sport-500/20 text-sport-300 rounded font-bold animate-pulse">
              <span>⏳</span> {t('matches.cardNoPredBadge')}
            </span>
          )}
          <Calendar className="w-3 h-3" /> <span title={dateTitle} className="cursor-help">{dateLabel}</span>
        </span>
        <span className="flex items-center gap-2 flex-wrap justify-end">
          {match.stage !== 'group' && (
            <span className={`px-2 py-0.5 rounded font-semibold ${
              isFinal ? 'bg-yellow-400/20 text-yellow-300' : 'bg-purple-500/20 text-purple-300'
            }`}>{stageLabel(match.stage, t)}</span>
          )}
          {match.group_letter && <span className="px-2 py-0.5 bg-sport-500/20 text-sport-300 rounded">{t('matches.stage.group')} {match.group_letter}</span>}
          <span className="text-white/40">{match.stadium}</span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-right">
          <div className="mb-2 flex justify-end">{homeTBD ? <TBDBadge /> : <Flag code={match.home_team} size={48} />}</div>
          <div className="font-bold">{homeTBD ? t('matches.tbd') : teamName(match.home_team, lang)}</div>
          {odds && !locked && !isLive && <div className="text-xs text-sport-300 mt-1 font-mono">@{odds.home}</div>}
        </div>

        <div className="text-center min-w-[120px]">
          {(locked || isLive) ? (
            <div className={`text-3xl font-black ${isLive ? 'text-red-400' : 'text-sport-400'}`}>
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
          {odds && !locked && <div className="text-xs text-sport-300 mt-1 font-mono">@{odds.away}</div>}
        </div>
      </div>

      {/* Bandeau IA principal */}
      {ai && !locked && (
        <div className="mt-4 p-3 bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border border-purple-500/30 rounded-lg">
          <button onClick={() => setShowAI(!showAI)} className="w-full flex items-center justify-between text-sm group hover:bg-purple-500/5 -m-1 p-1 rounded transition">
            <span className="flex items-center gap-2 text-purple-300">
              <Sparkles className="w-4 h-4" /> {t('matches.aiPredict')} : <strong className="text-white">{ai.home}-{ai.away}</strong>
              <span className="text-purple-400 text-xs">({ai.probability}%)</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-white/40 text-xs hidden sm:inline">
                {t('matches.confidence')} {t(`matches.confidence${ai.confidence === 'high' ? 'High' : ai.confidence === 'medium' ? 'Medium' : 'Low'}`)}
              </span>
              {/* Bouton déplier explicite avec animation pulsation pour attirer l'œil */}
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition ${
                showAI
                  ? 'bg-purple-500/40 text-purple-100 ring-1 ring-purple-300/30'
                  : 'bg-purple-500/25 text-purple-100 group-hover:bg-purple-500/40 ring-1 ring-purple-400/40 ai-detail-pulse'
              }`}>
                {showAI ? (
                  <>{t('matches.hideDetail')} <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>{t('matches.showDetail')} <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </span>
            </span>
          </button>

          {/* Détail IA dépliable */}
          {showAI && (
            <div className="mt-3 pt-3 border-t border-purple-500/20 space-y-3">
              {/* Probabilités 1X2 avec palette distinctive
                  Convention foot universelle :
                  - Bleu (sport-500) pour l'équipe domicile (HOME)
                  - Gris pour le match nul (DRAW)
                  - Orange (brand-orange / amber) pour l'équipe extérieur (AWAY) */}
              <div>
                <div className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" /> {t('matches.aiOutcome')}
                </div>
                {/* Barre de progression : home (bleu) | draw (gris) | away (orange) */}
                <div className="flex h-3 rounded-full overflow-hidden bg-white/5 ring-1 ring-white/10">
                  <div
                    style={{ width: `${ai.probHome}%` }}
                    className="bg-gradient-to-r from-sport-600 to-sport-400 transition-all"
                    title={`${teamName(match.home_team, lang)} ${ai.probHome}%`}
                  ></div>
                  <div
                    style={{ width: `${ai.probDraw}%` }}
                    className="bg-gradient-to-r from-slate-500 to-slate-400 transition-all"
                    title={`${t('matches.draw')} ${ai.probDraw}%`}
                  ></div>
                  <div
                    style={{ width: `${ai.probAway}%` }}
                    className="bg-gradient-to-r from-amber-500 to-orange-400 transition-all"
                    title={`${teamName(match.away_team, lang)} ${ai.probAway}%`}
                  ></div>
                </div>

                {/* Légendes sous la barre avec icônes colorées + identification gagnant */}
                <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                  {(() => {
                    const max = Math.max(ai.probHome, ai.probDraw, ai.probAway)
                    return (
                      <>
                        <div className={`flex items-center gap-1.5 ${ai.probHome === max ? 'font-bold' : ''}`}>
                          <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-sport-600 to-sport-400 shrink-0"></span>
                          <span className="text-sport-200 truncate" title={teamName(match.home_team, lang)}>
                            {teamName(match.home_team, lang)}
                          </span>
                          <span className={`ml-auto font-mono ${ai.probHome === max ? 'text-sport-300' : 'text-white/60'}`}>
                            {ai.probHome}%
                          </span>
                        </div>
                        <div className={`flex items-center gap-1.5 justify-center ${ai.probDraw === max ? 'font-bold' : ''}`}>
                          <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-slate-500 to-slate-400 shrink-0"></span>
                          <span className="text-white/70">{t('matches.draw')}</span>
                          <span className={`font-mono ${ai.probDraw === max ? 'text-white' : 'text-white/60'}`}>
                            {ai.probDraw}%
                          </span>
                        </div>
                        <div className={`flex items-center gap-1.5 justify-end ${ai.probAway === max ? 'font-bold' : ''}`}>
                          <span className={`font-mono mr-auto ${ai.probAway === max ? 'text-amber-300' : 'text-white/60'}`}>
                            {ai.probAway}%
                          </span>
                          <span className="text-amber-200 truncate" title={teamName(match.away_team, lang)}>
                            {teamName(match.away_team, lang)}
                          </span>
                          <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-amber-500 to-orange-400 shrink-0"></span>
                        </div>
                      </>
                    )
                  })()}
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
                  <div className="font-mono font-bold text-sm text-sport-300">{ai.over25}%</div>
                </div>
                <div className="bg-white/5 rounded p-2">
                  <div className="text-xs text-white/50 mb-1">{t('matches.btts')}</div>
                  <div className="font-mono font-bold text-sm text-sport-300">{ai.btts}%</div>
                </div>
              </div>

              {/* Note méthodologique (rassure sur le sérieux du modèle) */}
              <div className="text-[11px] text-white/30 leading-relaxed pt-1">
                {t('matches.aiMethodology')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saisie prono - zone visuellement proéminente */}
      <div className="mt-4">
        {anyTBD ? (
          <div className="text-center text-white/40 text-sm italic py-3">{t('matches.tbd')}</div>
        ) : locked ? (
          <div className="flex items-center justify-center gap-2 text-white/60 text-sm py-2">
            <Lock className="w-4 h-4" />
            {prediction ? (
              <>
                {t('matches.yourPred')} : <strong className="text-white">{prediction.home_score}-{prediction.away_score}</strong>
                <span className="px-2 py-0.5 bg-sport-500/20 text-sport-300 rounded text-xs">
                  {prediction.points} {t('matches.points')}
                </span>
              </>
            ) : (
              <span>{t('matches.noPrediction')}</span>
            )}
          </div>
        ) : (
          <div className={`relative rounded-xl border-2 transition-all ${
            prediction
              ? 'bg-cta-500/5 border-cta-500/30'  // déjà pronostiqué : vert discret
              : 'bg-sport-500/10 border-sport-400/40 shadow-lg shadow-sport-500/5'  // à pronostiquer : bleu visible
          } p-3`}>
            {/* Label explicite */}
            <div className="text-center text-xs font-bold uppercase tracking-wide mb-2 flex items-center justify-center gap-1.5">
              {prediction ? (
                <>
                  <Check className="w-3.5 h-3.5 text-cta-400" />
                  <span className="text-cta-300">{t('matches.predEditLabel')}</span>
                </>
              ) : (
                <>
                  <span className="text-sport-300">✏️ {t('matches.predEnterLabel')}</span>
                </>
              )}
            </div>

            {/* Inputs de score */}
            <div className="flex items-center justify-center gap-3">
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min="0" max="20"
                  value={predH}
                  onChange={(e) => setPredH(e.target.value)}
                  disabled={isGuest}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-16 h-14 text-2xl font-black bg-white text-sport-900 border-2 border-sport-400/50 focus:border-cta-500 focus:outline-none focus:ring-2 focus:ring-cta-500/30 rounded-lg text-center disabled:opacity-50 transition"
                />
                <div className="mt-1">
                  {homeTBD ? <span className="text-[10px] text-white/40">TBD</span> : <Flag code={match.home_team} size={20} />}
                </div>
              </div>
              <span className="text-2xl text-white/60 font-bold">-</span>
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min="0" max="20"
                  value={predA}
                  onChange={(e) => setPredA(e.target.value)}
                  disabled={isGuest}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-16 h-14 text-2xl font-black bg-white text-sport-900 border-2 border-sport-400/50 focus:border-cta-500 focus:outline-none focus:ring-2 focus:ring-cta-500/30 rounded-lg text-center disabled:opacity-50 transition"
                />
                <div className="mt-1">
                  {awayTBD ? <span className="text-[10px] text-white/40">TBD</span> : <Flag code={match.away_team} size={20} />}
                </div>
              </div>
              <button
                onClick={save}
                disabled={!isGuest && (predH === '' || predA === '')}
                className={`ml-1 px-4 h-14 rounded-lg font-bold text-sm transition flex items-center gap-1.5 ${
                  saved
                    ? 'bg-cta-500 text-white'
                    : 'bg-cta-gradient hover:from-cta-600 hover:to-cta-700 text-white shadow-md shadow-cta-500/20 disabled:opacity-30 disabled:shadow-none'
                }`}
              >
                {isGuest ? <><LogIn className="w-4 h-4" /> {t('auth.guestLogin')}</> : (saved ? <><Check className="w-4 h-4" /> OK</> : t('matches.pronostic'))}
              </button>
            </div>

            {/* Hint si pas encore pronostiqué */}
            {!prediction && !isGuest && (
              <div className="text-center text-[10px] text-white/40 mt-2">
                {t('matches.predHint')}
              </div>
            )}
          </div>
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
// BANDEAU UPGRADE SERVEUR
// =====================================================
// Annonce la migration d'infrastructure faite pour la Coupe du Monde 2026.
// - Visible en haut, juste sous le header
// - Dismissable (bouton ✕) avec mémorisation localStorage
// - Auto-expire 7 jours après publication (pour éviter les bandeaux fantômes)
// - Ne s'affiche jamais pour les supporters (qui ont déjà contribué)
// - Lien direct vers la page Soutenir
//
// Pour désactiver/modifier ce bandeau dans le futur :
//   - Soit changer BANNER_ID (les utilisateurs le reverront 1 fois)
//   - Soit retirer le composant du rendu
function ServerUpgradeBanner({ onGoToSupport, isSupporter }) {
  const { t } = useTranslation()
  // ID versionné : changer ce suffixe (v2, v3...) force la ré-apparition pour tous,
  // même ceux qui ont fermé un bandeau précédent.
  const BANNER_ID = 'server_upgrade_june10_2026_v2'
  // Date limite d'affichage : 7 jours après la publication.
  // Format : Date d'expiration en ms (UTC). Modifie cette valeur pour changer la durée.
  const EXPIRES_AT = new Date('2026-06-17T23:59:59Z').getTime()

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(`banner_dismissed_${BANNER_ID}`) === '1'
    } catch { return false }
  })

  // Ne s'affiche pas si :
  // 1. L'utilisateur l'a fermé
  // 2. La date d'expiration est passée
  // 3. L'utilisateur est déjà supporter (pas besoin de le solliciter à nouveau)
  if (dismissed) return null
  if (Date.now() > EXPIRES_AT) return null
  if (isSupporter) return null

  const handleDismiss = () => {
    try { localStorage.setItem(`banner_dismissed_${BANNER_ID}`, '1') } catch {}
    setDismissed(true)
  }

  return (
    <div className="bg-gradient-to-r from-sport-600/30 via-sport-500/20 to-cta-500/20 border-b border-sport-400/40">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span className="text-xl shrink-0">🚀</span>
          <div className="text-sm text-white/90 leading-snug min-w-0">
            <strong className="text-sport-200">{t('banner.upgradeTitle')}</strong>
            <span className="text-white/70 hidden sm:inline"> — {t('banner.upgradeText')}</span>
            <div className="text-white/60 text-xs mt-0.5 sm:hidden">{t('banner.upgradeText')}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onGoToSupport && (
            <button
              onClick={onGoToSupport}
              className="px-3 py-1 bg-cta-500 hover:bg-cta-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-md shadow-cta-500/20"
              title={t('banner.upgradeCTA')}>
              ❤️ <span className="hidden sm:inline">{t('banner.upgradeCTA')}</span>
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 rounded transition text-xs"
            title={t('banner.upgradeDismiss')}
            aria-label={t('banner.upgradeDismiss')}>
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}


// =====================================================
// MATCHES TAB
// =====================================================
function MatchesTab({ matches, predictions, onSave, isAdmin, onAdminSetScore, isGuest, onGuestPrompt }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [predFilter, setPredFilter] = useState('all')  // all | missing | done

  // === Calcul de la progression des pronostics ===
  // On compte uniquement les matchs PRONOSTIQUABLES :
  // - Statut "scheduled" (pas encore joué)
  // - Les deux équipes sont connues (pas de placeholder TBD type R32_73, QF_98, etc.)
  // Les matchs de phase finale avec équipes inconnues ne pénalisent donc pas la jauge.
  const isPredictableMatch = (m) =>
    m.status === 'scheduled' && !isTBD(m.home_team) && !isTBD(m.away_team)

  const upcomingMatches = matches.filter(isPredictableMatch)
  const predictedIds = new Set(predictions.map(p => p.match_id))
  const upcomingPredicted = upcomingMatches.filter(m => predictedIds.has(m.id))
  const totalUpcoming = upcomingMatches.length
  const totalPredicted = upcomingPredicted.length
  const missingCount = totalUpcoming - totalPredicted
  const progressPct = totalUpcoming > 0 ? Math.round((totalPredicted / totalUpcoming) * 100) : 0
  const isComplete = totalPredicted === totalUpcoming && totalUpcoming > 0

  const filtered = matches.filter(m => {
    if (filter !== 'all' && m.status !== filter) return false
    if (stageFilter !== 'all' && m.stage !== stageFilter) return false
    if (predFilter === 'missing' && (predictedIds.has(m.id) || !isPredictableMatch(m))) return false
    if (predFilter === 'done' && !predictedIds.has(m.id)) return false
    return true
  })

  const stages = ['all', 'group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final']

  return (
    <div>
      {/* === JAUGE DE PROGRESSION (visible si user connecté avec des matchs à venir) === */}
      {!isGuest && totalUpcoming > 0 && (
        <div className={`mb-5 p-4 rounded-xl border transition ${
          isComplete
            ? 'bg-green-500/10 border-green-400/40'
            : missingCount > 5
              ? 'bg-sport-500/10 border-sport-400/30'
              : 'bg-white/5 border-white/10'
        }`}>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{isComplete ? '🎉' : '📋'}</span>
              <div>
                <div className="font-bold text-sm">
                  {isComplete
                    ? t('matches.progressComplete')
                    : t('matches.progressTitle')
                  }
                </div>
                <div className="text-xs text-white/60 mt-0.5">
                  {isComplete
                    ? t('matches.progressAllDone')
                    : `${totalPredicted}/${totalUpcoming} ${t('matches.progressMatches')} · ${missingCount} ${t('matches.progressRemaining')}`
                  }
                </div>
              </div>
            </div>
            <div className={`text-3xl font-black ${
              isComplete ? 'text-green-300' : progressPct >= 75 ? 'text-sport-300' : 'text-white/80'
            }`}>
              {progressPct}%
            </div>
          </div>

          {/* Barre de progression visuelle */}
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isComplete
                  ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                  : 'bg-gradient-to-r from-cta-500 to-cta-600'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* CTA rapide : "Voir les matchs sans pronostic" */}
          {missingCount > 0 && predFilter !== 'missing' && (
            <button
              onClick={() => {
                setPredFilter('missing')
                setFilter('all')
                setStageFilter('all')
              }}
              className="mt-3 text-xs font-semibold text-sport-300 hover:text-sport-200 underline underline-offset-2 transition"
            >
              → {t('matches.progressShowMissing')}
            </button>
          )}
        </div>
      )}

      {/* === FILTRES par statut (Tous / À venir / Terminés) === */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: 'all', label: t('matches.all'), count: matches.length },
          { id: 'scheduled', label: t('matches.upcoming'), count: matches.filter(m => m.status === 'scheduled').length },
          { id: 'finished', label: t('matches.finished'), count: matches.filter(m => m.status === 'finished').length },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${filter === f.id ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* === FILTRES par pronostic (visible aux users connectés) === */}
      {!isGuest && totalUpcoming > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'all', label: t('matches.predFilterAll'), icon: '🎯', count: matches.length },
            { id: 'missing', label: t('matches.predFilterMissing'), icon: '⏳', count: missingCount, highlight: missingCount > 0 },
            { id: 'done', label: t('matches.predFilterDone'), icon: '✅', count: totalPredicted },
          ].map(f => (
            <button key={f.id} onClick={() => setPredFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                predFilter === f.id
                  ? 'bg-cta-500/30 text-cta-100 border border-cta-400/40'
                  : f.highlight
                    ? 'bg-sport-500/15 text-sport-200 border border-sport-400/30 hover:bg-sport-500/25 animate-pulse'
                    : 'bg-white/5 text-white/60 border border-transparent hover:bg-white/10'
              }`}>
              <span>{f.icon}</span>
              <span>{f.label}</span>
              <span className="opacity-70">({f.count})</span>
            </button>
          ))}
        </div>
      )}

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
          <div className="text-center py-12 text-white/40">
            {predFilter === 'missing' ? (
              <>
                <div className="text-5xl mb-3">🎉</div>
                <div className="font-semibold">{t('matches.progressAllDone')}</div>
              </>
            ) : (
              t('matches.noMatches') || 'Aucun match'
            )}
          </div>
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
function LeaderboardTab({ leaderboard, currentUserId, isAdmin }) {
  const { t } = useTranslation()
  // leaderboard peut être un tableau (ancien format) ou un objet (nouveau format)
  const ranked = Array.isArray(leaderboard) ? leaderboard : (leaderboard?.ranked || [])
  const rankedCount = leaderboard?.ranked_count ?? ranked.length
  const excludedAdmins = leaderboard?.excluded_admins ?? 0

  // === États de recherche et navigation ===
  const [searchQuery, setSearchQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')  // 'all' | 'mygroup'

  // === Position de l'utilisateur courant dans le classement complet ===
  // Calculée AVANT filtrage pour rester juste même après recherche
  const myRankIndex = currentUserId ? ranked.findIndex(e => e.id === currentUserId) : -1
  const myEntry = myRankIndex >= 0 ? ranked[myRankIndex] : null
  const myGroupId = myEntry?.group_id || null
  const topEntry = ranked[0]
  const pointsBehindLeader = myEntry && topEntry ? topEntry.total_points - myEntry.total_points : 0

  // === Liste des groupes uniques (pour info du filtre) ===
  const hasGroup = !!myGroupId

  // === Filtrage / Recherche ===
  const filtered = ranked.filter(entry => {
    // Filtre par groupe (seulement si user a un groupe)
    if (groupFilter === 'mygroup' && entry.group_id !== myGroupId) return false
    // Filtre recherche (sur username, insensible à la casse + accents)
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim()
      const username = (entry.username || '').toLowerCase()
      const groupName = (entry.group_name || '').toLowerCase()
      if (!username.includes(q) && !groupName.includes(q)) return false
    }
    return true
  })

  // === Scroll automatique vers ma position ===
  const scrollToMe = () => {
    if (!currentUserId) return
    // Si on est filtré et qu'on ne se voit pas, on reset les filtres
    if (!filtered.some(e => e.id === currentUserId)) {
      setSearchQuery('')
      setGroupFilter('all')
    }
    // Léger délai pour laisser le DOM se rafraîchir après reset éventuel
    setTimeout(() => {
      const el = document.getElementById(`leaderboard-entry-${currentUserId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Flash visuel pour attirer l'attention
        el.classList.add('ring-2', 'ring-sport-400', 'ring-offset-2', 'ring-offset-[#0a0e27]')
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-sport-400', 'ring-offset-2', 'ring-offset-[#0a0e27]')
        }, 2000)
      }
    }, 50)
  }

  return (
    <div className="space-y-2">
      {/* === CARTE "MA POSITION" (sticky en haut si connecté et classé) === */}
      {myEntry && (
        <div className="sticky top-0 z-10 mb-3 p-3 bg-gradient-to-r from-sport-500/15 to-sport-600/15 border border-sport-400/40 rounded-xl backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center px-2 py-1 bg-sport-500/30 rounded-lg min-w-[52px]">
              <div className="text-[10px] uppercase tracking-wide text-sport-200/80 font-semibold">{t('leaderboard.yourRank')}</div>
              <div className="text-xl font-black text-sport-200">#{myRankIndex + 1}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white/60">{t('leaderboard.yourPosition')}</div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-bold text-white">{myEntry.total_points} {t('leaderboard.pts')}</span>
                {myRankIndex > 0 && pointsBehindLeader > 0 && (
                  <span className="text-xs text-white/50">
                    · {pointsBehindLeader} {t('leaderboard.behindLeader')}
                  </span>
                )}
                {myRankIndex === 0 && (
                  <span className="text-xs text-yellow-300 font-semibold">🥇 {t('leaderboard.youAreFirst')}</span>
                )}
              </div>
            </div>
            <button
              onClick={scrollToMe}
              className="px-3 py-2 bg-cta-500 hover:bg-cta-600 text-white rounded-lg text-sm font-bold transition flex items-center gap-1.5 shrink-0"
              title={t('leaderboard.findMeTooltip')}>
              🎯 <span className="hidden sm:inline">{t('leaderboard.findMe')}</span>
            </button>
          </div>
        </div>
      )}

      {/* === BARRE DE RECHERCHE + FILTRE GROUPE === */}
      {ranked.length > 5 && (
        <div className="mb-3 space-y-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('leaderboard.searchPlaceholder')}
              className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-sport-400/50 transition placeholder-white/30"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition text-sm"
                title={t('leaderboard.clearSearch')}>
                ✕
              </button>
            )}
          </div>

          {/* Filtres rapides */}
          {hasGroup && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setGroupFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  groupFilter === 'all'
                    ? 'bg-cta-500/30 text-cta-100 border border-cta-400/40'
                    : 'bg-white/5 text-white/60 border border-transparent hover:bg-white/10'
                }`}>
                🌍 {t('leaderboard.filterAll')}
              </button>
              <button
                onClick={() => setGroupFilter('mygroup')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  groupFilter === 'mygroup'
                    ? 'bg-cta-500/30 text-cta-100 border border-cta-400/40'
                    : 'bg-white/5 text-white/60 border border-transparent hover:bg-white/10'
                }`}>
                👥 {t('leaderboard.filterMyGroup')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bandeau d'info : nombre de joueurs classés (transparence) */}
      {ranked.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white/60">
          <span>
            {searchQuery || groupFilter !== 'all' ? (
              <>
                <strong className="text-sport-300">{filtered.length}</strong> / {rankedCount} {t('leaderboard.shown')}
              </>
            ) : (
              <>
                <strong className="text-white/90">{rankedCount}</strong> {rankedCount > 1 ? t('leaderboard.playersRanked') : t('leaderboard.playerRanked')}
              </>
            )}
          </span>
          {isAdmin && excludedAdmins > 0 && (
            <span className="text-white/40" title="Les admins sans pronostic ne figurent pas dans le classement public">
              ℹ️ {excludedAdmins} admin{excludedAdmins > 1 ? 's' : ''} exclu{excludedAdmins > 1 ? 's' : ''} (sans pronos)
            </span>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          {searchQuery ? (
            <>
              <div className="text-4xl mb-3">🔍</div>
              <div className="font-semibold">{t('leaderboard.noMatch')}</div>
              <button
                onClick={() => { setSearchQuery(''); setGroupFilter('all') }}
                className="mt-3 text-sm text-sport-300 hover:text-sport-200 underline">
                {t('leaderboard.resetFilters')}
              </button>
            </>
          ) : ranked.length === 0 ? (
            t('leaderboard.noParticipant') || 'Aucun participant'
          ) : (
            t('leaderboard.noMatch')
          )}
        </div>
      ) : filtered.map((entry) => {
        // i correspond au rang DANS LE CLASSEMENT GLOBAL (pas dans la liste filtrée)
        const globalRank = ranked.indexOf(entry) + 1
        const i = globalRank - 1  // pour les emojis 🥇🥈🥉
        return (
        <div key={entry.id}
          id={`leaderboard-entry-${entry.id}`}
          className={`flex items-center gap-3 p-4 rounded-xl border transition ${
            entry.id === currentUserId ? 'bg-sport-500/10 border-sport-400/40' : 'bg-white/5 border-white/10'
          }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black shrink-0 ${
            i === 0 ? 'bg-yellow-400/20 text-yellow-300' :
            i === 1 ? 'bg-gray-300/20 text-gray-200' :
            i === 2 ? 'bg-orange-700/30 text-sport-400' : 'bg-white/5 text-white/60'
          }`}>{i + 1}</div>
          {/* Avatar utilisateur (ou initiales si pas d'avatar) */}
          {entry.avatar_data ? (
            <img src={entry.avatar_data} alt={entry.username}
              className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cta-500 to-cta-600 flex items-center justify-center text-xs font-black shrink-0">
              {entry.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          {/* Logo du groupe si l'utilisateur en fait partie */}
          {entry.group_logo ? (
            <img src={entry.group_logo} alt={entry.group_name} title={entry.group_name}
              className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0" />
          ) : entry.group_name ? (
            <div className="w-9 h-9 rounded-lg bg-sport-500/20 flex items-center justify-center text-sm shrink-0" title={entry.group_name}>
              🏆
            </div>
          ) : null}
          <div className="flex-1 min-w-0">
            <div className="font-bold flex items-center gap-2 flex-wrap">
              {entry.username}
              {entry.is_supporter && <SupporterBadge small />}
              {entry.role === 'leader' && <span className="text-xs text-purple-300">👑</span>}
            </div>
            <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap">
              {entry.group_name && <span className="text-sport-300/70">{entry.group_name} ·</span>}
              <span>{entry.predictions_count} {entry.predictions_count > 1 ? t('leaderboard.predictions_plural') : t('leaderboard.predictions')}</span>
            </div>
          </div>
          <div className="text-2xl font-black text-sport-400 shrink-0">
            {entry.total_points}<span className="text-sm text-white/40 ml-1">{t('matches.points')}</span>
          </div>
        </div>
      )})}
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
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cta-500 to-cta-600 flex items-center justify-center font-black">{letter}</div>
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
          <button onClick={() => setTeamFilter('')} className={`px-3 py-1.5 rounded-full text-sm ${!teamFilter ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60'}`}>
            {t('news.all')}
          </button>
          {availableTeams.map(team => (
            <button key={team} onClick={() => setTeamFilter(team)}
              className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 ${teamFilter === team ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60'}`}>
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
        <div className="mb-3 p-2 bg-sport-500/10 border border-sport-400/30 rounded-lg text-sm text-sport-200 text-center">
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
          <div className="text-2xl font-black text-sport-300">{stats.total}</div>
          <div className="text-xs text-white/50 mt-0.5">Matchs total</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-green-300">{stats.finished}</div>
          <div className="text-xs text-white/50 mt-0.5">Joués</div>
        </div>
        <div className="bg-sport-500/10 border border-sport-500/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-sport-300">{stats.today}</div>
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
                ? (f.urgent && f.count > 0 ? 'bg-red-500 text-white' : 'bg-cta-500 text-white')
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
                      className="w-12 px-2 py-1.5 bg-white/5 border border-white/20 rounded text-center font-bold focus:outline-none focus:border-sport-400 disabled:opacity-30"
                    />
                    <span className="text-white/40">-</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={s.a}
                      onChange={(e) => updateScore(m.id, 'a', e.target.value)}
                      disabled={isSaving || homeTBD || awayTBD}
                      placeholder="–"
                      className="w-12 px-2 py-1.5 bg-white/5 border border-white/20 rounded text-center font-bold focus:outline-none focus:border-sport-400 disabled:opacity-30"
                    />
                  </div>

                  {/* Boutons */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => saveScore(m)}
                      disabled={isSaving || s.h === '' || s.a === '' || homeTBD || awayTBD}
                      className="px-3 py-1.5 bg-cta-500 hover:bg-cta-600 disabled:opacity-30 rounded text-sm font-bold transition flex items-center gap-1"
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
  const [convsUnread, setConvsUnread] = useState(0)

  useEffect(() => {
    api.adminUsers().then(setUsers).catch(() => {})
    api.adminAuditLog().then(setAuditLog).catch(() => {})
    // Polling du badge "conversations non lues"
    const fetchUnread = () => {
      api.adminConversationsUnreadCount().then(r => setConvsUnread(r.unread || 0)).catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30_000)
    return () => clearInterval(interval)
  }, [])

  // === Suppression d'un utilisateur (RGPD) ===
  // On utilise une modale dédiée (state ci-dessous) au lieu d'un simple confirm()
  // pour permettre de saisir un motif et de visualiser l'info RGPD à l'admin.
  const [deleteUserTarget, setDeleteUserTarget] = useState(null)  // { id, username, email }
  const [deleteMessage, setDeleteMessage] = useState(null)

  const requestDeleteUser = (u) => {
    setDeleteUserTarget(u)
  }

  const confirmDeleteUser = async (reason, notify) => {
    if (!deleteUserTarget) return
    try {
      const result = await api.adminDeleteUser(deleteUserTarget.id, { reason, notify })
      setDeleteMessage({
        type: 'success',
        text: result.message || 'Compte supprimé avec succès',
        emailSent: result.email_notification_sent,
      })
      setUsers(await api.adminUsers())
    } catch (e) {
      setDeleteMessage({ type: 'error', text: e.message || 'Erreur lors de la suppression' })
    } finally {
      setDeleteUserTarget(null)
      // Toast disparaît après 5 sec
      setTimeout(() => setDeleteMessage(null), 5000)
    }
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
      <div className="mb-4 p-4 bg-gradient-to-br from-sport-500/10 to-sport-600/5 border border-sport-400/30 rounded-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-bold text-sport-200 mb-0.5">⚽ Résultats des matchs</div>
            <div className="text-xs text-white/50">Récupération automatique toutes les 5 min via Football-Data.org</div>
          </div>
          <button onClick={handleFetchResults} disabled={fetchingResults}
            className="px-4 py-2 bg-cta-500 hover:bg-cta-600 disabled:opacity-50 rounded-lg text-sm font-semibold flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${fetchingResults ? 'animate-spin' : ''}`} />
            {fetchingResults ? '...' : 'Actualiser maintenant'}
          </button>
        </div>
        {resultsMsg && (
          <div className="mt-3 p-2 bg-white/5 border border-white/10 rounded text-sm text-sport-100">
            {resultsMsg}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setTab('scores')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'scores' ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60'}`}>
          ⚽ Scores
        </button>
        <button onClick={() => setTab('users')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'users' ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60'}`}>
          {t('admin.users')} ({users.length})
        </button>
        <button onClick={() => setTab('groups')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'groups' ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60'}`}>
          👥 {t('admin.groups')}
        </button>
        <button onClick={() => setTab('contact')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'contact' ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60'}`}>
          ✉️ {t('contact.adminTitle')}
        </button>
        <button onClick={() => setTab('conversations')} className={`relative px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'conversations' ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60'}`}>
          💬 Chats
          {convsUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {convsUnread > 9 ? '9+' : convsUnread}
            </span>
          )}
        </button>
        <button onClick={() => setTab('audit')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'audit' ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60'}`}>
          {t('admin.audit')}
        </button>
      </div>

      {tab === 'scores' && <AdminScoresPanel />}

      {tab === 'users' && <AdminUsersPanel users={users} currentUserId={user.id} onDelete={requestDeleteUser} />}

      {tab === 'groups' && <AdminGroupsPanel />}

      {tab === 'contact' && <AdminContactPanel />}

      {tab === 'conversations' && <AdminConversationsPanel />}

      {tab === 'audit' && (
        <div className="space-y-1">
          {auditLog.map(log => (
            <div key={log.id} className="flex items-center gap-3 p-2 bg-white/5 rounded text-sm flex-wrap">
              <span className="text-xs text-white/40 w-32 shrink-0">{log.created_at}</span>
              <span className="font-semibold text-sport-300 w-32 shrink-0">{log.action}</span>
              <span className="text-white/60 truncate flex-1">{log.username || 'anonyme'} {log.details && `· ${log.details}`}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modale RGPD : confirmation de suppression utilisateur */}
      {deleteUserTarget && (
        <DeleteUserGDPRModal
          target={deleteUserTarget}
          onCancel={() => setDeleteUserTarget(null)}
          onConfirm={confirmDeleteUser}
        />
      )}

      {/* Toast de confirmation après suppression */}
      {deleteMessage && (
        <div className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-xl shadow-2xl border ${
          deleteMessage.type === 'success'
            ? 'bg-green-500/20 border-green-400/50 text-green-100'
            : 'bg-red-500/20 border-red-400/50 text-red-100'
        }`}>
          <div className="flex items-start gap-2">
            <span className="text-xl">{deleteMessage.type === 'success' ? '✅' : '❌'}</span>
            <div className="flex-1">
              <div className="font-semibold text-sm">{deleteMessage.text}</div>
              {deleteMessage.type === 'success' && deleteMessage.emailSent === false && (
                <div className="text-xs mt-1 text-yellow-200">
                  ⚠️ Email RGPD non envoyé (SMTP non configuré ou échec)
                </div>
              )}
            </div>
            <button onClick={() => setDeleteMessage(null)} className="text-white/60 hover:text-white">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}


// =====================================================
// MODALE RGPD : Confirmation de suppression d'un utilisateur
// =====================================================
// Affiche un récapitulatif RGPD à l'admin avant de supprimer un compte,
// avec un champ "motif" (optionnel) qui sera inclus dans l'email envoyé à l'utilisateur.
function DeleteUserGDPRModal({ target, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [confirmText, setConfirmText] = useState('')
  const [processing, setProcessing] = useState(false)

  // Pour éviter une suppression accidentelle, on demande de taper le username
  const canConfirm = confirmText === target.username && !processing

  const handleSubmit = async () => {
    if (!canConfirm) return
    setProcessing(true)
    try {
      await onConfirm(reason, notify)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-gradient-to-br from-[#1a1f3a] to-[#0a0e27] border border-red-400/40 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-3xl">🗑️</div>
          <div>
            <h3 className="text-xl font-bold text-red-300">Suppression de compte</h3>
            <p className="text-xs text-white/50">Conforme RGPD — Article 17</p>
          </div>
        </div>

        {/* Récap utilisateur */}
        <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-3 mb-4">
          <div className="text-xs text-white/60 mb-1">UTILISATEUR À SUPPRIMER</div>
          <div className="font-bold text-sm">{target.username}</div>
          <div className="text-xs text-white/60">{target.email}</div>
        </div>

        {/* Avertissement RGPD */}
        <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-3 mb-4 text-xs text-yellow-100/80">
          <strong>⚠️ Cette action est irréversible.</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>Toutes les données personnelles seront effacées</li>
            <li>Les pronostics et l'historique seront supprimés</li>
            <li>Les conversations chat seront effacées</li>
            <li>Si l'utilisateur est leader de groupe, le groupe sera conservé sans leader</li>
          </ul>
        </div>

        {/* Motif (optionnel) */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-white/70 mb-1">
            Motif de suppression <span className="text-white/40">(optionnel)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Demande utilisateur (RGPD), Compte inactif, Violation des CGU..."
            maxLength={200}
            rows={2}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-sport-400/50 resize-none"
          />
          <div className="text-[11px] text-white/40 mt-1">
            Si renseigné, sera inclus dans l'email RGPD envoyé à l'utilisateur.
          </div>
        </div>

        {/* Option : envoyer l'email RGPD */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500"
            />
            <span className="text-sm">
              📧 Envoyer l'email de confirmation RGPD à <strong>{target.email}</strong>
              <span className="text-sport-300 text-xs ml-1">(recommandé)</span>
            </span>
          </label>
          {!notify && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-400/30 rounded text-[11px] text-red-200">
              ⚠️ Désactiver l'email n'est pas conforme RGPD. À utiliser uniquement
              si l'utilisateur a déjà été notifié par un autre canal (ex: réponse manuelle au support).
            </div>
          )}
        </div>

        {/* Double confirmation : taper le username */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-white/70 mb-1">
            Pour confirmer, tape <code className="px-1.5 py-0.5 bg-white/10 rounded text-sport-300 font-mono">{target.username}</code> ci-dessous :
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={target.username}
            autoComplete="off"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-red-400/50"
          />
        </div>

        {/* Boutons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={processing}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
              canConfirm
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-white/5 text-white/30 cursor-not-allowed'
            }`}
          >
            {processing ? '⏳ Suppression...' : '🗑️ Supprimer définitivement'}
          </button>
        </div>
      </div>
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
      <div className="bg-gradient-to-br from-[#1a1f3a] to-[#0a0e27] border border-sport-400/30 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <Lock className="w-6 h-6 text-sport-400" />
          <h3 className="text-xl font-bold">{t('auth.guestPromptTitle')}</h3>
        </div>
        <p className="text-white/70 mb-6">{t('auth.guestPromptText')}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm">
            {t('common.cancel')}
          </button>
          <button onClick={onSignin} className="flex-1 py-2 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 rounded-lg text-sm font-bold">
            {t('auth.guestPromptCTA')}
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
      friendsLeague: '/pronostics-coupe-du-monde-entre-amis',
    },
    en: {
      schedule: '/seo/en/world-cup-2026-schedule.html',
      groups: '/seo/en/world-cup-2026-groups.html',
      teams: '/seo/en/qualified-teams-world-cup-2026.html',
      stadiums: '/seo/en/world-cup-2026-stadiums.html',
      format: '/seo/en/48-teams-format-world-cup-2026.html',
      favorites: '/seo/en/world-cup-2026-favorites.html',
      friendsLeague: '/world-cup-predictions-with-friends',
    },
    es: {
      schedule: '/seo/es/calendario-mundial-2026.html',
      groups: '/seo/es/grupos-mundial-2026.html',
      teams: '/seo/es/equipos-clasificados-mundial-2026.html',
      stadiums: '/seo/es/estadios-mundial-2026.html',
      format: '/seo/es/formato-48-equipos-mundial-2026.html',
      favorites: '/seo/es/favoritos-mundial-2026.html',
      friendsLeague: '/pronosticos-mundial-entre-amigos',
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
            <div className="font-black text-xl bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">United Pronos</div>
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
        <div className="absolute inset-0 bg-gradient-to-b from-sport-500/10 via-transparent to-transparent pointer-events-none"></div>
        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-sport-500/10 border border-sport-400/20 rounded-full text-sm text-sport-200">
            <Zap className="w-4 h-4" /> 11 juin – 19 juillet 2026 · USA · Canada · Mexique
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black mb-6 leading-tight">
            <span className="bg-gradient-to-r from-cta-400 via-cta-500 to-cta-400 bg-clip-text text-transparent">
              {t('home.heroTitle')}
            </span>
          </h1>
          {/* H2 SEO : renforce le maillage sémantique avec un mot-clé secondaire */}
          <h2 className="text-xl sm:text-2xl font-bold text-white/90 mb-4 max-w-3xl mx-auto">
            {t('home.heroH2')}
          </h2>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-4">
            {t('home.heroSubtitle')}
          </p>
          <p className="text-base text-sport-300/90 max-w-2xl mx-auto mb-10 font-semibold">
            {t('home.heroPitch')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={onSignup}
              className="px-8 py-4 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition">
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
            <div className="inline-block px-3 py-1 mb-2 bg-sport-500/10 border border-sport-400/30 rounded-full text-xs font-bold text-sport-300 uppercase tracking-wider">
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
            <a href={urls.friendsLeague}
              className="group relative p-4 bg-gradient-to-br from-yellow-400/15 to-orange-500/10 hover:from-yellow-400/25 hover:to-orange-500/20 border border-yellow-400/40 hover:border-yellow-400/70 rounded-xl transition text-center md:col-span-1">
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full">⭐ {t('home.seoNew')}</div>
              <div className="text-2xl mb-1.5">🍻</div>
              <div className="font-bold text-sm">{t('home.seoFriendsLeague')}</div>
              <div className="text-xs text-white/40 mt-0.5">{t('home.seoFriendsLeagueSub')}</div>
            </a>
            <a href={urls.schedule}
              className="group relative p-4 bg-gradient-to-br from-sport-500/10 to-sport-600/5 hover:from-sport-500/20 hover:to-sport-600/10 border border-white/10 hover:border-sport-400/50 rounded-xl transition text-center">
              <div className="text-2xl mb-1.5">📅</div>
              <div className="font-bold text-sm">{t('home.seoSchedule')}</div>
              <div className="text-xs text-white/40 mt-0.5">{t('home.seoScheduleSub')}</div>
            </a>
            <a href={urls.groups}
              className="group relative p-4 bg-gradient-to-br from-sport-500/10 to-sport-600/5 hover:from-sport-500/20 hover:to-sport-600/10 border border-white/10 hover:border-sport-400/50 rounded-xl transition text-center">
              <div className="text-2xl mb-1.5">👥</div>
              <div className="font-bold text-sm">{t('home.seoGroups')}</div>
              <div className="text-xs text-white/40 mt-0.5">{t('home.seoGroupsSub')}</div>
            </a>
            <a href={urls.teams}
              className="group relative p-4 bg-gradient-to-br from-sport-500/10 to-sport-600/5 hover:from-sport-500/20 hover:to-sport-600/10 border border-white/10 hover:border-sport-400/50 rounded-xl transition text-center">
              <div className="text-2xl mb-1.5">🌍</div>
              <div className="font-bold text-sm">{t('home.seoTeams')}</div>
              <div className="text-xs text-white/40 mt-0.5">{t('home.seoTeamsSub')}</div>
            </a>
            <a href={urls.stadiums}
              className="group relative p-4 bg-gradient-to-br from-sport-500/10 to-sport-600/5 hover:from-sport-500/20 hover:to-sport-600/10 border border-white/10 hover:border-sport-400/50 rounded-xl transition text-center">
              <div className="text-2xl mb-1.5">🏟️</div>
              <div className="font-bold text-sm">{t('home.seoStadiums')}</div>
              <div className="text-xs text-white/40 mt-0.5">{t('home.seoStadiumsSub')}</div>
            </a>
            <a href={urls.format}
              className="group relative p-4 bg-gradient-to-br from-sport-500/10 to-sport-600/5 hover:from-sport-500/20 hover:to-sport-600/10 border border-white/10 hover:border-sport-400/50 rounded-xl transition text-center">
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
            <div className="text-4xl font-black bg-gradient-to-r from-cta-500 to-cta-600 bg-clip-text text-transparent">104</div>
            <div className="text-sm text-white/50 mt-1">{t('home.statsMatches')}</div>
          </div>
          <div>
            <div className="text-4xl font-black bg-gradient-to-r from-cta-500 to-cta-600 bg-clip-text text-transparent">48</div>
            <div className="text-sm text-white/50 mt-1">{t('home.statsTeams')}</div>
          </div>
          <div>
            <div className="text-4xl font-black bg-gradient-to-r from-cta-500 to-cta-600 bg-clip-text text-transparent">3</div>
            <div className="text-sm text-white/50 mt-1">{t('home.statsLanguages')}</div>
          </div>
          <div>
            <div className="text-4xl font-black bg-gradient-to-r from-cta-500 to-cta-600 bg-clip-text text-transparent">100%</div>
            <div className="text-sm text-white/50 mt-1">{t('home.statsFree')}</div>
          </div>
        </div>
      </section>

      {/* ===== 3 MODES (le cœur de la page) ===== */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 mb-4 bg-sport-500/10 border border-sport-400/30 rounded-full text-xs font-bold text-sport-300 uppercase tracking-wider">
              {t('home.modes.badge')}
            </div>
            <h2 className="text-3xl sm:text-5xl font-black mb-4">{t('home.modes.title')}</h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">{t('home.modes.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* MODE 1 — SOLO */}
            <div className="relative bg-white/5 border border-white/10 rounded-3xl p-8 hover:border-sport-400/40 transition group">
              <div className="text-5xl mb-4">🏃</div>
              <h3 className="text-2xl font-black mb-2">{t('home.modes.solo.title')}</h3>
              <p className="text-sport-300 font-semibold mb-4 text-sm">{t('home.modes.solo.tagline')}</p>
              <p className="text-white/70 text-sm mb-6 leading-relaxed">{t('home.modes.solo.desc')}</p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.solo.bullet1')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.solo.bullet2')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.solo.bullet3')}</span></li>
              </ul>
              <button onClick={onSignup}
                className="w-full py-3 bg-white/5 hover:bg-cta-500 border border-white/10 hover:border-sport-500 rounded-lg font-bold text-sm transition group-hover:bg-sport-500/10">
                {t('home.modes.solo.cta')} →
              </button>
              <div className="mt-3 text-center text-xs text-white/40">{t('home.modes.free')}</div>
            </div>

            {/* MODE 2 — GROUPE (mis en avant) */}
            <div className="relative bg-gradient-to-br from-sport-500/10 to-sport-600/10 border-2 border-sport-400/40 rounded-3xl p-8 hover:border-sport-400/60 transition group shadow-xl shadow-sport-500/10 md:scale-105">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-cta-500 to-cta-600 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap">
                ⭐ {t('home.modes.popular')}
              </div>
              <div className="text-5xl mb-4">👥</div>
              <h3 className="text-2xl font-black mb-2">{t('home.modes.group.title')}</h3>
              <p className="text-sport-300 font-semibold mb-4 text-sm">{t('home.modes.group.tagline')}</p>
              <p className="text-white/70 text-sm mb-6 leading-relaxed">{t('home.modes.group.desc')}</p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.group.bullet1')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.group.bullet2')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.group.bullet3')}</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /><span>{t('home.modes.group.bullet4')}</span></li>
              </ul>
              <button onClick={onSignup}
                className="w-full py-3 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 rounded-lg font-bold text-sm transition shadow-lg shadow-orange-500/20">
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
            <div className="bg-gradient-to-br from-sport-500/10 to-sport-700/10 border border-sport-400/20 rounded-2xl p-6">
              <Calendar className="w-10 h-10 mb-3 text-sport-300" />
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
                <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-cta-500 to-cta-600 flex items-center justify-center font-black">
                  {i + 1}
                </div>
                <div className="font-semibold">{step}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-white/5 border border-white/10 rounded-2xl p-6">
            <p className="text-center text-sm text-white/60 mb-4 font-semibold">{t('home.scoringSystem')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-sport-500/10 border border-sport-400/30 rounded-lg">
                <div className="text-2xl font-black text-sport-400">15</div>
                <div className="text-xs text-white/60 mt-1">{t('home.points15')}</div>
              </div>
              <div className="p-3 bg-cta-500/5 border border-sport-400/20 rounded-lg">
                <div className="text-2xl font-black text-sport-300">8</div>
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
          <Trophy className="w-16 h-16 mx-auto mb-6 text-sport-400" />
          <h2 className="text-3xl sm:text-4xl font-black mb-4">{t('home.finalCta')}</h2>
          <p className="text-white/60 mb-8">{t('home.finalCtaSub')}</p>
          <button onClick={onSignup}
            className="px-10 py-5 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 transition inline-flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> {t('home.signupNow')}
          </button>
          <button onClick={onContinueAsGuest} className="block mx-auto mt-4 text-sm text-white/40 hover:text-white/70 transition">
            {t('auth.continueAsGuest')} →
          </button>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION SEO : Contenu textuel riche (boost référencement) */}
      {/* Texte indexable par Google, structuré en H2/H3 */}
      {/* ============================================ */}
      <section className="py-12 px-4 sm:px-6 max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-black mb-4 bg-gradient-to-r from-cta-500 to-cta-600 bg-clip-text text-transparent">
          {t('home.seoSection1Title')}
        </h2>
        <p className="text-white/70 leading-relaxed mb-3">{t('home.seoSection1P1')}</p>
        <p className="text-white/70 leading-relaxed mb-3">{t('home.seoSection1P2')}</p>

        <h3 className="text-xl font-bold mt-8 mb-3 text-white/90">{t('home.seoSection2Title')}</h3>
        <p className="text-white/70 leading-relaxed mb-3">{t('home.seoSection2P1')}</p>
        <ul className="space-y-2 text-white/70 leading-relaxed mb-3 pl-5 list-disc">
          <li>{t('home.seoSection2Li1')}</li>
          <li>{t('home.seoSection2Li2')}</li>
          <li>{t('home.seoSection2Li3')}</li>
          <li>{t('home.seoSection2Li4')}</li>
        </ul>

        <h3 className="text-xl font-bold mt-8 mb-3 text-white/90">{t('home.seoSection3Title')}</h3>
        <p className="text-white/70 leading-relaxed mb-3">{t('home.seoSection3P1')}</p>

        <h3 className="text-xl font-bold mt-8 mb-3 text-white/90">{t('home.seoSection4Title')}</h3>
        <p className="text-white/70 leading-relaxed mb-3">{t('home.seoSection4P1')}</p>

        {/* Liens internes contextuels */}
        <div className="mt-8 p-5 bg-white/5 border border-white/10 rounded-xl">
          <h3 className="text-base font-bold mb-3 text-sport-300">{t('home.seoInternalTitle')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <a href={urls.friendsLeague} className="text-white/70 hover:text-sport-400 transition">→ {t('home.seoLinkFriends')}</a>
            <a href={urls.favorites} className="text-white/70 hover:text-sport-400 transition">→ {t('home.seoLinkFavorites')}</a>
            <a href={urls.schedule} className="text-white/70 hover:text-sport-400 transition">→ {t('home.seoLinkSchedule')}</a>
            <a href={urls.groups} className="text-white/70 hover:text-sport-400 transition">→ {t('home.seoLinkGroups')}</a>
            <a href={urls.teams} className="text-white/70 hover:text-sport-400 transition">→ {t('home.seoLinkTeams')}</a>
            <a href={urls.stadiums} className="text-white/70 hover:text-sport-400 transition">→ {t('home.seoLinkStadiums')}</a>
          </div>
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
      <div className="bg-gradient-to-br from-[#1a1f3a] to-[#0a0e27] border border-sport-400/30 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-cta-500 to-cta-600 flex items-center justify-center text-3xl">
            ☕
          </div>
          <h3 className="text-2xl font-black mb-2">{t('donate.title')}</h3>
          <p className="text-white/60 text-sm">{t('donate.subtitle')}</p>
        </div>
        <div className="space-y-3">
          {/* Ko-fi en premier : 0% de frais, meilleur pour le créateur */}
          {links.kofi && (
            <a href={links.kofi} target="_blank" rel="noopener noreferrer"
              className="group relative block w-full py-4 px-5 bg-sport-gradient hover:from-sport-700 hover:to-sport-600 rounded-xl font-bold text-center transition transform hover:scale-[1.02] shadow-lg">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">☕</span>
                <span className="text-white">{t('donate.viaKofi')}</span>
              </div>
              <div className="text-xs text-white/80 mt-1 font-normal">{t('donate.kofiNote')}</div>
            </a>
          )}
          {links.stripe && (
            <a href={links.stripe} target="_blank" rel="noopener noreferrer"
              className="block w-full py-4 px-5 bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 rounded-xl font-bold text-center transition transform hover:scale-[1.02] shadow-lg">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">💳</span>
                <span className="text-white">{t('donate.viaStripe')}</span>
              </div>
              <div className="text-xs text-white/80 mt-1 font-normal">{t('donate.stripeNote')}</div>
            </a>
          )}
        </div>
        <p className="text-center text-xs text-white/40 mt-5 italic">
          {t('donate.footer')}
        </p>
        <button onClick={onClose} className="mt-3 w-full py-2 text-sm text-white/40 hover:text-white/70 transition">
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
      <div className="bg-gradient-to-br from-[#1a1f3a] to-[#0a0e27] border border-sport-400/30 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-cta-500 to-cta-600 flex items-center justify-center text-2xl">
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
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-sport-400 text-sm" />
            <input type="email" placeholder={t('contact.email')} required value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-sport-400 text-sm" />
            <input type="text" placeholder={t('contact.subjectPlaceholder')} maxLength={120} value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-sport-400 text-sm" />
            <textarea placeholder={t('contact.messagePlaceholder')} required minLength={10} maxLength={2000} rows={5} value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-sport-400 text-sm resize-none" />

            {/* Compteur de caractères + indication minimum */}
            <div className="flex justify-between items-center text-xs -mt-1">
              <span className={message.length < 10 ? 'text-sport-400' : 'text-white/40'}>
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
              className="w-full py-3 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 disabled:opacity-50 rounded-lg font-bold transition">
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
// =====================================================
// ADMIN — Panneau utilisateurs avec tracking last_seen
// =====================================================

/**
 * Formate un timestamp en texte humain : "il y a 2h", "hier", "il y a 3 jours".
 * Renvoie null si jamais connecté.
 */
function formatLastSeen(iso) {
  if (!iso) return null
  try {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now - date
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffH = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffH / 24)

    if (diffSec < 60) return 'à l\'instant'
    if (diffMin < 60) return `il y a ${diffMin} min`
    if (diffH < 24) return `il y a ${diffH}h`
    if (diffDays === 1) return 'hier'
    if (diffDays < 7) return `il y a ${diffDays} jours`
    if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} sem.`
    if (diffDays < 365) return `il y a ${Math.floor(diffDays / 30)} mois`
    return `il y a ${Math.floor(diffDays / 365)} an${Math.floor(diffDays / 365) > 1 ? 's' : ''}`
  } catch (e) {
    return null
  }
}

/**
 * Couleur de pastille selon l'activité de l'utilisateur :
 * - vert : actif (< 7 jours)
 * - jaune : dormant (7-30 jours)
 * - rouge : inactif (> 30 jours ou jamais)
 */
function getActivityLevel(iso) {
  if (!iso) return { color: 'gray', label: 'jamais', emoji: '⚪' }
  try {
    const days = (new Date() - new Date(iso)) / (1000 * 60 * 60 * 24)
    if (days < 7) return { color: 'green', label: 'actif', emoji: '🟢' }
    if (days < 30) return { color: 'yellow', label: 'dormant', emoji: '🟡' }
    return { color: 'red', label: 'inactif', emoji: '🔴' }
  } catch (e) {
    return { color: 'gray', label: '?', emoji: '⚪' }
  }
}

function AdminUsersPanel({ users, currentUserId, onDelete }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')      // all | active | dormant | inactive | never
  const [sortBy, setSortBy] = useState('last_seen') // last_seen | created | username
  const [search, setSearch] = useState('')

  // Compteurs par activité (pour les badges des filtres)
  const counts = useMemo(() => {
    const c = { all: users.length, active: 0, dormant: 0, inactive: 0, never: 0 }
    users.forEach(u => {
      const lvl = getActivityLevel(u.last_seen_at)
      if (!u.last_seen_at) c.never++
      else if (lvl.color === 'green') c.active++
      else if (lvl.color === 'yellow') c.dormant++
      else if (lvl.color === 'red') c.inactive++
    })
    return c
  }, [users])

  // Filtrage + recherche + tri
  const filtered = useMemo(() => {
    let list = [...users]

    // Filtre par activité
    if (filter !== 'all') {
      list = list.filter(u => {
        if (filter === 'never') return !u.last_seen_at
        const lvl = getActivityLevel(u.last_seen_at)
        if (filter === 'active') return lvl.color === 'green'
        if (filter === 'dormant') return lvl.color === 'yellow'
        if (filter === 'inactive') return lvl.color === 'red'
        return true
      })
    }

    // Recherche texte (username + email)
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(u =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    }

    // Tri
    list.sort((a, b) => {
      if (sortBy === 'last_seen') {
        // Jamais connectés en dernier, puis du plus récent au plus ancien
        if (!a.last_seen_at && !b.last_seen_at) return 0
        if (!a.last_seen_at) return 1
        if (!b.last_seen_at) return -1
        return new Date(b.last_seen_at) - new Date(a.last_seen_at)
      }
      if (sortBy === 'created') {
        return new Date(b.created_at) - new Date(a.created_at)
      }
      if (sortBy === 'username') {
        return a.username.localeCompare(b.username)
      }
      return 0
    })

    return list
  }, [users, filter, search, sortBy])

  return (
    <div>
      {/* Stats cards en haut */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
          <div className="text-2xl font-black">{counts.all}</div>
          <div className="text-xs text-white/60">Total</div>
        </div>
        <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-2 text-center">
          <div className="text-2xl font-black text-green-300">{counts.active}</div>
          <div className="text-xs text-green-200/80">🟢 Actifs (7j)</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-2 text-center">
          <div className="text-2xl font-black text-yellow-300">{counts.dormant}</div>
          <div className="text-xs text-yellow-200/80">🟡 Dormants</div>
        </div>
        <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-2 text-center">
          <div className="text-2xl font-black text-red-300">{counts.inactive}</div>
          <div className="text-xs text-red-200/80">🔴 Inactifs</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
          <div className="text-2xl font-black text-white/40">{counts.never}</div>
          <div className="text-xs text-white/40">⚪ Jamais</div>
        </div>
      </div>

      {/* Recherche + filtres + tri */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Rechercher par nom ou email..."
          className="flex-1 min-w-[200px] px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm"
        >
          <option value="last_seen">Tri : dernière connexion</option>
          <option value="created">Tri : date inscription</option>
          <option value="username">Tri : nom A-Z</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: 'all', label: 'Tous', count: counts.all },
          { id: 'active', label: '🟢 Actifs', count: counts.active },
          { id: 'dormant', label: '🟡 Dormants', count: counts.dormant },
          { id: 'inactive', label: '🔴 Inactifs', count: counts.inactive },
          { id: 'never', label: '⚪ Jamais', count: counts.never },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f.id ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <span style={{ fontSize: 40 }}>👤</span>
          <p className="mt-3">Aucun utilisateur</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            const activity = getActivityLevel(u.last_seen_at)
            const lastSeenText = formatLastSeen(u.last_seen_at)
            return (
              <div key={u.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cta-500 to-cta-600 flex items-center justify-center font-black text-sm flex-shrink-0">
                  {u.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{u.username}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      u.role === 'admin' ? 'bg-red-500/20 text-red-300' :
                      u.role === 'leader' ? 'bg-purple-500/20 text-purple-300' :
                      'bg-white/5 text-white/60'
                    }`}>
                      {u.role}
                    </span>
                  </div>
                  <div className="text-xs text-white/40 truncate">{u.email}</div>
                </div>
                <div className="hidden sm:block text-right text-xs flex-shrink-0">
                  <div className={`font-semibold ${
                    activity.color === 'green' ? 'text-green-300' :
                    activity.color === 'yellow' ? 'text-yellow-300' :
                    activity.color === 'red' ? 'text-red-300' :
                    'text-white/40'
                  }`}>
                    {activity.emoji} {lastSeenText || 'Jamais connecté'}
                  </div>
                  {u.last_seen_at && (
                    <div className="text-white/30 text-[10px]" title={u.last_seen_at}>
                      {new Date(u.last_seen_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
                {u.id !== currentUserId && (
                  <button onClick={() => onDelete(u)}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded flex-shrink-0"
                    title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info en bas */}
      <div className="mt-4 text-xs text-white/30 text-center">
        Mis à jour à chaque activité (max toutes les 5 min par utilisateur)
      </div>
    </div>
  )
}


// =====================================================
// ADMIN — Panneau de contact (messages)
// =====================================================
function AdminContactPanel() {
  const { t } = useTranslation()
  const [messages, setMessages] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [replyingId, setReplyingId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [attachments, setAttachments] = useState([])  // [{ filename, data, mime, size }]
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const reload = async () => {
    const data = await api.adminContactMessages(statusFilter === 'all' ? null : statusFilter)
    setMessages(data)
  }

  useEffect(() => { reload() }, [statusFilter])

  // Cleanup paste handler quand on quitte le mode réponse
  useEffect(() => {
    if (!replyingId) return
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            addFile(file)
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [replyingId, attachments])

  const updateStatus = async (id, status) => {
    await api.adminUpdateContactStatus(id, status)
    reload()
  }

  const deleteMsg = async (id) => {
    if (!confirm('Supprimer ce message ?')) return
    await api.adminDeleteContact(id)
    reload()
  }

  const startReply = (msg) => {
    setReplyingId(msg.id)
    setReplyText(msg.admin_reply || '')
    setAttachments([])
  }

  const cancelReply = () => {
    setReplyingId(null)
    setReplyText('')
    setAttachments([])
  }

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // Lit un File et l'ajoute aux pièces jointes
  const addFile = (file) => {
    const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    if (!ALLOWED.includes(file.type)) {
      showToast('error', `Type non supporté : ${file.type}. Formats : PNG, JPG, WebP, GIF`)
      return
    }
    if (file.size > 2_200_000) {  // 2.2 MB (laisse marge pour base64)
      showToast('error', `Fichier trop lourd : ${(file.size / 1024 / 1024).toFixed(1)} MB (max 2 MB)`)
      return
    }
    if (attachments.length >= 5) {
      showToast('error', 'Maximum 5 pièces jointes par réponse')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      // ev.target.result = "data:image/png;base64,XXXXX"
      // On nomme le fichier si c'est un screenshot collé sans nom
      const fname = file.name && file.name !== 'image.png'
        ? file.name
        : `capture-${Date.now()}.${file.type.split('/')[1] || 'png'}`
      setAttachments(prev => [...prev, {
        filename: fname,
        data: ev.target.result,  // data URL complet
        mime: file.type,
        size: file.size,
      }])
    }
    reader.onerror = () => showToast('error', 'Erreur lecture fichier')
    reader.readAsDataURL(file)
  }

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files || [])
    files.forEach(addFile)
    e.target.value = ''  // reset pour permettre re-sélection du même fichier
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer?.files || [])
    files.forEach(addFile)
  }

  const removeAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  const sendReply = async (msgId) => {
    if (!replyText.trim()) {
      showToast('error', 'La réponse ne peut pas être vide')
      return
    }
    setSending(true)
    try {
      const result = await api.adminReplyContact(msgId, replyText.trim(), attachments)
      const pjMsg = result.attachments_count > 0 ? ` avec ${result.attachments_count} pièce(s) jointe(s)` : ''
      showToast('success', `✉️ Réponse envoyée à ${result.sent_to}${pjMsg}`)
      cancelReply()
      reload()
    } catch (e) {
      showToast('error', e.message || "Erreur lors de l'envoi")
    } finally {
      setSending(false)
    }
  }

  const statusColor = (s) => ({
    new: 'bg-sport-500/20 text-sport-300 border-sport-400/30',
    read: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    replied: 'bg-green-500/20 text-green-300 border-green-400/30',
    archived: 'bg-white/5 text-white/40 border-white/10',
  }[s] || '')

  const statusLabel = (s) => ({
    new: t('contact.statusNew'), read: t('contact.statusRead'),
    replied: t('contact.statusReplied'), archived: t('contact.statusArchived'),
  }[s] || s)

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg max-w-sm animate-fade-in ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'new', 'read', 'replied', 'archived'].map(s => {
          const count = s === 'all' ? messages.length : messages.filter(m => m.status === s).length
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                statusFilter === s ? 'bg-cta-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
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
                  <span className="text-sm text-white/60">{m.email}</span>
                </div>
                <span className="text-xs text-white/40">{m.created_at}</span>
              </div>
              {m.subject && <div className="text-sm font-semibold text-white/80 mb-1">{m.subject}</div>}
              <p className="text-sm text-white/70 whitespace-pre-wrap mb-3">{m.message}</p>

              {/* Si déjà répondu, on affiche la réponse précédente */}
              {m.admin_reply && (
                <div className="bg-green-500/10 border border-green-400/20 rounded-lg p-3 mb-3">
                  <div className="text-xs text-green-300 font-semibold mb-1">
                    ↪ Réponse envoyée {m.replied_at ? `le ${new Date(m.replied_at).toLocaleDateString('fr-FR')}` : ''}
                  </div>
                  <p className="text-sm text-white/80 whitespace-pre-wrap">{m.admin_reply}</p>
                </div>
              )}

              {/* Formulaire de réponse (inline) */}
              {replyingId === m.id ? (
                <div className="bg-cta-500/5 border border-sport-400/20 rounded-lg p-3 mb-3 space-y-2">
                  <div className="text-xs text-sport-300 font-semibold">
                    📨 Répondre à {m.name} ({m.email})
                  </div>
                  <div className="text-xs text-white/50">
                    Sera envoyé depuis <strong>contact@unitedpronos.com</strong> (ton mail perso reste privé)
                  </div>

                  {/* Textarea avec drag-and-drop */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`relative ${dragOver ? 'ring-2 ring-sport-400 rounded-lg' : ''}`}
                  >
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Bonjour [prénom], merci pour ton message..."
                      maxLength={10000}
                      rows={6}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm resize-vertical"
                      autoFocus
                    />
                    {dragOver && (
                      <div className="absolute inset-0 bg-sport-500/20 border-2 border-dashed border-sport-400 rounded-lg flex items-center justify-center pointer-events-none">
                        <span className="text-sport-200 font-bold">📎 Dépose tes images ici</span>
                      </div>
                    )}
                  </div>

                  {/* Pièces jointes */}
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-white/60 font-semibold">
                        📎 {attachments.length} pièce{attachments.length > 1 ? 's' : ''} jointe{attachments.length > 1 ? 's' : ''} :
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((att, idx) => (
                          <div key={idx} className="relative group bg-white/5 border border-white/10 rounded-lg p-2 flex items-center gap-2">
                            <img src={att.data} alt={att.filename} className="w-12 h-12 object-cover rounded" />
                            <div className="flex flex-col min-w-0 max-w-[150px]">
                              <span className="text-xs text-white/80 truncate">{att.filename}</span>
                              <span className="text-xs text-white/40">{formatSize(att.size)}</span>
                            </div>
                            <button onClick={() => removeAttachment(idx)}
                              className="ml-1 p-1 bg-red-500/20 hover:bg-red-500/40 rounded text-red-300 text-xs"
                              title="Retirer">
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bouton d'ajout + indication */}
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-white/40">
                    <span>{replyText.length} / 10000 caractères</span>
                    <span className="text-white/30">
                      💡 Tu peux aussi <strong>glisser-déposer</strong> ou <strong>coller</strong> (Ctrl+V) des images
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => sendReply(m.id)} disabled={sending || !replyText.trim()}
                      className="px-4 py-2 bg-cta-500 hover:bg-cta-600 disabled:bg-sport-500/30 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition">
                      {sending ? '⏳ Envoi...' : '📤 Envoyer la réponse'}
                    </button>

                    {/* Bouton ajouter PJ */}
                    <label className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm cursor-pointer transition border border-white/10">
                      📎 Ajouter image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        multiple
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </label>

                    <button onClick={cancelReply} disabled={sending}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/60 transition">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-white/5">
                  <button onClick={() => startReply(m)}
                    className="px-3 py-1 bg-sport-500/20 hover:bg-sport-500/30 text-sport-300 rounded text-xs font-semibold transition">
                    {m.admin_reply ? '↻ Re-répondre' : '↪ Répondre'}
                  </button>
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
              )}
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
      friendsLeague: '/pronostics-coupe-du-monde-entre-amis',
    },
    en: {
      schedule: '/seo/en/world-cup-2026-schedule.html',
      groups: '/seo/en/world-cup-2026-groups.html',
      teams: '/seo/en/qualified-teams-world-cup-2026.html',
      stadiums: '/seo/en/world-cup-2026-stadiums.html',
      format: '/seo/en/48-teams-format-world-cup-2026.html',
      favorites: '/seo/en/world-cup-2026-favorites.html',
      friendsLeague: '/world-cup-predictions-with-friends',
    },
    es: {
      schedule: '/seo/es/calendario-mundial-2026.html',
      groups: '/seo/es/grupos-mundial-2026.html',
      teams: '/seo/es/equipos-clasificados-mundial-2026.html',
      stadiums: '/seo/es/estadios-mundial-2026.html',
      format: '/seo/es/formato-48-equipos-mundial-2026.html',
      favorites: '/seo/es/favoritos-mundial-2026.html',
      friendsLeague: '/pronosticos-mundial-entre-amigos',
    },
  }
  const urls = seoUrls[lang] || seoUrls.fr

  // 7 cards à afficher (favoris + pronos entre amis en premier, contenus phares)
  const cards = [
    {
      url: urls.favorites,
      icon: '🥇',
      title: t('info.favorites'),
      subtitle: t('info.favoritesSub'),
      featured: true,
    },
    {
      url: urls.friendsLeague,
      icon: '🍻',
      title: t('info.friendsLeague'),
      subtitle: t('info.friendsLeagueSub'),
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
        <div className="inline-block px-3 py-1 mb-3 bg-sport-500/10 border border-sport-400/30 rounded-full text-xs font-bold text-sport-300 uppercase tracking-wider">
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
                : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-sport-400/50'
            }`}>
            {card.featured && (
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                ⭐ {t('info.new')}
              </div>
            )}
            <div className="text-4xl mb-3">{card.icon}</div>
            <div className="font-bold text-base mb-1">{card.title}</div>
            <div className="text-sm text-white/50">{card.subtitle}</div>
            <div className="mt-3 text-xs text-sport-300 group-hover:text-sport-200 font-semibold">
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

  // Upgrade rôle solo → leader
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [upgradeError, setUpgradeError] = useState('')

  const handleUpgradeToLeader = async () => {
    if (!confirm(t('profile.upgradeConfirm'))) return
    setUpgradeLoading(true); setUpgradeError('')
    try {
      await api.upgradeToLeader()
      // Recharger le profil pour refléter le nouveau rôle
      const me = await api.getProfile()
      setProfile(me)
      if (onUserUpdate) onUserUpdate({ ...currentUser, role: 'leader' })
      setSavedFlash(t('profile.upgradeSuccess'))
      setTimeout(() => setSavedFlash(''), 5000)
    } catch (e) {
      setUpgradeError(e.message || 'Erreur')
    } finally {
      setUpgradeLoading(false)
    }
  }

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
              <img src={avatarData} alt="Avatar" className="w-28 h-28 rounded-full object-cover border-4 border-sport-400/50 shadow-lg" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-cta-500 to-cta-600 flex items-center justify-center text-3xl font-black text-white border-4 border-sport-400/50 shadow-lg">
                {initials}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
            <label htmlFor="avatar-upload" className="cursor-pointer px-4 py-2 bg-cta-500 hover:bg-cta-600 rounded-lg text-sm font-semibold transition">
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
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-sport-400" />
        </div>

        {/* Bio */}
        <div className="mb-4">
          <label className="text-sm font-semibold text-white/70 block mb-1">{t('profile.bio')}</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)}
            maxLength={140} rows={2} placeholder={t('profile.bioPlaceholder')}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-sport-400 resize-none" />
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
                    ? 'bg-sport-500/20 border-sport-400/50 text-sport-200'
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
                  ? 'bg-sport-500/20 border-sport-400/50 text-sport-200'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}>
              🌙 {t('profile.themeDark')}
            </button>
            <button type="button" onClick={() => setProfileTheme('light')}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm transition ${
                profileTheme === 'light'
                  ? 'bg-sport-500/20 border-sport-400/50 text-sport-200'
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
          className="w-full py-3 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 disabled:opacity-50 rounded-lg font-bold transition">
          {saving ? '...' : '💾 ' + t('profile.save')}
        </button>
      </div>

      {/* SECTION DEVENIR LEADER (uniquement pour les utilisateurs solo sans groupe) */}
      {profile && profile.role === 'solo' && !profile.group_id && (
        <div className="bg-gradient-to-br from-sport-500/10 to-purple-500/5 border border-sport-400/30 rounded-2xl p-6">
          <h2 className="text-xl font-black mb-3 flex items-center gap-2">👑 {t('profile.upgradeTitle')}</h2>
          <p className="text-sm text-white/70 mb-4">{t('profile.upgradeText')}</p>
          <ul className="text-sm text-white/60 space-y-1 mb-4 ml-4">
            <li>• {t('profile.upgradeBenefit1')}</li>
            <li>• {t('profile.upgradeBenefit2')}</li>
            <li>• {t('profile.upgradeBenefit3')}</li>
          </ul>
          {upgradeError && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg mb-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{upgradeError}</span>
            </div>
          )}
          <button
            onClick={handleUpgradeToLeader}
            disabled={upgradeLoading}
            className="w-full py-3 bg-gradient-to-r from-sport-600 to-sport-500 hover:from-sport-700 hover:to-sport-600 disabled:opacity-50 rounded-lg font-bold transition flex items-center justify-center gap-2">
            {upgradeLoading ? '...' : <>👑 {t('profile.upgradeButton')}</>}
          </button>
          <p className="text-xs text-white/40 mt-2 text-center italic">{t('profile.upgradeNote')}</p>
        </div>
      )}

      {/* SECTION DÉJÀ LEADER (info, pas d'action) */}
      {profile && profile.role === 'leader' && !profile.group_id && (
        <div className="bg-sport-500/10 border border-sport-400/30 rounded-2xl p-4 text-sm text-sport-200">
          👑 {t('profile.upgradeAlreadyLeader')}
        </div>
      )}

      {/* SECTION SÉCURITÉ */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-black mb-4 flex items-center gap-2">🔒 {t('profile.securityTitle')}</h2>

        <form onSubmit={submitPassword} className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-white/70 block mb-1">{t('profile.currentPwd')}</label>
            <input type="password" required value={currentPwd} onChange={e => setCurrentPwd(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-sport-400" />
          </div>
          <div>
            <label className="text-sm font-semibold text-white/70 block mb-1">{t('profile.newPwd')}</label>
            <input type="password" required minLength={6} value={newPwd} onChange={e => setNewPwd(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-sport-400" />
          </div>
          <div>
            <label className="text-sm font-semibold text-white/70 block mb-1">{t('profile.confirmPwd')}</label>
            <input type="password" required minLength={6} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-sport-400" />
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
          <Trophy className="w-12 h-12 text-sport-400 mx-auto mb-2" />
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
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-sport-400" />
          </div>

          <div>
            <label className="text-sm font-semibold text-white/70 block mb-1">{t('group.description')}</label>
            <textarea maxLength={500} rows={3} placeholder={t('group.descriptionPlaceholder')} value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-sport-400 resize-none" />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading || name.length < 2}
            className="w-full py-3 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 disabled:opacity-50 rounded-lg font-bold transition">
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
          <Trophy className="w-12 h-12 text-sport-400 mx-auto mb-2" />
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
          <div className="bg-white/5 backdrop-blur-xl border border-sport-400/30 rounded-2xl p-6">
            <div className="flex flex-col items-center gap-3 mb-4">
              {preview.logo_data ? (
                <img src={preview.logo_data} alt={preview.name} className="w-24 h-24 rounded-2xl object-cover border-2 border-sport-400/50" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-sport-500/20 flex items-center justify-center text-4xl">🏆</div>
              )}
              <h2 className="text-2xl font-black text-center">{preview.name}</h2>
              {preview.description && <p className="text-sm text-white/70 text-center">{preview.description}</p>}
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span>👥 {preview.member_count} {preview.member_count > 1 ? 'membres' : 'membre'}</span>
                {preview.leader_username && <span>👑 {preview.leader_username}</span>}
              </div>
            </div>

            <div className="bg-sport-500/10 border border-sport-400/30 rounded-lg p-3 text-xs text-sport-200 mb-4">
              {t('group.joinNote')}
            </div>

            {!currentUser ? (
              <p className="text-center text-sm text-white/60 mb-4">{t('signup.invitedTo')} <strong>{preview.name}</strong>. {t('auth.signup')} pour rejoindre.</p>
            ) : (
              <button onClick={join} disabled={joining}
                className="w-full py-3 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 disabled:opacity-50 rounded-lg font-bold transition">
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
        // Tous les membres du groupe (leader inclus) voient le classement interne
        try {
          const m = await api.groupMembers(g.id)
          setMembers(m)
        } catch (e) {
          console.error('groupMembers error:', e)
          setMembers([])
        }
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [])

  // Retire un membre du groupe (leader uniquement). Le membre devient solo
  // et conserve ses pronos. Confirmation explicite + rafraîchissement immédiat.
  const handleRemoveMember = async (memberId, memberName) => {
    if (!group) return
    const confirmMsg = t('group.removeConfirm').replace('{name}', memberName)
    if (!confirm(confirmMsg)) return
    try {
      await api.removeMember(group.id, memberId)
      // Recharge la liste pour refléter la suppression
      const m = await api.groupMembers(group.id)
      setMembers(m)
    } catch (e) {
      alert(e.message || 'Erreur')
    }
  }

  // Rafraîchissement auto toutes les 60s pour suivre le classement en temps réel
  // (les points évoluent après chaque match résolu)
  useEffect(() => {
    if (!group) return
    const interval = setInterval(async () => {
      try {
        const m = await api.groupMembers(group.id)
        setMembers(m)
      } catch (e) {
        // silencieux : pas de toast d'erreur sur un refresh background
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [group])

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
      <div className="bg-gradient-to-br from-sport-500/10 to-sport-600/10 border border-sport-400/30 rounded-2xl p-5">
        <div className="flex items-start gap-4 mb-4">
          {group.logo_data ? (
            <img src={group.logo_data} alt={group.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-sport-400/50" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-sport-500/20 flex items-center justify-center text-3xl">🏆</div>
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
              <button onClick={save} disabled={saving} className="ml-auto px-4 py-1.5 bg-cta-500 hover:bg-cta-600 rounded-lg text-sm font-semibold">
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
            <code className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sport-300 text-sm break-all">
              {window.location.origin}/join/{group.invite_code}
            </code>
            <button onClick={copyInviteLink} className="shrink-0 px-3 py-2 bg-cta-500 hover:bg-cta-600 rounded-lg text-sm font-semibold whitespace-nowrap">
              {copyMsg ? '✓ ' + t('group.inviteCopied') : '📋 ' + t('group.inviteCopy')}
            </button>
          </div>
          <p className="text-xs text-white/40">{t('group.inviteCode')} : <strong>{group.invite_code}</strong></p>
        </div>
      )}

      {/* Classement interne du groupe (visible pour TOUS les membres) */}
      {members.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              🏆 {t('group.ranking')}
              <span className="text-xs text-white/40 font-normal">({members.length} {members.length > 1 ? t('group.membersPlural') : t('group.membersSingular')})</span>
            </h3>
            <button onClick={reload} className="text-xs text-white/40 hover:text-sport-400 transition" title="Rafraîchir">
              🔄
            </button>
          </div>

          <div className="space-y-2">
            {members.map((m, idx) => {
              const isMe = m.id === user?.id
              const rank = idx + 1
              const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
              return (
                <div key={m.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                    isMe
                      ? 'bg-sport-500/15 border-sport-400/50 shadow-md shadow-sport-500/10'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}>

                  {/* Rang */}
                  <div className="w-10 text-center flex-shrink-0">
                    {rankEmoji ? (
                      <span className="text-2xl">{rankEmoji}</span>
                    ) : (
                      <span className={`font-mono font-bold ${isMe ? 'text-sport-300' : 'text-white/40'}`}>
                        #{rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cta-500 to-cta-600 flex items-center justify-center font-black text-sm flex-shrink-0 overflow-hidden">
                    {m.avatar_data ? (
                      <img src={m.avatar_data} alt={m.username} className="w-full h-full object-cover" />
                    ) : (
                      m.username[0].toUpperCase()
                    )}
                  </div>

                  {/* Nom + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                      <span className="truncate">{m.username}</span>
                      {isMe && <span className="text-[10px] bg-cta-500 text-white px-1.5 py-0.5 rounded-full font-bold">{t('group.you')}</span>}
                      {m.is_leader && <span className="text-[11px] text-sport-300" title={t('group.leader')}>👑</span>}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {m.predictions_count} {m.predictions_count > 1 ? t('leaderboard.predictions_plural') : t('leaderboard.predictions')}
                      {m.email && (isLeader || user?.role === 'admin') && (
                        <span className="ml-2 text-white/30">· {m.email}</span>
                      )}
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-right flex-shrink-0">
                    <div className={`text-lg font-black ${isMe ? 'text-sport-300' : 'text-white/90'}`}>
                      {m.points}
                    </div>
                    <div className="text-[10px] text-white/40 uppercase">{t('group.points')}</div>
                  </div>

                  {/* Bouton "Retirer" pour le leader (sauf sur lui-même) */}
                  {isLeader && !isMe && !m.is_leader && (
                    <button
                      onClick={() => handleRemoveMember(m.id, m.username)}
                      className="ml-1 w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition shrink-0"
                      title={t('group.removeMemberTooltip').replace('{name}', m.username)}
                      aria-label={t('group.removeMemberTooltip').replace('{name}', m.username)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Note de transparence */}
          <p className="text-[11px] text-white/30 mt-3 text-center">
            {t('group.rankingNote')}
          </p>
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
  const [searchQuery, setSearchQuery] = useState('')

  const reload = async () => {
    const g = await api.adminListGroups()
    setGroups(g)
  }

  useEffect(() => { reload() }, [])

  // Filtrage par nom, leader ou code d'invitation (insensible à la casse + accents)
  // On normalise via NFD pour gérer "Café" matchant "cafe"
  const normalize = (s) => (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const filteredGroups = groups.filter(g => {
    if (!searchQuery) return true
    const q = normalize(searchQuery.trim())
    return (
      normalize(g.name).includes(q) ||
      normalize(g.leader?.username).includes(q) ||
      normalize(g.invite_code).includes(q) ||
      normalize(g.slug).includes(q)
    )
  })

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
      {/* Barre de recherche : filtre par nom, leader, code d'invitation ou slug */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('admin.groupsSearchPlaceholder')}
          className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-sport-400/50 transition placeholder-white/30"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">🔍</span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition text-sm"
            title={t('admin.clearSearch')}>
            ✕
          </button>
        )}
      </div>

      {/* Compteur : combien de groupes affichés vs total */}
      {searchQuery && (
        <div className="text-xs text-white/50 px-1">
          <strong className="text-sport-300">{filteredGroups.length}</strong> / {groups.length} {t('admin.groupsShown')}
        </div>
      )}

      {/* Liste filtrée */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <div className="text-4xl mb-3">🔍</div>
          <div className="font-semibold">{t('admin.noGroupMatch')}</div>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-3 text-sm text-sport-300 hover:text-sport-200 underline">
            {t('admin.clearSearch')}
          </button>
        </div>
      ) : filteredGroups.map(g => (
        <div key={g.id} className="bg-white/5 border border-white/10 rounded-xl">
          <div className="p-4 flex items-center gap-3">
            {g.logo_data ? <img src={g.logo_data} className="w-12 h-12 rounded-lg object-cover" alt={g.name} />
              : <div className="w-12 h-12 rounded-lg bg-sport-500/20 flex items-center justify-center text-xl">🏆</div>}
            <div className="flex-1 min-w-0">
              <div className="font-bold">{g.name}</div>
              <div className="text-xs text-white/50 flex items-center gap-3 flex-wrap">
                <span>👥 {g.member_count}</span>
                <span>👑 {g.leader?.username}</span>
                <code className="text-sport-300">{g.invite_code}</code>
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
                    {m.role === 'leader' && <span className="text-xs text-sport-300">👑</span>}
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
          <button onClick={onCancel} className="px-6 py-2 bg-cta-500 hover:bg-cta-600 rounded-lg">
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
  // showHome=true → on affiche la HomePage vendeuse aux non-connectés.
  // Logique simple : par défaut, TOUS les non-connectés voient la HomePage.
  // Ils peuvent passer en mode visiteur via le bouton "Continuer en visiteur"
  // ou s'inscrire/se connecter. Le flag localStorage permet UNIQUEMENT de se souvenir
  // qu'un visiteur a déjà choisi "mode visiteur" dans cette session.
  const [showHome, setShowHome] = useState(() => {
    // Nettoyage : supprime l'ancien flag localStorage (logique obsolète)
    // qui empêchait les visiteurs récurrents de revoir la HomePage.
    try { localStorage.removeItem('prono26_homepage_seen') } catch (e) {}
    // Si l'utilisateur a explicitement choisi "Continuer en visiteur" dans cette session,
    // on respecte son choix et on n'affiche pas la HomePage à chaque rafraîchissement.
    try {
      const seenAsGuest = sessionStorage.getItem('prono26_continued_as_guest')
      return seenAsGuest !== '1'
    } catch (e) {
      return true
    }
  })
  const [showAuth, setShowAuth] = useState(false)
  const [authInitialMode, setAuthInitialMode] = useState('login')
  const [showGuestPrompt, setShowGuestPrompt] = useState(false)
  const [showDonate, setShowDonate] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const [contextualDonation, setContextualDonation] = useState(null)  // null | 'all_pronos_done' | 'podium_reached' | 'group_active'
  const [isSupporter, setIsSupporter] = useState(false)  // pour cacher pulsation aux supporters

  // Vérifie si l'utilisateur connecté est déjà supporter (pour ne pas l'embêter avec la pulsation)
  useEffect(() => {
    if (!user || isGuest) { setIsSupporter(false); return }
    api.meIsSupporter()
      .then(r => setIsSupporter(r.is_supporter))
      .catch(() => setIsSupporter(false))
  }, [user, isGuest])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('matches')
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState([])
  const [leaderboard, setLeaderboard] = useState({ ranked: [], ranked_count: 0, excluded_admins: 0, total_users: 0 })
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

  // === RESET PASSWORD ===
  // Si l'URL contient ?reset_token=XXX → affiche la page de réinitialisation
  const [resetToken, setResetToken] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      return params.get('reset_token') || null
    } catch { return null }
  })

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
      // Pas de token
      // Si visiteur récurrent (HomePage déjà vue), on l'active automatiquement en mode visiteur
      // sinon il resterait coincé sur la HomePage
      if (!showHome) {
        setIsGuest(true)
      }
      setLoading(false)
    }
  }, [])

  // Charger les données publiques quand on n'est pas sur la HomePage
  // OPTIMISATION HAUTE CHARGE :
  //   - Polling à 45s (au lieu de 30s) : suffisant car les matchs ne changent que toutes les ~2h
  //   - Stop le polling si l'onglet n'est pas visible (Page Visibility API)
  //   - Refresh immédiat quand l'onglet redevient visible
  // → divise par 3-5× les requêtes inutiles en pic de charge.
  useEffect(() => {
    if (loading || showHome) return
    loadPublic()
    let interval = null
    const startPolling = () => {
      if (interval) clearInterval(interval)
      // Polling 60s en période de pic (1000+ users) : la fluidité reste correcte
      // car le cache RAM serveur de 15s couvre déjà les mises à jour fréquentes.
      // À 150 connexions simultanées, ça divise la charge backend par 2 vs 30s.
      interval = setInterval(loadPublic, 60000)
    }
    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null }
    }
    // Démarre par défaut
    startPolling()
    // Gestion visibilité onglet
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        // Onglet redevient visible : refresh immédiat puis relance le polling
        loadPublic()
        startPolling()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loading, user, lang, showHome])

  const loadPublic = async () => {
    try {
      // OPTIMISATION : 1 seul appel /api/snapshot au lieu de 3 appels parallèles.
      // Réduit le RPS du serveur de 67% avec 100+ utilisateurs en polling.
      //
      // PROTECTION CRITIQUE : on ne REMPLACE les matches existants que si on a
      // VRAIMENT reçu une liste non vide. Sinon, on conserve l'ancien état pour
      // éviter d'afficher "Aucun match" au moindre hoquet réseau ou cache vide.
      try {
        const snap = await api.snapshot(lang)
        // setMatches uniquement si le serveur a renvoyé une liste valide ET non vide.
        // Le polling toutes les 30s rattrapera si jamais c'était vraiment vide.
        if (Array.isArray(snap.matches) && snap.matches.length > 0) {
          setMatches(snap.matches)
        }
        // Idem pour leaderboard : on garde l'ancien si vide
        if (snap.leaderboard && (snap.leaderboard.ranked?.length || Array.isArray(snap.leaderboard) && snap.leaderboard.length)) {
          setLeaderboard(snap.leaderboard)
        }
        // News peut être vide légitimement (filtrage par lang)
        if (Array.isArray(snap.news)) {
          setNews(snap.news)
        }
      } catch (snapErr) {
        // Fallback (cas où le backend n'est pas encore à jour ou snapshot KO)
        try {
          const [m, l, n] = await Promise.all([api.matches(), api.leaderboard(), api.news(null, lang)])
          if (Array.isArray(m) && m.length > 0) setMatches(m)
          if (l && (l.ranked?.length || Array.isArray(l) && l.length)) setLeaderboard(l)
          if (Array.isArray(n)) setNews(n)
        } catch (fbErr) {
          console.error('Fallback aussi KO:', fbErr)
          // On NE TOUCHE PAS aux états existants : l'utilisateur garde sa vue
        }
      }
      if (user) {
        try {
          const p = await api.myPredictions()
          if (Array.isArray(p)) setPredictions(p)
        } catch (e) {
          console.error('Erreur predictions:', e)
        }
      } else {
        setPredictions([])
      }
    } catch (e) { console.error(e) }
  }

  // === DÉTECTION DES MOMENTS MAGIQUES ===
  // Quand le classement change (résultats publiés), on cherche si l'utilisateur a
  // atteint un palier symbolique pour déclencher un modal de soutien.
  // Tous les triggers ne se déclenchent qu'UNE SEULE FOIS dans la vie du compte
  // (mémorisé en localStorage par shouldShowContextualModal).
  useEffect(() => {
    if (!user || isGuest || !leaderboard) return
    const ranked = Array.isArray(leaderboard) ? leaderboard : (leaderboard?.ranked || [])
    if (ranked.length === 0) return

    const myEntry = ranked.find(e => e.id === user.id)
    if (!myEntry) return

    const myRank = ranked.indexOf(myEntry) + 1
    const myPoints = myEntry.total_points || 0

    // Trigger #1 : Premier point gagné (le plus fort = moment de surprise positive)
    if (myPoints > 0 && shouldShowContextualModal('first_point_scored')) {
      setTimeout(() => {
        setContextualDonation('first_point_scored')
        markContextualModalShown('first_point_scored')
      }, 1500)
      return  // une seule modal à la fois
    }

    // Trigger #2 : Top 10 atteint (ego boost)
    if (myRank <= 10 && ranked.length >= 20 && shouldShowContextualModal('top_10')) {
      setTimeout(() => {
        setContextualDonation('top_10')
        markContextualModalShown('top_10')
      }, 1500)
      return
    }

    // Trigger #3 : Podium atteint (le pic émotionnel)
    if (myRank <= 3 && shouldShowContextualModal('podium_reached')) {
      setTimeout(() => {
        setContextualDonation('podium_reached')
        markContextualModalShown('podium_reached')
      }, 1500)
      return
    }
  }, [leaderboard, user, isGuest])

  const handleSavePrediction = async (matchId, h, a) => {
    await api.savePrediction(matchId, h, a)
    const [p, l] = await Promise.all([api.myPredictions(), api.leaderboard()])
    setPredictions(p); setLeaderboard(l)

    // === DÉTECTION 100% PRONOS COMPLÉTÉS ===
    // Si l'utilisateur vient de saisir SON DERNIER pronostic manquant,
    // on déclenche un modal contextuel pour proposer de soutenir (UNE seule fois).
    // Critère : tous les matchs PRONOSTIQUABLES (équipes connues + à venir) ont une prédiction.
    if (user && !isGuest) {
      const upcomingMatches = matches.filter(m =>
        m.status === 'scheduled' && !isTBD(m.home_team) && !isTBD(m.away_team)
      )
      const predictedIds = new Set(p.map(pp => pp.match_id))
      const upcomingPredicted = upcomingMatches.filter(m => predictedIds.has(m.id))
      const isComplete = upcomingMatches.length > 0 && upcomingPredicted.length === upcomingMatches.length

      if (isComplete && shouldShowContextualModal('all_pronos_done')) {
        // Léger délai pour laisser l'animation de save se terminer
        setTimeout(() => {
          setContextualDonation('all_pronos_done')
          markContextualModalShown('all_pronos_done')
        }, 800)
      }
    }
  }

  const handleAdminSetScore = async (matchId, h, a) => {
    await api.adminSetScore(matchId, h, a)
    await loadPublic()
  }

  const handleRefreshNews = async () => {
    await api.refreshNews()
    setNews(await api.news(null, lang))
  }

  // Marquer le passage en mode visiteur pour la session courante.
  // Évite que le visiteur revienne sur la HomePage à chaque rafraîchissement.
  // Note : sessionStorage (pas localStorage) → la HomePage réapparait à la prochaine visite.
  const markGuestSessionChosen = () => {
    try { sessionStorage.setItem('prono26_continued_as_guest', '1') } catch (e) {}
  }
  const handleSignup = () => { setAuthInitialMode('signup'); setShowAuth(true); setShowHome(false) }
  const handleLogin = () => { setAuthInitialMode('login'); setShowAuth(true); setShowHome(false) }
  const handleGuest = () => { markGuestSessionChosen(); setIsGuest(true); setShowHome(false) }

  // Bouton "Retour à l'accueil" depuis l'app en mode visiteur
  const handleBackToHome = () => {
    try { sessionStorage.removeItem('prono26_continued_as_guest') } catch (e) {}
    setIsGuest(false); setShowHome(true)
  }

  const onLogin = (u) => {
    setUser(u); setIsGuest(false); setShowAuth(false); setShowHome(false)
    // Toujours afficher les matchs au login (peu importe ce que l'utilisateur regardait avant)
    setActiveTab('matches')
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
  const logout = () => { setToken(null); setUser(null); setIsGuest(false); setShowHome(true); setNeedsGroupCreation(false); setActiveTab('matches') }
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
            className="px-6 py-2 bg-cta-500 hover:bg-cta-600 rounded-lg">
            ← {t('auth.guestBack')}
          </button>
        </div>
      </div>
    )
  }

  // 0. PRIORITÉ ABSOLUE : Reset password si l'URL contient ?reset_token=XXX
  if (resetToken) {
    return <ResetPasswordPage
      token={resetToken}
      onSuccess={() => {
        setResetToken(null)
        // Force le retour à l'écran de connexion
        setShowHome(false)
        setShowAuth(true)
        setAuthInitialMode('login')
      }}
    />
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
    { id: 'groupsleaderboard', label: t('tabs.groupsLeaderboard'), icon: Trophy },
    { id: 'kop', label: t('tabs.kop'), icon: MessageSquare, badge: 'NEW' },
    { id: 'groups', label: t('tabs.groups'), icon: Users },
    ...((isLeader || (hasGroup && !isAdmin)) ? [{ id: 'mygroup', label: t('group.title'), icon: Users }] : []),
    { id: 'news', label: t('tabs.news'), icon: Newspaper },
    { id: 'info', label: t('tabs.info'), icon: BookOpen },
    { id: 'faq', label: t('tabs.faq'), icon: HelpCircle },
    ...(user ? [{ id: 'profile', label: t('profile.title'), icon: User }] : []),
    ...(isAdmin ? [{ id: 'admin', label: t('tabs.admin'), icon: Settings }] : []),
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
      {/* Bandeau upgrade serveur (auto-expire 7j, dismissable, caché aux supporters) */}
      <ServerUpgradeBanner
        onGoToSupport={config.donations?.enabled ? () => setActiveTab('support') : null}
        isSupporter={isSupporter}
      />

      {/* Bandeau visiteur */}
      {isGuest && (
        <div className="bg-gradient-to-r from-sport-500/20 to-sport-600/20 border-b border-sport-400/30 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm text-sport-200 flex items-center gap-2">
              <Zap className="w-4 h-4" /> {t('auth.guestBanner')}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBackToHome}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                title={t('auth.backToHome')}>
                🏠 <span className="hidden sm:inline">{t('auth.backToHome')}</span>
              </button>
              <button onClick={() => setShowAuth(true)} className="px-3 py-1 bg-cta-500 hover:bg-cta-600 rounded-lg text-sm font-bold flex items-center gap-1.5">
                <LogIn className="w-3.5 h-3.5" /> {t('auth.guestLogin')}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-white/10 backdrop-blur-xl bg-black/20 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Trophy className="w-7 h-7 text-orange-400 shrink-0" />
            <div className="font-black text-xl bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent truncate">United Pronos</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LangSwitch />
            <button
              onClick={() => {
                // Si utilisateur connecté → ouvre la chat-box interne
                // Sinon → ouvre le formulaire de contact classique (email)
                if (user) {
                  window.dispatchEvent(new CustomEvent('open-chatbox'))
                } else {
                  setShowContact(true)
                }
              }}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-semibold flex items-center gap-1.5"
              title={user ? 'Discuter avec le support' : t('contact.title')}>
              {user ? '💬' : '✉️'} <span className="hidden sm:inline">{t('contact.menuItem')}</span>
            </button>
            {config.donations?.enabled && (
              <button
                onClick={() => setActiveTab('support')}
                className={`relative px-2.5 py-1.5 bg-gradient-to-r from-sport-500/15 to-sport-600/15 hover:from-sport-500/25 hover:to-sport-600/25 border border-cta-400/30 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition group ${
                  user && !isSupporter ? 'btn-support-pulse' : ''
                }`}
                title={t('support.headerTooltip')}>
                <span className="text-base group-hover:scale-110 transition-transform">❤️</span>
                <span className="hidden sm:inline">{t('support.headerButton')}</span>
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
                className="px-3 py-1.5 bg-cta-500 hover:bg-cta-600 rounded-lg text-sm font-bold flex items-center gap-1.5">
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
                className={`px-4 py-3 flex items-center gap-2 text-sm font-semibold whitespace-nowrap border-b-2 transition relative ${
                  activeTab === tab.id ? 'border-sport-400 text-sport-400' : 'border-transparent text-white/60 hover:text-white'
                }`}>
                <Icon className="w-4 h-4" /> {tab.label}
                {tab.badge === 'NEW' && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-cta-500/30 text-cta-200 border border-cta-400/40 rounded-full font-bold leading-none">
                    NEW
                  </span>
                )}
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
        {activeTab === 'leaderboard' && <LeaderboardTab leaderboard={leaderboard} currentUserId={user?.id} isAdmin={isAdmin} />}
        {activeTab === 'groupsleaderboard' && <GroupsLeaderboardTab user={user} currentGroupId={user?.group_id} />}
        {activeTab === 'kop' && <KopUnitedTab user={user} isGuest={isGuest} onLoginPrompt={() => setShowAuth(true)} />}
        {activeTab === 'support' && <SupportPage user={user} onClose={(nextTab) => nextTab === 'credits' ? setActiveTab('credits') : setActiveTab('matches')} />}
        {activeTab === 'credits' && <SupportersWallPage />}
        {activeTab === 'groups' && <GroupsTab />}
        {activeTab === 'mygroup' && <GroupTab user={user} />}
        {activeTab === 'profile' && user && <ProfileTab currentUser={user} onUserUpdate={setUser} />}
        {activeTab === 'news' && <NewsTab news={news} onRefresh={handleRefreshNews} isAdmin={isAdmin} />}
        {activeTab === 'info' && <InfoTab />}
        {activeTab === 'faq' && <FAQTab />}
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
                    className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-sport-400/40 rounded-full text-white/70 hover:text-sport-300 transition">
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

      {/* Modal contextuel de don : déclenché après actions positives (100% pronos, etc.) */}
      {contextualDonation && (
        <ContextualDonationModal
          trigger={contextualDonation}
          onClose={() => setContextualDonation(null)}
          onGoToSupport={() => setActiveTab('support')}
        />
      )}

      {/* Chat-box flottante pour les utilisateurs connectés (résout le problème délivrabilité Outlook) */}
      <FloatingChatBox user={user} />
    </div>
  )
}
