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
  const [searchQuery, setSearchQuery] = useState('')

  // Normalisation pour rechercher avec ou sans accents (Café = cafe)
  const normalize = (s) => (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Scroll vers le groupe de l'utilisateur
  const scrollToMyGroup = () => {
    if (!currentGroupId) return
    setSearchQuery('')  // reset filtre pour s'assurer que mon groupe est visible
    setTimeout(() => {
      const el = document.getElementById(`group-row-${currentGroupId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-cta-400', 'ring-offset-2', 'ring-offset-[#0a0e27]')
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-cta-400', 'ring-offset-2', 'ring-offset-[#0a0e27]')
        }, 2000)
      }
    }, 50)
  }

  // CHARGEMENT OPTIMISÉ EN 2 ÉTAPES :
  // 1. Charge la liste rapidement (sans logos) → affichage immédiat
  // 2. Charge les logos en chunks pour éviter URL trop longue + priorise le top 20
  const [groupLogos, setGroupLogos] = useState({})  // {group_id: logo_data_url}

  // Charge les logos d'une liste d'IDs en chunks de 30 (limite URL)
  const loadLogosChunked = async (ids) => {
    const CHUNK_SIZE = 30
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE)
      try {
        const logos = await api.leaderboardGroupsLogos(chunk)
        // Merge progressif : chaque chunk apparait dès qu'il est prêt
        setGroupLogos(prev => ({ ...prev, ...(logos || {}) }))
      } catch (e) {
        console.warn(`Chunk logos ${i} échoué :`, e)
      }
    }
  }

  const reload = async () => {
    setLoading(true)
    try {
      const r = await api.leaderboardGroups()
      setData(r)
      // Charge les logos en parallèle : top 20 d'abord (priorité visible), puis le reste
      if (r.groups && r.groups.length > 0) {
        const ids = r.groups.map(g => g.id)
        const priority = ids.slice(0, 20)
        const rest = ids.slice(20)
        loadLogosChunked(priority).then(() => {
          if (rest.length > 0) loadLogosChunked(rest)
        })
      }
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
      searchPlaceholder: '🔍 Rechercher un groupe...',
      findMyGroup: 'Mon groupe',
      noMatch: 'Aucun groupe trouvé',
      clearSearch: 'Effacer la recherche',
      groupsShown: 'groupes affichés',
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
      searchPlaceholder: '🔍 Search a group...',
      findMyGroup: 'My group',
      noMatch: 'No group found',
      clearSearch: 'Clear search',
      groupsShown: 'groups shown',
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
      searchPlaceholder: '🔍 Buscar un grupo...',
      findMyGroup: 'Mi grupo',
      noMatch: 'Ningún grupo encontrado',
      clearSearch: 'Borrar búsqueda',
      groupsShown: 'grupos mostrados',
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
        <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-cta-500 to-cta-600 bg-clip-text text-transparent mb-1">
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
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 font-mono text-center text-sport-200">
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

      {/* Recherche + bouton "Mon groupe" (à partir de 3 groupes pour aider à filtrer) */}
      {data.groups.length > 3 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={L.searchPlaceholder}
              className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-sport-400/50 transition placeholder-white/30"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 text-sm">
                ✕
              </button>
            )}
          </div>
          {currentGroupId && (
            <button
              onClick={scrollToMyGroup}
              className="px-3 py-2 bg-sport-500 hover:bg-sport-600 text-white rounded-lg text-sm font-bold transition flex items-center gap-1.5 shrink-0"
              title={L.findMyGroup}>
              🎯 <span className="hidden sm:inline">{L.findMyGroup}</span>
            </button>
          )}
        </div>
      )}

      {/* Classement */}
      {(() => {
        // Filtrage : recherche dans nom, description, leader, slug
        // Insensible aux accents (Café = cafe) pour faciliter la recherche
        const filteredGroups = !searchQuery
          ? data.groups
          : data.groups.filter(g => {
              const q = normalize(searchQuery.trim())
              return normalize(g.name).includes(q) ||
                     normalize(g.description).includes(q) ||
                     normalize(g.leader_username).includes(q) ||
                     normalize(g.slug).includes(q)
            })
        const isFiltering = !!searchQuery

        if (data.groups.length === 0) {
          return (
            <div className="text-center py-12 text-white/40">
              <div className="text-5xl mb-3">🏆</div>
              <p>{L.noGroups}</p>
            </div>
          )
        }
        if (filteredGroups.length === 0 && isFiltering) {
          return (
            <div className="text-center py-12 text-white/40">
              <div className="text-4xl mb-3">🔍</div>
              <p className="font-semibold">{L.noMatch}</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-sm text-sport-300 hover:text-sport-200 underline">
                {L.clearSearch}
              </button>
            </div>
          )
        }
        return (
          <>
            {isFiltering && (
              <div className="text-xs text-white/50 px-1 mb-2">
                <strong className="text-sport-300">{filteredGroups.length}</strong> / {data.groups.length} {L.groupsShown}
              </div>
            )}
            <div className="space-y-2">
              {filteredGroups.map((g) => {
                const isMine = g.id === currentGroupId
                // Rang global préservé (même quand on filtre)
                const rank = data.groups.indexOf(g) + 1
                const idx = rank - 1
                const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
                return (
                  <div key={g.id}
                    id={`group-row-${g.id}`}
                    className={`flex items-center gap-3 p-4 rounded-xl border transition ${
                  isMine
                    ? 'bg-sport-500/15 border-sport-400/50 shadow-md shadow-orange-500/10'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}>

                {/* Rang */}
                <div className="w-10 text-center flex-shrink-0">
                  {rankEmoji ? (
                    <span className="text-2xl">{rankEmoji}</span>
                  ) : (
                    <span className={`font-mono font-bold ${isMine ? 'text-sport-300' : 'text-white/40'}`}>
                      #{rank}
                    </span>
                  )}
                </div>

                {/* Logo / Avatar groupe — chargé async pour ne pas bloquer la liste */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cta-500 to-cta-600 flex items-center justify-center font-black text-base flex-shrink-0 overflow-hidden">
                  {groupLogos[g.id] ? (
                    <img
                      src={groupLogos[g.id]}
                      alt={g.name}
                      className="w-full h-full object-cover animate-fade-in"
                      loading="lazy"
                    />
                  ) : (
                    g.name?.[0]?.toUpperCase() || '?'
                  )}
                </div>

                {/* Infos groupe */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                    <span className="truncate">{g.name}</span>
                    {isMine && (
                      <span className="text-[10px] bg-cta-500 text-white px-1.5 py-0.5 rounded-full font-bold">
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
                  <div className={`text-xl font-black ${isMine ? 'text-sport-300' : 'text-white/90'}`}>
                    {g.balanced_score}
                  </div>
                  <div className="text-[10px] text-white/40 uppercase tracking-wide">{L.score}</div>
                </div>
              </div>
            )
          })}
        </div>
          </>
        )
      })()}
    </div>
  )
}
