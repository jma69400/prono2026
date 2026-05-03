import { useState, useEffect, useMemo } from 'react'
import { Trophy, Calendar, Users, Newspaper, Settings, LogOut, Sparkles, RefreshCw, Trash2, Lock, AlertCircle, Check, LogIn, ChevronDown, ChevronUp, TrendingUp, Target, Zap } from 'lucide-react'
import { api, getToken, setToken } from './api'
import { TEAMS, GROUPS, HOST_COUNTRIES, teamName, Flag } from './teams.jsx'
import { useTranslation } from './i18n.jsx'
import { predictMatch, getMatchOdds } from './predictor.js'

// =====================================================
// LANG SWITCH (FR / EN / ES)
// =====================================================
function LangSwitch() {
  const { lang, setLang } = useTranslation()
  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
      {['fr', 'en', 'es'].map(code => (
        <button key={code}
          onClick={() => setLang(code)}
          className={`px-2 py-1 text-xs font-semibold rounded transition ${lang === code ? 'bg-orange-500 text-white' : 'text-white/60 hover:text-white'}`}
        >{code.toUpperCase()}</button>
      ))}
    </div>
  )
}

// =====================================================
// AUTH SCREEN
// =====================================================
function AuthScreen({ onLogin, onGuest, initialMode = 'login' }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const fillDemo = (which) => {
    if (which === 'admin') { setEmail('admin@prono26.com'); setPassword('admin123') }
    else { setEmail('demo@prono26.com'); setPassword('demo123') }
    setMode('login')
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const fn = mode === 'login' ? api.login : api.signup
      const data = mode === 'login' ? { email, password } : { email, username, password }
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
            <h1 className="text-5xl font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">PRONO 2026</h1>
          </div>
          <p className="text-white/60">{t('auth.subtitle')}</p>
        </div>

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

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-white/40 text-sm text-center mb-3">{t('auth.demoAccounts')}</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => fillDemo('admin')} className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm">
                👑 {t('auth.adminAccount')}
              </button>
              <button onClick={() => fillDemo('demo')} className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm">
                👤 {t('auth.userAccount')}
              </button>
            </div>
          </div>

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
        <span className="flex items-center gap-2"><Calendar className="w-3 h-3" /> {dateLabel}</span>
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
          {odds && !locked && <div className="text-xs text-orange-300 mt-1 font-mono">@{odds.home}</div>}
        </div>

        <div className="text-center min-w-[120px]">
          {locked ? (
            <div className="text-3xl font-black text-orange-400">{match.home_score} - {match.away_score}</div>
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
          className={`flex items-center gap-4 p-4 rounded-xl border transition ${
            entry.id === currentUserId ? 'bg-orange-500/10 border-orange-400/40' : 'bg-white/5 border-white/10'
          }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${
            i === 0 ? 'bg-yellow-400/20 text-yellow-300' :
            i === 1 ? 'bg-gray-300/20 text-gray-200' :
            i === 2 ? 'bg-orange-700/30 text-orange-400' : 'bg-white/5 text-white/60'
          }`}>{i + 1}</div>
          <div className="flex-1">
            <div className="font-bold">{entry.username}</div>
            <div className="text-xs text-white/40">
              {entry.predictions_count} {entry.predictions_count > 1 ? t('leaderboard.predictions_plural') : t('leaderboard.predictions')}
            </div>
          </div>
          <div className="text-2xl font-black text-orange-400">
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

  const filtered = news.filter(n => !teamFilter || n.team === teamFilter)
  const availableTeams = [...new Set(news.map(n => n.team).filter(Boolean))].slice(0, 12)

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
          <button onClick={onRefresh} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> {t('news.refresh')}
          </button>
        )}
      </div>

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
// ADMIN TAB
// =====================================================
function AdminTab({ user }) {
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [tab, setTab] = useState('users')

  useEffect(() => {
    api.adminUsers().then(setUsers).catch(() => {})
    api.adminAuditLog().then(setAuditLog).catch(() => {})
  }, [])

  const deleteUser = async (id) => {
    if (!confirm(t('admin.deleteConfirm'))) return
    await api.adminDeleteUser(id)
    setUsers(await api.adminUsers())
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('users')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'users' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
          {t('admin.users')} ({users.length})
        </button>
        <button onClick={() => setTab('contact')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'contact' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
          ✉️ {t('contact.adminTitle')}
        </button>
        <button onClick={() => setTab('audit')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === 'audit' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60'}`}>
          {t('admin.audit')}
        </button>
      </div>

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
              <span className={`text-xs px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-white/60'}`}>
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
  const { t } = useTranslation()

  const features = [
    { icon: Calendar, title: t('home.feature1Title'), desc: t('home.feature1Desc'), color: 'orange' },
    { icon: Sparkles, title: t('home.feature2Title'), desc: t('home.feature2Desc'), color: 'purple' },
    { icon: Trophy, title: t('home.feature3Title'), desc: t('home.feature3Desc'), color: 'yellow' },
    { icon: Newspaper, title: t('home.feature4Title'), desc: t('home.feature4Desc'), color: 'blue' },
  ]

  const colorClass = (c) => ({
    orange: 'from-orange-500/10 to-orange-700/10 border-orange-400/20 text-orange-300',
    purple: 'from-purple-500/10 to-purple-700/10 border-purple-400/20 text-purple-300',
    yellow: 'from-yellow-500/10 to-yellow-700/10 border-yellow-400/20 text-yellow-300',
    blue: 'from-blue-500/10 to-blue-700/10 border-blue-400/20 text-blue-300',
  }[c] || '')

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
      {/* Top nav */}
      <header className="border-b border-white/10 backdrop-blur bg-black/20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Trophy className="w-7 h-7 text-orange-400" />
            <h1 className="font-black text-xl bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">PRONO 2026</h1>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}} className="flex items-center gap-2">
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
        <div className="relative max-w-5xl mx-auto px-4 py-20 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-orange-500/10 border border-orange-400/20 rounded-full text-sm text-orange-200">
            <Zap className="w-4 h-4" /> 11 juin – 19 juillet 2026 · USA · Canada · Mexique
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black mb-6 leading-tight">
            <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-orange-400 bg-clip-text text-transparent">
              {t('home.heroTitle')}
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10">
            {t('home.heroSubtitle')}
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

      {/* STATS */}
      <section className="py-12 border-y border-white/10 bg-black/20">
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

      {/* FEATURES */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <div key={i} className={`bg-gradient-to-br ${colorClass(f.color)} border rounded-2xl p-6`}>
              <f.icon className="w-10 h-10 mb-4" />
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 border-t border-white/10 bg-black/20">
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

          {/* Scoring */}
          <div className="mt-12 bg-white/5 border border-white/10 rounded-2xl p-6">
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
      <section className="py-20 border-t border-white/10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-6 text-orange-400" />
          <h2 className="text-3xl sm:text-4xl font-black mb-4">{t('home.finalCta')}</h2>
          <button onClick={onSignup}
            className="mt-6 px-10 py-5 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 rounded-xl font-bold text-lg shadow-lg shadow-orange-500/20 transition inline-flex items-center gap-2">
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
                  <a href={`mailto:${m.email}?subject=Re: ${m.subject || 'PRONO 2026'}`}
                     className="text-sm text-orange-300 hover:text-orange-200">
                    {m.email}
                  </a>
                </div>
                <span className="text-xs text-white/40">{m.created_at}</span>
              </div>
              {m.subject && <div className="text-sm font-semibold text-white/80 mb-1">{m.subject}</div>}
              <p className="text-sm text-white/70 whitespace-pre-wrap mb-3">{m.message}</p>
              <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-white/5">
                <a href={`mailto:${m.email}?subject=Re: ${m.subject || 'PRONO 2026'}`}
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

  // Init : vérifier token + charger config publique
  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setConfig).catch(() => {})

    if (getToken()) {
      api.me().then(u => { setUser(u); setIsGuest(false); setShowHome(false) })
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

  const onLogin = (u) => { setUser(u); setIsGuest(false); setShowAuth(false); setShowHome(false) }
  const logout = () => { setToken(null); setUser(null); setIsGuest(false); setShowHome(true) }
  const onGuestPrompt = () => setShowGuestPrompt(true)
  const goToAuth = () => { setShowGuestPrompt(false); setShowAuth(true); setShowHome(false) }
  const backToGuest = () => { setShowAuth(false); if (!user) setShowHome(true) }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white/60">{t('common.loading')}</div>

  // 1. HomePage par défaut (premier visit)
  if (showHome && !user) {
    return <HomePage onSignup={handleSignup} onLogin={handleLogin} onContinueAsGuest={handleGuest} onContact={() => setShowContact(true)} />
  }

  // 2. Écran d'auth si demandé
  if (showAuth) return <AuthScreen onLogin={onLogin} onGuest={backToGuest} initialMode={authInitialMode} />

  const isAdmin = user?.role === 'admin'

  const tabs = [
    { id: 'matches', label: t('tabs.matches'), icon: Calendar },
    { id: 'leaderboard', label: t('tabs.leaderboard'), icon: Trophy },
    { id: 'groups', label: t('tabs.groups'), icon: Users },
    { id: 'news', label: t('tabs.news'), icon: Newspaper },
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
            <h1 className="font-black text-xl bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent truncate">PRONO 2026</h1>
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
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
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
        {activeTab === 'news' && <NewsTab news={news} onRefresh={handleRefreshNews} isAdmin={isAdmin} />}
        {activeTab === 'admin' && isAdmin && <AdminTab user={user} />}
      </main>

      <footer className="border-t border-white/10 mt-12 py-6 text-center text-xs text-white/30">
        {t('common.footer')}
      </footer>

      {showGuestPrompt && <GuestPrompt onClose={() => setShowGuestPrompt(false)} onSignin={goToAuth} />}
      {showDonate && config.donations?.enabled && <DonateModal onClose={() => setShowDonate(false)} links={config.donations} />}
      {showContact && <ContactModal onClose={() => setShowContact(false)} currentUser={user} turnstileSiteKey={config.turnstile?.site_key} />}
    </div>
  )
}
