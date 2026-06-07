import { useState, useEffect } from 'react'
import { api } from './api'
import { useTranslation } from './i18n'

// =====================================================
// SUPPORT — Système complet de sollicitation des dons
// Composants exportés :
//   - HeaderSupportButton : bouton "❤️ Soutenir" dans le header
//   - SupportPage : page transparence avec compteur supporters
//   - SupporterBadge : badge ❤️ à côté des pseudos donateurs
//   - ContextualDonationModal : modal après actions positives
//   - SupportersWallPage : mur des supporters (page crédits)
// =====================================================

// ---------- Helpers : récupération configuration donations ----------
async function getDonationConfig() {
  // /api/config renvoie {donations: {stripe, kofi, enabled}}
  // On utilise cette config publique (déjà chargée par App)
  try {
    const r = await fetch('/api/config')
    const data = await r.json()
    return data.donations || { enabled: false }
  } catch {
    return { enabled: false }
  }
}

// Génère une URL Ko-fi avec montant pré-rempli (si Ko-fi est configuré)
// Ko-fi format : https://ko-fi.com/<username>/?via=quickdonate&amount=5
function kofiUrlWithAmount(kofiBase, amount) {
  if (!kofiBase) return null
  try {
    const url = new URL(kofiBase)
    if (amount) url.searchParams.set('amount', String(amount))
    return url.toString()
  } catch {
    // Si l'URL est mal formée, on retourne juste la base
    return kofiBase
  }
}

// =====================================================
// 1) HeaderSupportButton — bouton persistant dans le header
// =====================================================
export function HeaderSupportButton({ onClick }) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onClick}
      title={t('support.headerTooltip')}
      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-cta-500/15 hover:bg-pink-500/25 border border-cta-400/30 hover:border-pink-400/50 rounded-lg text-xs font-semibold text-cta-200 transition group"
    >
      <span className="text-base group-hover:scale-110 transition-transform">❤️</span>
      <span>{t('support.headerButton')}</span>
    </button>
  )
}

// Version mobile compacte (icône seule)
export function HeaderSupportButtonMobile({ onClick }) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onClick}
      title={t('support.headerButton')}
      aria-label={t('support.headerButton')}
      className="sm:hidden flex items-center justify-center w-9 h-9 bg-cta-500/15 hover:bg-pink-500/25 border border-cta-400/30 rounded-lg text-cta-200 transition"
    >
      <span className="text-lg">❤️</span>
    </button>
  )
}

