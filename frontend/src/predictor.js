// =====================================================
// United Pronos — Modèle de prédiction avancé style bookmaker
// =====================================================
// Inspiré de Dixon-Coles (1997) — utilisé par Pinnacle, Bet365 etc.
// + Monte Carlo (10 000 simulations)
// + Forme récente + avantage hôte + facteurs contextuels
// =====================================================

// Forces d'attaque et de défense par équipe
// Calibrées sur Elo + résultats récents (qualifs + matchs amicaux 2024-2026)
// Format : [attaque, défense, forme] (1.0 = moyenne mondiale, >1 = au-dessus)
export const TEAM_STRENGTHS = {
  // Tier S - prétendants au titre
  ARG: { att: 1.85, def: 1.75, form: 0.85 },
  ESP: { att: 1.80, def: 1.70, form: 0.92 },
  FRA: { att: 1.82, def: 1.72, form: 0.78 },
  ENG: { att: 1.70, def: 1.65, form: 0.80 },
  BRA: { att: 1.75, def: 1.60, form: 0.75 },

  // Tier A - top mondial
  POR: { att: 1.65, def: 1.55, form: 0.82 },
  GER: { att: 1.60, def: 1.55, form: 0.70 },
  NED: { att: 1.55, def: 1.55, form: 0.78 },
  ITA: { att: 1.50, def: 1.65, form: 0.65 },
  BEL: { att: 1.50, def: 1.45, form: 0.68 },
  CRO: { att: 1.40, def: 1.50, form: 0.72 },
  URU: { att: 1.45, def: 1.50, form: 0.75 },
  COL: { att: 1.40, def: 1.40, form: 0.80 },

  // Tier B - solide niveau international
  MAR: { att: 1.30, def: 1.45, form: 0.78 },
  SEN: { att: 1.30, def: 1.35, form: 0.70 },
  JPN: { att: 1.30, def: 1.30, form: 0.75 },
  SUI: { att: 1.20, def: 1.40, form: 0.62 },
  MEX: { att: 1.25, def: 1.25, form: 0.60 },
  USA: { att: 1.20, def: 1.20, form: 0.70 },
  TUR: { att: 1.25, def: 1.15, form: 0.72 },
  AUT: { att: 1.20, def: 1.30, form: 0.68 },
  NOR: { att: 1.25, def: 1.20, form: 0.78 },
  KOR: { att: 1.15, def: 1.20, form: 0.65 },
  AUS: { att: 1.05, def: 1.20, form: 0.62 },
  IRN: { att: 1.10, def: 1.30, form: 0.60 },
  EGY: { att: 1.15, def: 1.20, form: 0.65 },
  CIV: { att: 1.15, def: 1.15, form: 0.72 },
  ECU: { att: 1.05, def: 1.30, form: 0.68 },

  // Tier C - solides outsiders
  ALG: { att: 1.10, def: 1.10, form: 0.70 },
  TUN: { att: 1.00, def: 1.20, form: 0.60 },
  PAR: { att: 1.00, def: 1.15, form: 0.65 },
  CAN: { att: 1.05, def: 1.05, form: 0.55 },
  CZE: { att: 1.10, def: 1.05, form: 0.58 },
  SCO: { att: 1.05, def: 1.10, form: 0.62 },
  GHA: { att: 1.05, def: 1.00, form: 0.55 },
  SWE: { att: 1.10, def: 1.05, form: 0.55 },
  BIH: { att: 1.00, def: 1.05, form: 0.58 },
  UZB: { att: 0.95, def: 1.05, form: 0.65 },
  COD: { att: 1.00, def: 1.00, form: 0.60 },

  // Tier D - challengers
  RSA: { att: 0.90, def: 1.00, form: 0.62 },
  PAN: { att: 0.95, def: 0.95, form: 0.55 },
  KSA: { att: 0.85, def: 1.00, form: 0.50 },
  IRQ: { att: 0.85, def: 1.00, form: 0.55 },
  JOR: { att: 0.80, def: 1.00, form: 0.55 },
  QAT: { att: 0.85, def: 0.90, form: 0.50 },
  CPV: { att: 0.85, def: 0.85, form: 0.60 },
  HAI: { att: 0.80, def: 0.80, form: 0.50 },
  CUW: { att: 0.70, def: 0.75, form: 0.55 },
  NZL: { att: 0.75, def: 0.85, form: 0.50 },
}

// Tirage Poisson : nombre de buts marqués
function poissonRandom(lambda) {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= Math.random()
  } while (p > L)
  return k - 1
}

// Lambda = espérance de buts pour une équipe
function expectedGoals(team, opponent, isHome, isHostCountry) {
  const t = TEAM_STRENGTHS[team] || { att: 1.0, def: 1.0, form: 0.5 }
  const o = TEAM_STRENGTHS[opponent] || { att: 1.0, def: 1.0, form: 0.5 }

  // Moyenne globale CDM ~2.75 buts/match → ~1.37 par équipe
  // On part un peu plus haut pour éviter le biais "trop de 1-1"
  const baseGoals = 1.52

  // Forces relatives : attaque de l'équipe vs défense de l'adversaire
  // On utilise une puissance pour AMPLIFIER les écarts entre grosses et petites équipes
  // (sinon tout se tasse vers 1-1)
  const attackPower = Math.pow(t.att / o.def, 1.20)

  // Avantage domicile / pays hôte
  let homeBoost = 1.0
  if (isHome) homeBoost = 1.08         // +8% à domicile
  if (isHostCountry) homeBoost = 1.15  // +15% si pays hôte du tournoi

  // Bonus de forme (entre 0.90x et 1.12x selon la forme)
  // Atténué pour ne pas trop compresser vers la moyenne
  const formBoost = 0.90 + (t.form * 0.22)

  // Lambda final
  let lambda = baseGoals * attackPower * homeBoost * formBoost

  // Bornes raisonnables : entre 0.25 et 4.5 buts attendus
  lambda = Math.max(0.25, Math.min(4.5, lambda))

  return lambda
}

