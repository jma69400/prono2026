/**
 * United Pronos — Pronos Avancés + Stats Personnelles
 * =====================================================
 * Deux composants exportés :
 *
 *   1. <AdvancedPredictionPanel match={match} locked={bool} onSave={fn} />
 *      → Bloc à insérer dans MatchCard, sous le prono classique
 *
 *   2. <PersonalStatsTab userId={id} />
 *      → Onglet complet "Mes Stats" à ajouter dans la navigation
 *
 * Dépendances : React, lucide-react (déjà dans le projet)
 * Style : Tailwind (déjà dans le projet) + variables CSS existantes
 */

import { useState, useEffect } from 'react'
import { Target, TrendingUp, Zap, ChevronDown, ChevronUp, Check, Info } from 'lucide-react'
import { useTranslation } from './i18n.jsx'
import { Flag, teamName } from './teams.jsx'
import { api } from './api'

// =============================================
// CONSTANTES POINTS
// =============================================
const POINTS = {
  scorer: 3,
  overUnder: 2,
  btts: 2,
}

// =============================================
// COMPOSANT : PANEL PRONOS AVANCÉS (dans MatchCard)
// =============================================
export function AdvancedPredictionPanel({ match, locked, isGuest, onGuestPrompt }) {
  const { lang } = useTranslation()
  const [open, setOpen] = useState(false)
  const [scorerTeam, setScorerTeam] = useState('')
  const [overUnder, setOverUnder] = useState('')
  const [btts, setBtts] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState(null)
  const [loading, setLoading] = useState(false)

  // Charge le prono avancé existant au montage
  useEffect(() => {
    if (isGuest || !match?.id) return
    setLoading(true)
    api.getAdvancedPrediction(match.id)
      .then(data => {
        if (data?.prediction) {
          const p = data.prediction
          setScorerTeam(p.scorer_team || '')
          setOverUnder(p.over_under || '')
          setBtts(p.btts || '')
          setExisting(p)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [match?.id, isGuest])

  const handleSave = async () => {
    if (isGuest) { onGuestPrompt?.(); return }
    if (saving) return
    setSaving(true)
    try {
      await api.saveAdvancedPrediction({
        match_id: match.id,
        scorer_team: scorerTeam || null,
        over_under: overUnder || null,
        btts: btts || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      console.error('AdvancedPred save error:', e)
    } finally {
      setSaving(false)
    }
  }

  const hasAny = scorerTeam || overUnder || btts
  const isComplete = scorerTeam && overUnder && btts
  const maxBonus = POINTS.scorer + POINTS.overUnder + POINTS.btts

  // Points potentiels affichés dynamiquement
  const potentialPts = (scorerTeam ? POINTS.scorer : 0)
    + (overUnder ? POINTS.overUnder : 0)
    + (btts ? POINTS.btts : 0)

  return (
    <div className="mt-3">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-semibold transition ${
          existing && hasAny
            ? 'bg-purple-500/10 border-purple-400/40 text-purple-200'
            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
        }`}
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span>Pronos avancés</span>
          {existing && hasAny && (
            <span className="px-1.5 py-0.5 bg-purple-500/30 text-purple-200 rounded text-[10px] font-bold">
              Enregistrés
            </span>
          )}
          <span className="text-[10px] text-white/40 font-normal">
            +{maxBonus} pts bonus max
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Panel dépliable */}
      {open && (
        <div className="mt-2 p-4 bg-gradient-to-br from-purple-500/8 to-indigo-500/5 border border-purple-400/20 rounded-xl space-y-4">

          {/* Info points */}
          <div className="flex items-center gap-2 text-xs text-white/50 bg-white/5 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 shrink-0 text-yellow-400" />
            <span>Ces pronos sont <strong className="text-white/80">cumulatifs</strong> avec ton prono classique. Jusqu'à <strong className="text-yellow-300">+{maxBonus} pts bonus</strong> par match.</span>
          </div>

          {locked ? (
            /* Mode lecture seule après verrouillage */
            existing ? (
              <div className="space-y-2">
                <div className="text-xs text-white/50 font-semibold uppercase tracking-wide mb-2">Tes pronos avancés</div>
                {existing.scorer_team && (
                  <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <Flag code={existing.scorer_team} size={20} />
                      <span>Équipe buteuse</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{teamName(existing.scorer_team, lang)}</span>
                      {existing.points_scorer > 0 && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs font-bold">
                          +{existing.points_scorer} pts ✓
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {existing.over_under && (
                  <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-lg text-sm">
                    <span>Over/Under 2.5</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold px-2 py-0.5 rounded ${existing.over_under === 'over' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {existing.over_under === 'over' ? 'Over +2.5 buts' : 'Under -2.5 buts'}
                      </span>
                      {existing.points_over_under > 0 && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs font-bold">
                          +{existing.points_over_under} pts ✓
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {existing.btts && (
                  <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-lg text-sm">
                    <span>Les 2 équipes marquent</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold px-2 py-0.5 rounded ${existing.btts === 'yes' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {existing.btts === 'yes' ? 'Oui' : 'Non'}
                      </span>
                      {existing.points_btts > 0 && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs font-bold">
                          +{existing.points_btts} pts ✓
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {existing.points_total > 0 && (
                  <div className="mt-2 p-2 bg-green-500/10 border border-green-400/30 rounded-lg text-center text-sm font-bold text-green-300">
                    🎉 +{existing.points_total} pts bonus gagnés !
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-white/40 text-sm">
                Aucun prono avancé saisi pour ce match
              </div>
            )
          ) : (
            /* Mode saisie */
            <>
              {/* 1. Équipe buteuse */}
              <div>
                <label className="block text-xs font-bold text-white/70 mb-2 uppercase tracking-wide">
                  ⚽ Équipe qui marque — <span className="text-yellow-300 normal-case">+{POINTS.scorer} pts</span>
                </label>
                <div className="flex gap-2">
                  {[match.home_team, match.away_team].map(team => (
                    <button
                      key={team}
                      onClick={() => setScorerTeam(scorerTeam === team ? '' : team)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-sm font-semibold transition ${
                        scorerTeam === team
                          ? 'bg-yellow-500/20 border-yellow-400/60 text-yellow-200'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/70'
                      }`}
                    >
                      <Flag code={team} size={20} />
                      <span className="hidden sm:inline">{teamName(team, lang)}</span>
                      <span className="sm:hidden font-mono text-xs">{team}</span>
                      {scorerTeam === team && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Over / Under */}
              <div>
                <label className="block text-xs font-bold text-white/70 mb-2 uppercase tracking-wide">
                  🎯 Nombre de buts — <span className="text-yellow-300 normal-case">+{POINTS.overUnder} pts</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOverUnder(overUnder === 'over' ? '' : 'over')}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition ${
                      overUnder === 'over'
                        ? 'bg-green-500/20 border-green-400/60 text-green-200'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    📈 Over +2.5 buts
                    {overUnder === 'over' && <Check className="w-3.5 h-3.5 inline ml-1" />}
                  </button>
                  <button
                    onClick={() => setOverUnder(overUnder === 'under' ? '' : 'under')}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition ${
                      overUnder === 'under'
                        ? 'bg-red-500/20 border-red-400/60 text-red-200'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    📉 Under -2.5 buts
                    {overUnder === 'under' && <Check className="w-3.5 h-3.5 inline ml-1" />}
                  </button>
                </div>
              </div>

              {/* 3. BTTS */}
              <div>
                <label className="block text-xs font-bold text-white/70 mb-2 uppercase tracking-wide">
                  🥅 Les 2 équipes marquent — <span className="text-yellow-300 normal-case">+{POINTS.btts} pts</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBtts(btts === 'yes' ? '' : 'yes')}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition ${
                      btts === 'yes'
                        ? 'bg-green-500/20 border-green-400/60 text-green-200'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    ✅ Oui, les 2 marquent
                    {btts === 'yes' && <Check className="w-3.5 h-3.5 inline ml-1" />}
                  </button>
                  <button
                    onClick={() => setBtts(btts === 'no' ? '' : 'no')}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition ${
                      btts === 'no'
                        ? 'bg-red-500/20 border-red-400/60 text-red-200'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/70'
                    }`}
                  >
                    ❌ Non, clean sheet
                    {btts === 'no' && <Check className="w-3.5 h-3.5 inline ml-1" />}
                  </button>
                </div>
              </div>

              {/* Footer : points potentiels + bouton save */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-sm">
                  {potentialPts > 0 ? (
                    <span className="text-yellow-300 font-bold">
                      ⚡ +{potentialPts} pts bonus si tout correct
                    </span>
                  ) : (
                    <span className="text-white/40 text-xs">Sélectionne au moins un prono</span>
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasAny}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                    saved
                      ? 'bg-green-500 text-white'
                      : 'bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-30'
                  }`}
                >
                  {saving ? '...' : saved ? '✓ Sauvegardé' : 'Sauvegarder'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}


// =============================================
// COMPOSANT : STATS PERSONNELLES (onglet complet)
// =============================================
export function PersonalStatsTab({ currentUser }) {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const [advStats, setAdvStats] = useState(null)
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    Promise.all([
      api.myPredictions(),
      api.getMyAdvancedStats(),
    ]).then(([preds, adv]) => {
      setPredictions(preds || [])
      setAdvStats(adv)

      // Calcul stats classiques
      const finished = preds.filter(p => p.points !== null && p.points !== undefined)
      const exact = finished.filter(p => p.points >= 15)
      const winner = finished.filter(p => p.points >= 5 && p.points < 15)
      const wrong = finished.filter(p => p.points === 0)
      const total_pts = finished.reduce((acc, p) => acc + (p.points || 0), 0)

      setStats({
        total_played: finished.length,
        total_pending: preds.filter(p => p.points === null || p.points === undefined).length,
        exact_scores: exact.length,
        good_winner: winner.length,
        wrong: wrong.length,
        total_points: total_pts,
        exact_rate: finished.length > 0 ? Math.round((exact.length / finished.length) * 100) : 0,
        winner_rate: finished.length > 0 ? Math.round(((exact.length + winner.length) / finished.length) * 100) : 0,
        best_streak: computeBestStreak(finished),
      })
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [currentUser])

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-white/40">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-pulse">📊</div>
        <div>Calcul de tes stats...</div>
      </div>
    </div>
  )

  if (!stats) return null

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* HEADER */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-sport-500/10 border border-sport-400/20 rounded-full text-xs font-bold text-sport-300 uppercase tracking-wider mb-4">
          <TrendingUp className="w-3.5 h-3.5" /> Mes statistiques
        </div>
        <h2 className="text-2xl font-black mb-1">Tes performances</h2>
        <p className="text-white/50 text-sm">Coupe du Monde 2026 — mis à jour après chaque match</p>
      </div>

      {/* STATS CLASSIQUES */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="font-bold text-sm uppercase tracking-wide text-white/60 mb-4">🎯 Pronos classiques</h3>

        {/* Grandes métriques */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard
            value={stats.total_points}
            label="Points totaux"
            color="text-sport-300"
            bg="bg-sport-500/10 border-sport-400/20"
          />
          <StatCard
            value={`${stats.exact_rate}%`}
            label="Scores exacts"
            color="text-yellow-300"
            bg="bg-yellow-500/10 border-yellow-400/20"
          />
          <StatCard
            value={`${stats.winner_rate}%`}
            label="Bons résultats"
            color="text-green-300"
            bg="bg-green-500/10 border-green-400/20"
          />
          <StatCard
            value={stats.best_streak}
            label="Meilleure série"
            color="text-orange-300"
            bg="bg-orange-500/10 border-orange-400/20"
            suffix=" 🔥"
          />
        </div>

        {/* Répartition détaillée */}
        <div className="space-y-2">
          <div className="text-xs text-white/50 font-semibold uppercase tracking-wide mb-3">Répartition des pronos joués ({stats.total_played})</div>

          <ProgressBar
            label="⭐ Score exact"
            value={stats.exact_scores}
            total={stats.total_played}
            pts="+15 pts"
            color="bg-yellow-400"
          />
          <ProgressBar
            label="✅ Bon résultat + diff"
            value={stats.good_winner}
            total={stats.total_played}
            pts="+8 pts"
            color="bg-green-500"
          />
          <ProgressBar
            label="👍 Bon vainqueur"
            value={stats.total_played - stats.exact_scores - stats.good_winner - stats.wrong}
            total={stats.total_played}
            pts="+5 pts"
            color="bg-sport-400"
          />
          <ProgressBar
            label="❌ Mauvais pronostic"
            value={stats.wrong}
            total={stats.total_played}
            pts="0 pt"
            color="bg-red-500"
          />
        </div>

        {stats.total_pending > 0 && (
          <div className="mt-4 text-center text-xs text-white/40">
            ⏳ {stats.total_pending} pronostic{stats.total_pending > 1 ? 's' : ''} en attente de résultat
          </div>
        )}
      </div>

      {/* STATS AVANCÉES */}
      {advStats && advStats.total_played > 0 && (
        <div className="bg-gradient-to-br from-purple-500/8 to-indigo-500/5 border border-purple-400/20 rounded-2xl p-5">
          <h3 className="font-bold text-sm uppercase tracking-wide text-purple-300 mb-4">
            ⚡ Pronos avancés — {advStats.total_bonus_points} pts bonus gagnés
          </h3>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <AdvStatCard
              icon="⚽"
              label="Équipe buteuse"
              correct={advStats.scorer_correct}
              played={advStats.scorer_played}
              rate={advStats.scorer_rate}
              pts={POINTS.scorer}
            />
            <AdvStatCard
              icon="🎯"
              label="Over/Under"
              correct={advStats.ou_correct}
              played={advStats.ou_played}
              rate={advStats.ou_rate}
              pts={POINTS.overUnder}
            />
            <AdvStatCard
              icon="🥅"
              label="BTTS"
              correct={advStats.btts_correct}
              played={advStats.btts_played}
              rate={advStats.btts_rate}
              pts={POINTS.btts}
            />
          </div>

          <div className="text-center py-2 bg-purple-500/10 border border-purple-400/20 rounded-xl">
            <div className="text-2xl font-black text-purple-300">+{advStats.total_bonus_points}</div>
            <div className="text-xs text-white/50">points bonus cumulés</div>
          </div>
        </div>
      )}

      {/* TOTAL GÉNÉRAL */}
      {advStats && (
        <div className="bg-gradient-to-r from-sport-500/15 to-purple-500/15 border border-sport-400/30 rounded-2xl p-5 text-center">
          <div className="text-xs text-white/50 uppercase tracking-wide mb-2">🏆 Total général</div>
          <div className="text-4xl font-black text-sport-300 mb-1">
            {stats.total_points + (advStats.total_bonus_points || 0)}
          </div>
          <div className="text-sm text-white/60">
            {stats.total_points} pts classiques + {advStats.total_bonus_points || 0} pts bonus
          </div>
        </div>
      )}

    </div>
  )
}


// =============================================
// SOUS-COMPOSANTS
// =============================================

function StatCard({ value, label, color, bg, suffix = '' }) {
  return (
    <div className={`${bg} border rounded-xl p-3 text-center`}>
      <div className={`text-2xl font-black ${color}`}>{value}{suffix}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
    </div>
  )
}

function ProgressBar({ label, value, total, pts, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-36 shrink-0 text-white/70">{label}</div>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-8 text-right font-mono text-xs text-white/60">{value}</div>
      <div className="w-14 text-right text-xs text-white/40">{pts}</div>
    </div>
  )
}

function AdvStatCard({ icon, label, correct, played, rate, pts }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-lg font-black text-purple-300">{rate}%</div>
      <div className="text-xs text-white/50 mb-1">{label}</div>
      <div className="text-[10px] text-white/30">{correct}/{played} · +{pts} pts</div>
    </div>
  )
}


// =============================================
// UTILITAIRES
// =============================================

function computeBestStreak(predictions) {
  // Calcule la meilleure série de pronos "gagnants" consécutifs (points > 0)
  let best = 0, current = 0
  const sorted = [...predictions].sort((a, b) => a.match_id - b.match_id)
  for (const p of sorted) {
    if ((p.points || 0) > 0) {
      current++
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }
  return best
}


// =============================================
// APPELS API À AJOUTER DANS api.js
// =============================================
/*
  Dans ton fichier api.js, ajoute ces méthodes à l'objet `api` :

  saveAdvancedPrediction: (data) =>
    fetchWithAuth('/api/advanced-predictions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getAdvancedPrediction: (matchId) =>
    fetchWithAuth(`/api/advanced-predictions/${matchId}`),

  getMyAdvancedStats: () =>
    fetchWithAuth('/api/my-advanced-stats'),
*/
