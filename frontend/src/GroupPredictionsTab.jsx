/**
 * GroupPredictionsTab — Visualisation des pronostics du groupe
 *
 * Affiche les pronostics de tous les membres du groupe pour les matchs déjà commencés.
 *
 * RÈGLE FAIR-PLAY :
 * Le backend ne renvoie que les pronos des matchs dont le coup d'envoi est passé.
 * Avant le coup d'envoi, les pronos restent privés (impossible de copier les pronos
 * du leader/expert juste avant le verrouillage).
 *
 * 2 vues au choix :
 * - "Par match" : tableau matrice (lignes = matchs, colonnes = membres)
 * - "Par membre" : un membre sélectionné → liste de ses pronos
 *
 * Code couleur des pronos :
 * - Vert vif    : score exact (5 points)
 * - Vert clair  : bon vainqueur + bonne diff (3 points)
 * - Jaune       : bon vainqueur seulement (1 point)
 * - Gris        : 0 point ou match en cours (pas encore de score officiel)
 * - Bleu        : match pas encore terminé (status != finished)
 */
import React, { useState, useEffect, useRef } from 'react'
import { Trophy, Users, Calendar, RefreshCw, Crown, Heart } from 'lucide-react'
import { api } from './api'
import { Flag, teamName } from './teams.jsx'
import { useTranslation } from './i18n.jsx'

const POINTS_COLORS = {
  5: 'bg-emerald-500/30 border-emerald-400/50 text-emerald-100',   // exact
  3: 'bg-cta-500/25 border-cta-400/45 text-cta-100',                // bon vainqueur + diff
  1: 'bg-amber-500/25 border-amber-400/45 text-amber-100',          // bon vainqueur
  0: 'bg-white/5 border-white/10 text-white/60',                    // wrong
}

const NO_PRED_STYLE = 'bg-base-surface/30 border-dashed border-white/10 text-white/30'
const NOT_FINISHED_STYLE = 'bg-sport-500/15 border-sport-400/30 text-sport-100'

function PredictionCell({ pred, matchFinished }) {
  if (!pred) {
    return (
      <div className={`px-2 py-1 rounded border text-xs font-mono text-center min-w-[3.5rem] ${NO_PRED_STYLE}`}>
        —
      </div>
    )
  }
  // Si match pas encore terminé : on affiche le prono mais sans coloration de points
  if (!matchFinished) {
    return (
      <div className={`px-2 py-1 rounded border text-xs font-mono font-bold text-center min-w-[3.5rem] ${NOT_FINISHED_STYLE}`}>
        {pred.home_score}-{pred.away_score}
      </div>
    )
  }
  // Match terminé : on colore selon les points
  const styleClass = POINTS_COLORS[pred.points] ?? POINTS_COLORS[0]
  return (
    <div className={`px-2 py-1 rounded border text-xs font-mono font-bold text-center min-w-[3.5rem] ${styleClass}`}
      title={`${pred.points} pts`}>
      {pred.home_score}-{pred.away_score}
      <div className="text-[9px] opacity-70 leading-none mt-0.5">{pred.points}pt</div>
    </div>
  )
}