// Ajustement Dixon-Coles pour les scores serrés (corrige le biais Poisson)
function dixonColesAdjustment(homeGoals, awayGoals, lambdaH, lambdaA) {
  // Le modèle Dixon-Coles (1997) corrige UNIQUEMENT les 4 scores à faible total.
  // rho NÉGATIF (~-0.05) = la vraie valeur empirique du foot international.
  //
  // Important : avec rho négatif :
  //   - 0-0 et 1-1 sont LÉGÈREMENT réduits (le Poisson les surestime)
  //   - 1-0 et 0-1 sont légèrement augmentés
  // C'est l'inverse de l'ancien code qui boostait le 1-1 de +18% (bug).
  const rho = -0.08  // valeur empirique réaliste (était -0.18, trop fort + mal appliqué)

  if (homeGoals === 0 && awayGoals === 0) return 1 - (lambdaH * lambdaA * rho)
  if (homeGoals === 1 && awayGoals === 0) return 1 + (lambdaA * rho)
  if (homeGoals === 0 && awayGoals === 1) return 1 + (lambdaH * rho)
  if (homeGoals === 1 && awayGoals === 1) return 1 + rho   // ← réduit le 1-1 (rho<0)
  return 1
}

// =====================================================
// PRÉDICTION PRINCIPALE — Monte Carlo 10 000 simulations
// =====================================================
export function predictMatch(homeCode, awayCode, options = {}) {
  const { isHostCountry = false, simulations = 10000 } = options

  const lambdaH = expectedGoals(homeCode, awayCode, true, isHostCountry)
  const lambdaA = expectedGoals(awayCode, homeCode, false, false)

  // Distribution des scores
  const scoreDistribution = {}
  let homeWins = 0, draws = 0, awayWins = 0
  let totalGoals = 0
  let homeGoalsTotal = 0, awayGoalsTotal = 0
  let bttsCount = 0  // both teams to score
  let over25 = 0     // plus de 2.5 buts

  for (let i = 0; i < simulations; i++) {
    const h = poissonRandom(lambdaH)
    const a = poissonRandom(lambdaA)

    // Correction Dixon-Coles pour scores serrés (rejection sampling).
    // adj est dans [~0.9, ~1.1]. On normalise par le max possible (1.1) pour que
    // le rejection sampling puisse réduire les scores sur-représentés.
    // Les scores avec adj élevé passent presque toujours, ceux avec adj faible sont rejetés plus souvent.
    const adj = dixonColesAdjustment(h, a, lambdaH, lambdaA)
    // Normalisation : on divise par 1.15 (borne haute) pour avoir une proba d'acceptation < 1
    if (Math.random() > adj / 1.15) {
      i--  // re-tirage
      continue
    }

    const key = `${h}-${a}`
    scoreDistribution[key] = (scoreDistribution[key] || 0) + 1

    if (h > a) homeWins++
    else if (h === a) draws++
    else awayWins++

    totalGoals += h + a
    homeGoalsTotal += h
    awayGoalsTotal += a
    if (h > 0 && a > 0) bttsCount++
    if (h + a > 2.5) over25++
  }

  // Top 5 scores les plus probables
  const topScores = Object.entries(scoreDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([score, count]) => {
      const [h, a] = score.split('-').map(Number)
      return {
        home: h,
        away: a,
        probability: Math.round((count / simulations) * 1000) / 10, // 1 décimale
      }
    })

  const mostLikely = topScores[0]

  // Confiance : basée sur la concentration de la distribution
  // Si le score le plus probable a >12% → élevée
  // Entre 8-12% → moyenne
  // <8% → faible
  let confidence
  if (mostLikely.probability > 12) confidence = 'high'
  else if (mostLikely.probability > 8) confidence = 'medium'
  else confidence = 'low'

  return {
    home: mostLikely.home,
    away: mostLikely.away,
    probability: mostLikely.probability,
    topScores,
    probHome: Math.round((homeWins / simulations) * 100),
    probDraw: Math.round((draws / simulations) * 100),
    probAway: Math.round((awayWins / simulations) * 100),
    expectedGoals: {
      home: Math.round((homeGoalsTotal / simulations) * 100) / 100,
      away: Math.round((awayGoalsTotal / simulations) * 100) / 100,
      total: Math.round((totalGoals / simulations) * 100) / 100,
    },
    btts: Math.round((bttsCount / simulations) * 100),       // % les 2 équipes marquent
    over25: Math.round((over25 / simulations) * 100),         // % +2.5 buts
    confidence,
  }
}

// =====================================================
// COTES STYLE BOOKMAKER (1, X, 2)
// =====================================================
// Convertit une probabilité en cote décimale avec marge bookmaker (~5%)
export function calcOdds(probability) {
  const fairOdds = 100 / probability
  const margin = 1.05 // 5% de marge bookmaker
  return Math.round((fairOdds / margin) * 100) / 100
}

export function getMatchOdds(prediction) {
  return {
    home: calcOdds(prediction.probHome),
    draw: calcOdds(prediction.probDraw),
    away: calcOdds(prediction.probAway),
  }
}