// =====================================================
// 2) SupportPage — Page principale de sollicitation
// =====================================================
export function SupportPage({ user, onClose }) {
  const { t, lang } = useTranslation()
  const [stats, setStats] = useState({ supporter_count: 0, supporters: [] })
  const [donationConfig, setDonationConfig] = useState({ enabled: false })
  const [isSupporter, setIsSupporter] = useState(false)
  const [showThanks, setShowThanks] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.donationsStats().catch(() => ({ supporter_count: 0, supporters: [] })),
      getDonationConfig(),
      user ? api.meIsSupporter().catch(() => ({ is_supporter: false })) : Promise.resolve({ is_supporter: false }),
    ]).then(([s, cfg, me]) => {
      setStats(s)
      setDonationConfig(cfg)
      setIsSupporter(me.is_supporter)
      setLoading(false)
    })
  }, [user])

  // Montants suggérés (cohérents avec les choix utilisateur)
  const amounts = [
    { value: 2,  icon: '☕', label: t('support.amount2') },
    { value: 5,  icon: '🍺', label: t('support.amount5') },
    { value: 10, icon: '🎁', label: t('support.amount10') },
    { value: null, icon: '✨', label: t('support.amountFree') },
  ]

  // Quand l'utilisateur clique sur un montant, on ouvre Ko-fi/Stripe
  // et on lui propose de se déclarer supporter (après retour)
  const handleDonate = (amount) => {
    const link = donationConfig.kofi || donationConfig.stripe
    if (!link) return
    const finalUrl = donationConfig.kofi
      ? kofiUrlWithAmount(donationConfig.kofi, amount)
      : donationConfig.stripe
    window.open(finalUrl, '_blank', 'noopener,noreferrer')
    // Affiche immédiatement le bouton "Je viens de donner, ajoute mon badge"
    setShowThanks(true)
  }

  const handleDeclareSupporter = async () => {
    if (!user) return
    try {
      await api.declareDonation()
      setIsSupporter(true)
      // Rafraîchit le compteur
      const s = await api.donationsStats()
      setStats(s)
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-white/40">⏳</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-12">
      {/* Header de la page */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">❤️</div>
        <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-pink-400 to-orange-500 bg-clip-text text-transparent mb-2">
          {t('support.pageTitle')}
        </h1>
        <p className="text-white/60 text-sm max-w-md mx-auto">{t('support.pageSubtitle')}</p>
      </div>

      {/* Badge "Tu es supporter" si l'utilisateur l'est déjà */}
      {isSupporter && (
        <div className="mb-6 p-4 bg-gradient-to-br from-pink-500/15 to-orange-500/10 border border-cta-400/30 rounded-xl text-center">
          <div className="text-3xl mb-2">🎉</div>
          <div className="font-bold text-cta-200">{t('support.alreadyTitle')}</div>
          <div className="text-xs text-white/60 mt-1">{t('support.alreadyText')}</div>
        </div>
      )}

      {/* Compteur de supporters (transparence non-financière) */}
      <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl text-center">
        <div className="flex items-center justify-center gap-2 text-2xl font-black">
          <span>❤️</span>
          <span className="text-cta-300">{stats.supporter_count}</span>
          <span className="text-white/80">{stats.supporter_count > 1 ? t('support.counterPlural') : t('support.counterSingular')}</span>
        </div>
        <p className="text-xs text-white/50 mt-2">{t('support.counterNote')}</p>
      </div>

      {/* Pourquoi soutenir */}
      <div className="mb-6 p-5 bg-white/5 border border-white/10 rounded-xl">
        <h2 className="text-lg font-bold mb-3 text-white/90">{t('support.whyTitle')}</h2>
        <ul className="space-y-2 text-sm text-white/70">
          <li className="flex gap-2"><span>🆓</span><span>{t('support.why1')}</span></li>
          <li className="flex gap-2"><span>🚫</span><span>{t('support.why2')}</span></li>
          <li className="flex gap-2"><span>🔒</span><span>{t('support.why3')}</span></li>
          <li className="flex gap-2"><span>🛠️</span><span>{t('support.why4')}</span></li>
          <li className="flex gap-2"><span>⚽</span><span>{t('support.why5')}</span></li>
        </ul>
      </div>

      {/* Montants suggérés */}
      {donationConfig.enabled ? (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3 text-white/90 text-center">{t('support.chooseAmount')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {amounts.map(a => (
              <button
                key={a.value || 'free'}
                onClick={() => handleDonate(a.value)}
                className="p-4 bg-gradient-to-br from-pink-500/10 to-orange-500/10 hover:from-pink-500/20 hover:to-orange-500/20 border border-white/10 hover:border-cta-400/40 rounded-xl transition group"
              >
                <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">{a.icon}</div>
                <div className="font-bold text-white">
                  {a.value ? `${a.value}€` : t('support.amountFree')}
                </div>
                <div className="text-[10px] text-white/50 mt-0.5">{a.label}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-white/40 text-center mt-3">
            🔒 {t('support.paymentSecure')}
          </p>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-400/30 rounded-xl text-sm text-yellow-100">
          ⚠️ {t('support.notConfigured')}
        </div>
      )}

      {/* Bouton "Je viens de faire un don" après retour de Ko-fi */}
      {showThanks && user && !isSupporter && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-400/30 rounded-xl text-center">
          <div className="text-2xl mb-2">🙏</div>
          <p className="text-sm text-green-100 mb-3">{t('support.afterDonateText')}</p>
          <button
            onClick={handleDeclareSupporter}
            className="px-5 py-2 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-pink-600 hover:to-orange-600 rounded-lg text-sm font-bold text-white transition"
          >
            ❤️ {t('support.afterDonateBtn')}
          </button>
          <p className="text-[11px] text-white/40 mt-2">{t('support.afterDonateNote')}</p>
        </div>
      )}

      {/* Lien vers la page Crédits si supporters existent */}
      {stats.supporter_count > 0 && (
        <div className="text-center mt-8">
          <button
            onClick={() => onClose && onClose('credits')}
            className="text-sm text-white/60 hover:text-cta-300 underline underline-offset-2 transition"
          >
            👥 {t('support.seeAllSupporters')}
          </button>
        </div>
      )}
    </div>
  )
}