export default function GroupPredictionsTab({ groupId, currentUserId }) {
  const { t, lang } = useTranslation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('byMatch')  // 'byMatch' | 'byMember'
  const [selectedMemberId, setSelectedMemberId] = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await api.groupPredictions(groupId)
      setData(res)
      // Sélectionne le membre courant par défaut en vue "Par membre"
      if (res?.members?.length && !selectedMemberId) {
        const me = res.members.find(m => m.id === currentUserId)
        setSelectedMemberId(me ? me.id : res.members[0].id)
      }
    } catch (e) {
      setError(e.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (groupId) load() }, [groupId])

  if (!groupId) return null
  if (loading) {
    return <div className="text-center py-8 text-white/40">{t('groupPredictions.loading')}</div>
  }
  if (error) {
    return (
      <div className="text-center py-8 text-red-300">
        {error}
        <div className="mt-3">
          <button onClick={load} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm">
            <RefreshCw className="w-4 h-4 inline mr-1" /> {t('common.retry') || 'Réessayer'}
          </button>
        </div>
      </div>
    )
  }
  if (!data || !data.members?.length) return null

  const { members, matches, predictions } = data

  // Vue vide si aucun match commencé
  if (matches.length === 0) {
    return (
      <div className="bg-sport-500/10 border border-sport-400/30 rounded-xl p-6 text-center">
        <Calendar className="w-10 h-10 mx-auto mb-3 text-sport-300/60" />
        <p className="font-semibold text-white/80 mb-1">{t('groupPredictions.noMatchYet')}</p>
        <p className="text-sm text-white/50">{t('groupPredictions.noMatchYetHint')}</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header avec switch de vue + refresh */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
          <button
            onClick={() => setViewMode('byMatch')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'byMatch' ? 'bg-cta-500/30 text-cta-100' : 'text-white/60 hover:text-white'
            }`}>
            <Trophy className="w-4 h-4" /> {t('groupPredictions.byMatch')}
          </button>
          <button
            onClick={() => setViewMode('byMember')}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'byMember' ? 'bg-cta-500/30 text-cta-100' : 'text-white/60 hover:text-white'
            }`}>
            <Users className="w-4 h-4" /> {t('groupPredictions.byMember')}
          </button>
        </div>
        <button onClick={load}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm flex items-center gap-2"
          title={t('groupPredictions.refresh')}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Note fair-play */}
      <div className="mb-4 p-3 bg-amber-500/10 border border-amber-400/30 rounded-lg text-xs text-amber-200/80 flex items-start gap-2">
        <span className="text-base shrink-0">🤝</span>
        <span>{t('groupPredictions.fairPlayNote')}</span>
      </div>

      {viewMode === 'byMatch' ? (
        <ByMatchView members={members} matches={matches} predictions={predictions}
          currentUserId={currentUserId} t={t} lang={lang} />
      ) : (
        <ByMemberView members={members} matches={matches} predictions={predictions}
          selectedMemberId={selectedMemberId} onSelectMember={setSelectedMemberId}
          currentUserId={currentUserId} t={t} lang={lang} />
      )}

      {/* Légende des couleurs */}
      <div className="mt-6 p-3 bg-white/5 border border-white/10 rounded-lg">
        <div className="text-xs font-semibold text-white/60 mb-2">{t('groupPredictions.legend')}</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`px-2 py-1 rounded border ${POINTS_COLORS[5]}`}>5pt · {t('groupPredictions.exact')}</span>
          <span className={`px-2 py-1 rounded border ${POINTS_COLORS[3]}`}>3pt · {t('groupPredictions.diff')}</span>
          <span className={`px-2 py-1 rounded border ${POINTS_COLORS[1]}`}>1pt · {t('groupPredictions.winner')}</span>
          <span className={`px-2 py-1 rounded border ${POINTS_COLORS[0]}`}>0pt</span>
          <span className={`px-2 py-1 rounded border ${NOT_FINISHED_STYLE}`}>{t('groupPredictions.inProgress')}</span>
          <span className={`px-2 py-1 rounded border ${NO_PRED_STYLE}`}>— {t('groupPredictions.noPred')}</span>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// DOUBLE SCROLL WRAPPER — barre de defilement EN HAUT + EN BAS, synchronisees
