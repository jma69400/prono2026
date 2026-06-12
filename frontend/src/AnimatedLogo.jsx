/**
 * AnimatedLogo — Logo "United Pronos" avec ballon photo-realiste
 *
 * APPROCHE :
 * - Utilise une vraie image PNG de ballon de foot (hebergee localement
 *   dans /public/ball.png, ~36 KB)
 * - Pas de CDN externe, pas de risque de panne
 * - Animation en parabole "tir au but"
 */
import React, { useEffect, useState } from 'react'

export default function AnimatedLogo({ size = 'lg', className = '', replayKey }) {
  const sizes = {
    sm: { text: 'text-xl',  ball: 32, gap: 10, parabolaY: '40px',  parabolaX: '60px' },
    md: { text: 'text-3xl', ball: 44, gap: 12, parabolaY: '60px',  parabolaX: '80px' },
    lg: { text: 'text-4xl sm:text-5xl', ball: 60, gap: 16, parabolaY: '90px', parabolaX: '120px' },
  }
  const cfg = sizes[size] || sizes.lg

  // Re-mount au changement de replayKey
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
        className="animated-ball-parabola"
        style={{
          '--ball-size': `${cfg.ball}px`,
          '--parabola-x': cfg.parabolaX,
          '--parabola-y': cfg.parabolaY,
          width: `${cfg.ball}px`,
          height: `${cfg.ball}px`,
          display: 'inline-block',
          flexShrink: 0,
        }}
      >
        <img
          src="/ball.png"
          alt="Ballon de foot"
          width={cfg.ball}
          height={cfg.ball}
          style={{ width: '100%', height: '100%', display: 'block' }}
          loading="eager"
          draggable={false}
        />
      </span>

      <h1 className={`animated-text font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent leading-none ${cfg.text}`}>
        United Pronos
      </h1>
    </div>
  )
}
