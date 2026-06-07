import { useState } from 'react'
import { api } from './api'

// =====================================================
// RESET PASSWORD : Formulaires de récupération
// =====================================================

/**
 * Formulaire "Mot de passe oublié" — saisie d'email pour recevoir le lien.
 * Affiché dans une modale ou en remplacement du formulaire de connexion.
 */
export function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e?.preventDefault()
    setError('')
    if (!email.trim() || !email.includes('@')) {
      setError('Email invalide')
      return
    }
    setSending(true)
    try {
      await api.passwordResetRequest(email.trim())
      setSuccess(true)
    } catch (e) {
      // Pour la sécurité, on affiche toujours le même message succès
      // (anti user enumeration). Mais on log l'erreur pour debug.
      console.error(e)
      setSuccess(true)
    } finally {
      setSending(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-5xl mb-3">📧</div>
          <h3 className="text-xl font-bold mb-2">Vérifie ta boîte mail</h3>
          <p className="text-sm text-white/70">
            Si l'email <strong>{email}</strong> est associé à un compte, tu vas recevoir un lien
            de réinitialisation dans quelques minutes.
          </p>
        </div>

        <div className="bg-sport-500/10 border border-sport-400/30 rounded-lg p-3 text-xs text-white/70">
          💡 <strong>Tu ne reçois rien ?</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>Vérifie ton dossier <strong>spam</strong></li>
            <li>Le lien expire dans <strong>1 heure</strong></li>
            <li>Si tu utilises Outlook/Hotmail, l'email peut être bloqué — contacte-nous via 💬</li>
          </ul>
        </div>

        <button onClick={onBack}
          className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-semibold transition">
          ← Retour à la connexion
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="text-center mb-4">
        <div className="text-5xl mb-3">🔐</div>
        <h3 className="text-xl font-bold mb-2">Mot de passe oublié ?</h3>
        <p className="text-sm text-white/70">
          Pas de panique ! Saisis ton email et on t'envoie un lien pour le réinitialiser.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white/60 mb-1 uppercase">
          Ton email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ton@email.com"
          autoFocus
          required
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-base focus:outline-none focus:border-sport-400/50"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-400/30 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      <button type="submit" disabled={sending || !email.trim()}
        className="w-full py-3 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold transition">
        {sending ? '⏳ Envoi...' : '📧 Envoyer le lien de réinitialisation'}
      </button>

      <button type="button" onClick={onBack}
        className="w-full py-2 text-sm text-white/60 hover:text-white/90 transition">
        ← Retour à la connexion
      </button>
    </form>
  )
}


/**
 * Page de réinitialisation : appelée depuis le lien dans l'email.
 * URL : /?reset_token=XXX
 */
export function ResetPasswordPage({ token, onSuccess }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const submit = async (e) => {
    e?.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setSending(true)
    try {
      await api.passwordResetConfirm(token, password)
      setSuccess(true)
      // Redirige vers le login après 3 sec
      setTimeout(() => {
        // Nettoie l'URL et redirige
        window.history.replaceState({}, '', '/')
        onSuccess?.()
      }, 3000)
    } catch (e) {
      setError(e.message || 'Erreur lors de la réinitialisation')
    } finally {
      setSending(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
        <div className="max-w-md w-full bg-gradient-to-br from-[#0f1430] to-[#0a0e27] border border-green-400/30 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-black mb-3 text-green-400">Mot de passe modifié !</h2>
          <p className="text-white/70 mb-4">
            Ton mot de passe a été réinitialisé avec succès. Tu vas être redirigé vers la connexion...
          </p>
          <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-400 to-emerald-400 animate-progress"></div>
          </div>
        </div>
        <style>{`
          @keyframes progress {
            from { width: 0%; }
            to { width: 100%; }
          }
          .animate-progress { animation: progress 3s linear; }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27]">
      <div className="max-w-md w-full bg-gradient-to-br from-[#0f1430] to-[#0a0e27] border border-sport-400/30 rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔐</div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-cta-500 to-cta-600 bg-clip-text text-transparent mb-2">
            Nouveau mot de passe
          </h2>
          <p className="text-sm text-white/60">
            Choisis un mot de passe solide pour sécuriser ton compte United Pronos.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1 uppercase">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
              autoFocus
              required
              minLength={8}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-base focus:outline-none focus:border-sport-400/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1 uppercase">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Retape le même mot de passe"
              required
              minLength={8}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-base focus:outline-none focus:border-sport-400/50"
            />
          </div>

          <div className="text-xs text-white/40 space-y-1">
            <div>💡 Conseils pour un mot de passe sécurisé :</div>
            <ul className="list-disc list-inside pl-2 space-y-0.5">
              <li>Au moins 8 caractères</li>
              <li>Mélange lettres, chiffres et symboles</li>
              <li>Évite les mots de passe utilisés ailleurs</li>
            </ul>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-400/30 rounded-lg text-sm text-red-300">
              ❌ {error}
            </div>
          )}

          <button type="submit" disabled={sending || !password || !confirmPassword}
            className="w-full py-3 bg-gradient-to-r from-cta-500 to-cta-600 hover:from-cta-600 hover:to-cta-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold transition">
            {sending ? '⏳ Modification...' : '✅ Réinitialiser le mot de passe'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-white/40">
          ⏱️ Ce lien expire 1h après l'envoi de l'email
        </div>
      </div>
    </div>
  )
}
