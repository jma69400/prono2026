/**
 * AnimatedLogo — Logo "United Pronos" avec ballon photo-réaliste animé
 *
 * APPROCHE :
 * - On utilise l'emoji ⚽ via Twemoji SVG (Twitter Open Source)
 * - Rendu identique sur tous les devices (iPhone, Android, Windows, Mac, Linux)
 * - Image PNG haute résolution servie par jsDelivr CDN (ultra-rapide, cache)
 * - Image ~5 KB, chargée 1 seule fois
 *
 * COMPORTEMENT :
 * - Au montage : le ballon arrive de la gauche en roulant, traverse le texte,
 *   finit à droite avec un petit rebond.
 * - Re-joue à chaque changement de `replayKey` (login/logout).
 *
 * POURQUOI PAS UN SVG MAISON :
 * - Un ballon de foot dessiné à la main reste plat et "ridicule"
 * - Twemoji ⚽ est un emoji photo-réaliste maintenu par Twitter (Mozilla)
 * - Universellement reconnu, gratuit, libre de droits
 */
import React, { useEffect, useState } from 'react'

// URL de l'emoji ⚽ ballon de foot en SVG/PNG via Twemoji
// Code Unicode U+26BD (BLACK SOCCER BALL) → unicode hex 26bd
// jsDelivr CDN = ultra-rapide, cache global, gratuit
const SOCCER_BALL_URL = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/26bd.png'

// Fallback emoji natif si l'image ne charge pas (sera rendu par le système)
const FALLBACK_EMOJI = '\u26BD'  // ⚽

export default function AnimatedLogo({ size = 'lg', className = '', replayKey }) {
  // Tailles selon contexte
  const sizes = {
    sm: { text: 'text-xl',  ball: 32, gap: 10, trail: '80px' },
    md: { text: 'text-3xl', ball: 44, gap: 12, trail: '110px' },
    lg: { text: 'text-4xl sm:text-5xl', ball: 64, gap: 16, trail: '160px' },
  }
  const cfg = sizes[size] || sizes.lg

  // Re-mount forcé quand replayKey change → relance l'animation
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [replayKey])

  // Si l'image Twemoji ne charge pas, on bascule sur l'emoji natif
  const [useFallback, setUseFallback] = useState(false)

  return (
    <div
      key={animKey}
      className={`animated-logo-wrap inline-flex items-center ${className}`}
      style={{ gap: `${cfg.gap}px` }}
    >
      {/* Le ballon : image Twemoji ou emoji natif */}
      <span
        className="animated-ball"
        style={{
          '--ball-trail': cfg.trail,
          '--ball-size': `${cfg.ball}px`,
          fontSize: `${cfg.ball}px`,
          lineHeight: 1,
          width: `${cfg.ball}px`,
          height: `${cfg.ball}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden="true"
      >
        {useFallback ? (
          // Emoji natif système (iPhone/Android/Windows/Mac rendent leur version)
          <span style={{ fontSize: `${cfg.ball}px`, lineHeight: 1 }}>{FALLBACK_EMOJI}</span>
        ) : (
          // Twemoji SVG (rendu identique partout)
          <img
            src={SOCCER_BALL_URL}
            alt="ballon"
            width={cfg.ball}
            height={cfg.ball}
            onError={() => setUseFallback(true)}
            style={{ width: '100%', height: '100%', display: 'block' }}
            // Loading=eager : l'image est dans le viewport visible immédiatement
            loading="eager"
            // Pas de drag possible
            draggable={false}
          />
        )}
      </span>

      {/* Le texte "United Pronos" */}
      <h1 className={`animated-text font-black bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent leading-none ${cfg.text}`}>
        United Pronos
      </h1>
    </div>
  )
}
