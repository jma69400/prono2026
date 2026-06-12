/**
 * AnimatedLogo — Logo "United Pronos" avec animation de ballon qui traverse
 *
 * COMPORTEMENT :
 * - Au montage du composant : le ballon vient de la gauche en roulant, traverse
 *   le texte, et se positionne à droite en finale.
 * - Animation 1-shot (zero CPU après la fin).
 * - Respecte prefers-reduced-motion : si l'utilisateur préfère pas d'animation,
 *   le ballon apparait directement à sa position finale.
 *
 * PERFORMANCE :
 * - Uniquement des transformations CSS (transform + opacity) → composé par le
 *   GPU, pas de reflow du DOM, jamais de jank.
 * - Pas de JS pour piloter l'animation (juste CSS keyframes).
 * - SVG inline = pas de requête HTTP, pas de FOUC.
 * - Total : < 3 KB minifié, 0 dépendance.
 *
 * USAGE :
 *   <AnimatedLogo size="lg" />     // grand (homepage)
 *   <AnimatedLogo size="sm" />     // petit (header)
 */
import React from 'react'

// ============================================================
// SVG du ballon de foot (pentagones noirs et blancs classiques)
// ============================================================
function SoccerBall({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        {/* Gradient pour ajouter du relief/3D */}
        <radialGradient id="ball-gradient" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f0f0f0" />
          <stop offset="100%" stopColor="#cccccc" />
        </radialGradient>
      </defs>

      {/* Cercle de base */}
      <circle cx="50" cy="50" r="48" fill="url(#ball-gradient)" stroke="#222" strokeWidth="1.5" />

      {/* Pentagone central */}
      <polygon
        points="50,30 62,38 58,52 42,52 38,38"
        fill="#1a1a1a"
        stroke="#000"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Pentagones secondaires (hexagones blancs visibles entre les noirs) */}
      <polygon
        points="50,30 38,38 28,30 35,15 50,15"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <polygon
        points="50,30 62,38 72,30 65,15 50,15"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <polygon
        points="38,38 28,30 18,42 25,58 42,52"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <polygon
        points="62,38 72,30 82,42 75,58 58,52"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Reflet lumineux pour un effet 3D plus réaliste */}
      <ellipse cx="35" cy="32" rx="10" ry="6" fill="white" opacity="0.4" />
    </svg>
  )
}

// ============================================================
// AnimatedLogo : composant principal exporté
// ============================================================
export default function AnimatedLogo({ size = 'lg', className = '' }) {
  // Tailles selon le contexte d'utilisation
  // - lg : homepage (gros effet wow)
  // - md : milieu (footer, modals)
  // - sm : header sticky (discret)
  const sizes = {
    sm: { text: 'text-xl',  ball: 24, gap: 8,  trail: '50px' },
    md: { text: 'text-3xl', ball: 32, gap: 10, trail: '80px' },
    lg: { text: 'text-4xl sm:text-5xl', ball: 48, gap: 14, trail: '120px' },
  }
  const cfg = sizes[size] || sizes.lg

  return (
    <div className={`animated-logo-wrap inline-flex items-center ${className}`} style={{ gap: `${cfg.gap}px` }}>
      {/* Le ballon qui traverse */}
      <span
        className="animated-ball"
        style={{
          // CSS Custom Properties pour piloter la taille de mouvement
          '--ball-trail': cfg.trail,
          '--ball-size': `${cfg.ball}px`,
        }}
      >
        <SoccerBall size={cfg.ball} />
      </span>

      {/* Le texte "United Pronos" avec dégradé */}
      <h1
        className={`animated-text font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent ${cfg.text}`}
      >
        United Pronos
      </h1>
    </div>
  )
}