// 
// Pourquoi ? Quand un tableau a beaucoup de colonnes (ex: groupe avec 20 membres),
// la scrollbar du navigateur est uniquement en bas. Sur un grand ecran PC, c'est
// PEU PRATIQUE car il faut scroller tout en bas pour voir la barre.
//
// Solution : on duplique la barre en haut. Le scroll des 2 barres est synchronise
// (event listeners 'scroll' reciproques avec garde anti-boucle).
//
// La barre du HAUT est rendue plus VISIBLE (plus haute, couleur claire) pour
// suggerer clairement qu'on peut scroller horizontalement.
// =====================================================
function DoubleScrollWrapper({ children, className = '' }) {
  const topScrollRef = useRef(null)
  const contentScrollRef = useRef(null)
  const [contentWidth, setContentWidth] = useState(0)

  // Mesure la largeur du contenu (pour dimensionner le faux contenu de la barre du haut)
  useEffect(() => {
    if (!contentScrollRef.current) return
    const measure = () => {
      if (contentScrollRef.current) {
        // scrollWidth = largeur totale du contenu (incluant la partie cachee)
        setContentWidth(contentScrollRef.current.scrollWidth)
      }
    }
    measure()
    // Re-mesurer si la fenetre change de taille ou si le contenu change
    const ro = new ResizeObserver(measure)
    ro.observe(contentScrollRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [children])

  // Synchroniser scroll : barre du haut --> contenu
  const isSyncing = useRef(false)
  const onTopScroll = () => {
    if (isSyncing.current || !contentScrollRef.current) return
    isSyncing.current = true
    contentScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
    // Reset le flag au prochain frame (apres que l'event 'scroll' contenu se soit propage)
    requestAnimationFrame(() => { isSyncing.current = false })
  }
  const onContentScroll = () => {
    if (isSyncing.current || !topScrollRef.current) return
    isSyncing.current = true
    topScrollRef.current.scrollLeft = contentScrollRef.current.scrollLeft
    requestAnimationFrame(() => { isSyncing.current = false })
  }

  return (
    <div className={className}>
      {/* BARRE DU HAUT : faux contenu de meme largeur que le vrai pour generer la scrollbar */}
      <div
        ref={topScrollRef}
        onScroll={onTopScroll}
        className="overflow-x-auto overflow-y-hidden double-scroll-top"
        style={{ height: '14px' }}
      >
        <div style={{ width: contentWidth, height: '1px' }} />
      </div>

      {/* CONTENU REEL */}
      <div
        ref={contentScrollRef}
        onScroll={onContentScroll}
        className="overflow-x-auto"
      >
        {children}
      </div>
    </div>
  )
}


// =====================================================
// VUE PAR MATCH — tableau matrice (lignes = matchs, colonnes = membres)
// =====================================================
function ByMatchView({ members, matches, predictions, currentUserId, t, lang }) {
  return (
    <DoubleScrollWrapper className="border border-white/10 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-white/5">
          <tr>
            <th className="p-2 text-left font-semibold text-white/70 sticky left-0 bg-base-deep z-10 min-w-[180px]">
              {t('groupPredictions.matchCol')}
            </th>
            {members.map(m => (
              <th key={m.id} className={`p-2 text-center font-semibold text-xs ${
                m.id === currentUserId ? 'bg-cta-500/20' : ''
              }`}>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="truncate max-w-[80px]" title={m.username}>{m.username}</span>
                  <div className="flex items-center gap-0.5 text-[10px]">
                    {m.is_leader && <Crown className="w-3 h-3 text-amber-400" />}
                    <span className="text-white/50">{m.total_points}pt</span>
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matches.map(match => {
            const isFinished = match.status === 'finished'
            const matchPreds = predictions[String(match.id)] || {}
            return (
              <tr key={match.id} className="border-t border-white/5">
                <td className="p-2 sticky left-0 bg-base-deep/95 z-10 min-w-[180px]">
                  <div className="flex items-center gap-1.5">
                    <Flag code={match.home_team} size={20} />
                    <span className="text-white/70 text-xs font-medium">vs</span>
                    <Flag code={match.away_team} size={20} />
                  </div>
                  <div className="text-[10px] text-white/40 mt-0.5">
                    {isFinished
                      ? <span className="text-cta-300 font-bold">{match.home_score}-{match.away_score}</span>
                      : <span className="text-sport-300">{t('groupPredictions.notFinished')}</span>
                    }
                  </div>
                </td>
                {members.map(m => (
                  <td key={m.id} className={`p-1.5 ${m.id === currentUserId ? 'bg-cta-500/5' : ''}`}>
                    <PredictionCell pred={matchPreds[String(m.id)]} matchFinished={isFinished} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </DoubleScrollWrapper>
  )
}

// =====================================================
// VUE PAR MEMBRE — sélecteur membre + liste de ses pronos
// =====================================================
function ByMemberView({ members, matches, predictions, selectedMemberId, onSelectMember, currentUserId, t, lang }) {
  const selected = members.find(m => m.id === selectedMemberId) || members[0]
  if (!selected) return null

  return (
    <div>
      {/* Sélecteur de membre (chips horizontaux) */}
      <div className="flex flex-wrap gap-2 mb-4">
        {members.map(m => (
          <button key={m.id}
            onClick={() => onSelectMember(m.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-1.5 ${
              m.id === selected.id
                ? 'bg-cta-500 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}>
            {m.id === currentUserId && <span className="text-[10px]">👤</span>}
            {m.is_leader && <Crown className="w-3.5 h-3.5" />}
            {m.username}
            <span className="text-[10px] opacity-70">{m.total_points}pt</span>
          </button>
        ))}
      </div>

      {/* Liste des pronos du membre sélectionné */}
      <div className="space-y-2">
        {matches.map(match => {
          const isFinished = match.status === 'finished'
          const matchPreds = predictions[String(match.id)] || {}
          const pred = matchPreds[String(selected.id)]
          return (
            <div key={match.id}
              className="flex items-center justify-between gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
              {/* Match */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Flag code={match.home_team} size={24} />
                  <span className="text-white/70 text-xs">vs</span>
                  <Flag code={match.away_team} size={24} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-white/80 truncate">
                    {teamName(match.home_team, lang)} - {teamName(match.away_team, lang)}
                  </span>
                  {isFinished ? (
                    <span className="text-xs font-bold text-cta-300">
                      {match.home_score} - {match.away_score} <span className="font-normal text-white/40">({t('groupPredictions.finalScore')})</span>
                    </span>
                  ) : (
                    <span className="text-xs text-sport-300">{t('groupPredictions.notFinished')}</span>
                  )}
                </div>
              </div>
              {/* Prono */}
              <PredictionCell pred={pred} matchFinished={isFinished} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
