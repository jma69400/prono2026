/**
 * AnimatedLogo — Logo "United Pronos" avec ballon emoji système animé
 *
 * VERSION SAFE : 100% local, AUCUNE dépendance externe, AUCUN risque de panne.
 * Utilise l'emoji système ⚽ rendu par le navigateur.
 */
import React, { useEffect, useState } from 'react'

export default function AnimatedLogo({ size = 'lg', className = '', replayKey }) {
  const sizes = {
    sm: { text: 'text-xl',  ball: 30, gap: 10, trail: '80px' },
    md: { text: 'text-3xl', ball: 44, gap: 12, trail: '110px' },
    lg: { text: 'text-4xl sm:text-5xl', ball: 60, gap: 16, trail: '160px' },
  }
  const cfg = sizes[size] || sizes.lg

  // Re-mount forcé quand replayKey change → relance l'animation
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [replayKey])

  return (
    <div
      key={animKey}
      className={`animated-logo-wrap inline-flex items-center ${className}`}
      style={{ gap: `${cfg.gap}px` }}
    >
      <span
        className="animated-ball"
        style={{
          '--ball-trail': cfg.trail,
          '--ball-size': `${cfg.ball}px`,
          fontSize: `${cfg.ball}px`,
          lineHeight: 1,
          display: 'inline-block',
        }}
        aria-hidden="true"
      >
        {'\u26BD'}
      </span>

      <h1 className={`animated-text font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent leading-none ${cfg.text}`}>
        United Pronos
      </h1>
    </div>
  )
}