// =====================================================
// 3) SupporterBadge — petit badge ❤️ à côté du pseudo
// =====================================================
export function SupporterBadge({ small = false }) {
  const { t } = useTranslation()
  return (
    <span
      title={t('support.badgeTooltip')}
      className={`inline-flex items-center justify-center ${
        small
          ? 'text-[10px] px-1 py-0 rounded-full bg-cta-500/20 text-cta-300 border border-cta-400/30'
          : 'text-[11px] px-1.5 py-0.5 rounded-full bg-cta-500/20 text-cta-300 border border-cta-400/30'
      } font-bold flex-shrink-0`}
    >
      ❤️
    </span>
  )
}

// =====================================================
// 4) ContextualDonationModal — modal soft après actions positives
// Stocke en localStorage qu'on a déjà demandé, pour ne PAS spammer
// =====================================================
export function ContextualDonationModal({ trigger, onClose, onGoToSupport }) {
  const { t } = useTranslation()

  // Garde : si l'utilisateur a déjà été sollicité pour ce trigger, ne pas afficher
  // (vérifié par le parent avant de passer le trigger, mais double-check)
  if (!trigger) return null

  // Messages contextuels selon le trigger
  const messages = {
    'all_pronos_done': {
      icon: '🎉',
      title: t('support.modalDoneTitle'),
      text: t('support.modalDoneText'),
    },
    'podium_reached': {
      icon: '🏆',
      title: t('support.modalPodiumTitle'),
      text: t('support.modalPodiumText'),
    },
    'group_active': {
      icon: '👥',
      title: t('support.modalGroupTitle'),
      text: t('support.modalGroupText'),
    },
  }
  const msg = messages[trigger] || messages.all_pronos_done

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-[#1a1f3a] to-[#0a0e27] border border-cta-400/30 rounded-2xl p-6 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-5xl mb-3">{msg.icon}</div>
          <h3 className="text-xl font-black mb-2 bg-gradient-to-r from-pink-400 to-orange-500 bg-clip-text text-transparent">
            {msg.title}
          </h3>
          <p className="text-white/70 text-sm mb-5">{msg.text}</p>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 transition"
            >
              {t('support.modalLater')}
            </button>
            <button
              onClick={() => { onGoToSupport && onGoToSupport(); onClose() }}
              className="flex-1 py-2 px-4 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-pink-600 hover:to-orange-600 rounded-lg text-sm font-bold text-white transition"
            >
              ❤️ {t('support.modalCTA')}
            </button>
          </div>

          <p className="text-[11px] text-white/40 mt-3">{t('support.modalNote')}</p>
        </div>
      </div>
    </div>
  )
}

// Helper : décide si un modal contextuel doit être affiché (anti-spam)
// trigger : "all_pronos_done" | "podium_reached" | "group_active"
// Retourne true si on doit afficher, false si déjà affiché
export function shouldShowContextualModal(trigger) {
  if (typeof window === 'undefined') return false
  const key = `donation_modal_shown__${trigger}`
  if (localStorage.getItem(key)) return false
  return true
}

// Marque un trigger comme déjà affiché (à appeler quand on l'affiche)
export function markContextualModalShown(trigger) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`donation_modal_shown__${trigger}`, '1')
}

// =====================================================
// 5) SupportersWallPage — mur public des supporters
// =====================================================
export function SupportersWallPage() {
  const { t } = useTranslation()
  const [stats, setStats] = useState({ supporter_count: 0, supporters: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.donationsStats()
      .then(s => setStats(s))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-center py-12 text-white/40">⏳</div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pb-12">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🙏</div>
        <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-pink-400 to-orange-500 bg-clip-text text-transparent mb-2">
          {t('support.creditsTitle')}
        </h1>
        <p className="text-white/60 text-sm">{t('support.creditsSubtitle')}</p>
      </div>

      {stats.supporter_count === 0 ? (
        <div className="text-center py-12 text-white/40">
          <div className="text-4xl mb-3">💔</div>
          <p>{t('support.creditsEmpty')}</p>
        </div>
      ) : (
        <>
          <div className="mb-6 p-4 bg-cta-500/10 border border-cta-400/30 rounded-xl text-center">
            <div className="text-3xl font-black text-cta-300">
              ❤️ {stats.supporter_count}
            </div>
            <p className="text-xs text-white/60 mt-1">
              {stats.supporter_count > 1 ? t('support.counterPlural') : t('support.counterSingular')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stats.supporters.map((s, i) => (
              <div
                key={`${s.username}-${i}`}
                className="p-3 bg-gradient-to-br from-pink-500/5 to-orange-500/5 border border-white/10 rounded-lg text-center"
              >
                <div className="text-xl mb-1">❤️</div>
                <div className="font-semibold text-sm text-white/90 truncate">{s.username}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
