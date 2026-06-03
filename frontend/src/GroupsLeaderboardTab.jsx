import { useState, useEffect } from 'react'
import { api } from './api'
import { useTranslation } from './i18n'

// =====================================================
// GROUPS LEADERBOARD TAB — Classement des groupes
// =====================================================
// Affiche le classement des groupes selon la formule équilibrée :
//   score = moyenne_par_membre × (1 + log10(nb_membres_actifs))
//
// Inclut une section "Comment ça marche ?" dépliable pour expliquer
// la formule aux utilisateurs (transparence = confiance).
// =====================================================

export function GroupsLeaderboardTab({ user, currentGroupId }) {
  const { t, lang } = useTranslation()
  const [data, setData] = useState({ groups: [], groups_count: 0, excluded_count: 0, formula: {} })
  const [loading, setLoading] = useState(true)
  const [showExplain, setShowExplain] = useState(false)

  const reload = async () => {
    setLoading(true)
    try {
      const r = await api.leaderboardGroups()
      setData(r)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  // Auto-refresh toutes les 60s (cohérent avec le classement groupe)
  useEffect(() => {
    const interval = setInterval(reload, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Textes localisés (clés dépendantes du contexte, mieux d'avoir un objet ici)
  const labels = {
    fr: {
      title: 'Classement des Groupes',
      subtitle: 'Performance collective de chaque ligue privée',
      explainTitle: 'Comment fonctionne le classement ?',
      explainShow: 'Voir la méthode de calcul',
      explainHide: 'Masquer la méthode',
      formulaTitle: '📐 Formule officielle',
      formula: 'Score = Moyenne par membre × (1 + log₁₀(membres actifs))',
      whyTitle: '🤔 Pourquoi cette formule ?',
      whyText: "Un simple total brut favoriserait les énormes groupes. Une simple moyenne pénaliserait les groupes très engagés. Notre formule récompense les deux : la performance individuelle ET la mobilisation collective.",
      examplesTitle: '📊 Exemples concrets',
      ex1: 'Petit groupe ultra-performant (5 membres × 200 pts en moy.) → 5 × (1 + log10(5)) = score 1500 pts',
      ex2: 'Groupe moyen équilibré (20 membres × 150 pts) → 20 × (1 + log10(20)) = score 3000 pts',
      ex3: 'Très gros groupe peu actif (100 membres × 60 pts) → 100 × (1 + log10(100)) = score 1800 pts',
      rulesTitle: '⚖️ Règles d\'éligibilité',
      rule1: 'Au moins 2 membres actifs (avec au moins 1 pronostic)',
      rule2: 'Mise à jour automatique toutes les minutes',
      rule3: 'Les groupes "fantômes" (1 membre ou moins) sont exclus du classement',
      yourGroup: 'TON GROUPE',
      members: 'membres',
      member: 'membre',
      activeMembers: 'actifs',
      avgPoints: 'moy.',
      totalPoints: 'total',
      score: 'Score',
      noGroups: 'Aucun groupe éligible pour le moment',
      excluded: (n) => `${n} groupe${n > 1 ? 's' : ''} exclu${n > 1 ? 's' : ''} (moins de 2 membres actifs)`,
    },
    en: {
      title: 'Groups Leaderboard',
      subtitle: 'Collective performance of each private league',
      explainTitle: 'How does the ranking work?',
      explainShow: 'View calculation method',
      explainHide: 'Hide method',
      formulaTitle: '📐 Official formula',
      formula: 'Score = Average per member × (1 + log₁₀(active members))',
      whyTitle: '🤔 Why this formula?',
      whyText: "A simple total would favor huge groups. A simple average would penalize very engaged ones. Our formula rewards both: individual performance AND collective mobilization.",
      examplesTitle: '📊 Concrete examples',
      ex1: 'Small high-performing group (5 members × 200 pts avg) → 5 × (1 + log10(5)) = 1500 pts',
      ex2: 'Medium balanced group (20 members × 150 pts) → 20 × (1 + log10(20)) = 3000 pts',
      ex3: 'Large inactive group (100 members × 60 pts) → 100 × (1 + log10(100)) = 1800 pts',
      rulesTitle: '⚖️ Eligibility rules',
      rule1: 'At least 2 active members (with at least 1 prediction)',
      rule2: 'Auto-refreshed every minute',
      rule3: '"Ghost" groups (1 or fewer members) are excluded',
      yourGroup: 'YOUR GROUP',
      members: 'members',
      member: 'member',
      activeMembers: 'active',
      avgPoints: 'avg',
      totalPoints: 'total',
      score: 'Score',
      noGroups: 'No eligible groups yet',
      excluded: (n) => `${n} group${n > 1 ? 's' : ''} excluded (less than 2 active members)`,
    },
    es: {
      title: 'Clasificación de Grupos',
      subtitle: 'Rendimiento colectivo de cada liga privada',
      explainTitle: '¿Cómo funciona la clasificación?',
      explainShow: 'Ver método de cálculo',
      explainHide: 'Ocultar método',
      formulaTitle: '📐 Fórmula oficial',
      formula: 'Puntuación = Promedio por miembro × (1 + log₁₀(miembros activos))',
      whyTitle: '🤔 ¿Por qué esta fórmula?',
      whyText: "Un simple total favorecería a los grupos enormes. Un simple promedio penalizaría a los muy comprometidos. Nuestra fórmula recompensa ambos: rendimiento individual Y movilización colectiva.",
      examplesTitle: '📊 Ejemplos concretos',
      ex1: 'Grupo pequeño de alto rendimiento (5 miembros × 200 pts prom) → 5 × (1 + log10(5)) = 1500 pts',
      ex2: 'Grupo mediano equilibrado (20 miembros × 150 pts) → 20 × (1 + log10(20)) = 3000 pts',
      ex3: 'Grupo grande inactivo (100 miembros × 60 pts) → 100 × (1 + log10(100)) = 1800 pts',
      rulesTitle: '⚖️ Reglas de elegibilidad',
      rule1: 'Al menos 2 miembros activos (con al menos 1 pronóstico)',
      rule2: 'Actualizado automáticamente cada minuto',
      rule3: 'Grupos "fantasma" (1 miembro o menos) están excluidos',
      yourGroup: 'TU GRUPO',
      members: 'miembros',
      member: 'miembro',
      activeMembers: 'activos',
      avgPoints: 'prom',
      totalPoints: 'total',
      score: 'Puntuación',
      noGroups: 'No hay grupos elegibles aún',
      excluded: (n) => `${n} grupo${n > 1 ? 's' : ''} excluido${n > 1 ? 's' : ''} (menos de 2 activos)`,
    },
  }
  const L = labels[lang] || labels.fr

  if (loading && data.groups.length === 0) {
    return (
      <div className="text-center py-12 text-white/40">
        <div className="text-4xl mb-3">⏳</div>
        Chargement...
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-5">
        <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent mb-1">
          🏆 {L.title}
        </h1>
        <p className="text-white/60 text-sm">{L.subtitle}</p>
      </div>

      {/* Bouton explication formule */}
      <button
        onClick={() => setShowExplain(!showExplain)}
        className="w-full mb-4 px-4 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/30 rounded-xl transition flex items-center justify-between text-sm group"
      >
        <span className="flex items-center gap-2 text-blue-200">
          <span className="text-xl">ℹ️</span>
          <span className="font-semibold">{L.explainTitle}</span>
        </span>
        <span className="text-blue-300 text-xs">
          {showExplain ? `▲ ${L.explainHide}` : `▼ ${L.explainShow}`}
        </span>
      </button>

      {/* Section explication (dépliable) */}
      {showExplain && (
        <div className="mb-5 p-5 bg-blue-500/5 border border-blue-400/20 rounded-xl space-y-4 text-sm">
          {/* Formule */}
          <div>
            <h3 className="font-bold text-blue-200 mb-2">{L.formulaTitle}</h3>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 font-mono text-center text-orange-200">
              {L.formula}
            </div>
          </div>

          {/* Pourquoi */}
          <div>
            <h3 className="font-bold text-blue-200 mb-2">{L.whyTitle}</h3>
            <p className="text-white/80 leading-relaxed">{L.whyText}</p>
          </div>

          {/* Exemples */}
          <div>
            <h3 className="font-bold text-blue-200 mb-2">{L.examplesTitle}</h3>
            <ul className="space-y-1.5 text-white/70 text-xs">
              <li className="flex gap-2"><span>•</span><span>{L.ex1}</span></li>
              <li className="flex gap-2"><span>•</span><span>{L.ex2}</span></li>
              <li className="flex gap-2"><span>•</span><span>{L.ex3}</span></li>
            </ul>
          </div>

          {/* Règles */}
          <div>
            <h3 className="font-bold text-blue-200 mb-2">{L.rulesTitle}</h3>
            <ul className="space-y-1.5 text-white/70 text-xs">
              <li className="flex gap-2"><span>•</span><span>{L.rule1}</span></li>
              <li className="flex gap-2"><span>•</span><span>{L.rule2}</span></li>
              <li className="flex gap-2"><span>•</span><span>{L.rule3}</span></li>
            </ul>
          </div>
        </div>
      )}

      {/* Compteurs */}
      {data.groups.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 mb-3 bg-white/5 border border-white/10 rounded-lg text-xs text-white/60">
          <span>
            <strong className="text-white/90">{data.groups_count}</strong> groupes classés
          </span>
          {data.excluded_count > 0 && (
            <span className="text-white/40" title="Groupes avec moins de 2 membres actifs">
              ℹ️ {L.excluded(data.excluded_count)}
            </span>
          )}
        </div>
      )}

      {/* Classement */}
      {data.groups.length === 0 ? (
        <div className="text-center py-12 text-white/40">
          <div className="text-5xl mb-3">🏆</div>
          <p>{L.noGroups}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.groups.map((g, idx) => {
            const isMine = g.id === currentGroupId
            const rank = idx + 1
            const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
            return (
              <div key={g.id}
                className={`flex items-center gap-3 p-4 rounded-xl border transition ${
                  isMine
                    ? 'bg-orange-500/15 border-orange-400/50 shadow-md shadow-orange-500/10'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}>

                {/* Rang */}
                <div className="w-10 text-center flex-shrink-0">
                  {rankEmoji ? (
                    <span className="text-2xl">{rankEmoji}</span>
                  ) : (
                    <span className={`font-mono font-bold ${isMine ? 'text-orange-300' : 'text-white/40'}`}>
                      #{rank}
                    </span>
                  )}
                </div>

                {/* Logo / Avatar groupe */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center font-black text-base flex-shrink-0 overflow-hidden">
                  {g.logo_data ? (
                    <img src={g.logo_data} alt={g.name} className="w-full h-full object-cover" />
                  ) : (
                    g.name?.[0]?.toUpperCase() || '?'
                  )}
                </div>

                {/* Infos groupe */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                    <span className="truncate">{g.name}</span>
                    {isMine && (
                      <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                        {L.yourGroup}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span>👥 {g.active_members}/{g.members_count} {L.activeMembers}</span>
                    <span>📊 {g.average_points} {L.avgPoints}</span>
                    <span className="text-white/30">{g.total_points} {L.totalPoints}</span>
                  </div>
                </div>

                {/* Score équilibré */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-xl font-black ${isMine ? 'text-orange-300' : 'text-white/90'}`}>
                    {g.balanced_score}
                  </div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wide">{L.score}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
