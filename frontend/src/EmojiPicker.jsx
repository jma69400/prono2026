import { useEffect, useRef, useState } from 'react'

// =====================================================
// EmojiPicker — sélecteur d'émojis pour les chats
// =====================================================
// Composant minimaliste sans dépendance externe.
// ~90 émojis par défaut, organisés en 5 catégories.
//
// Props :
//   - onSelect(emoji)  : callback quand un emoji est choisi
//   - onClose()        : callback de fermeture (clic hors picker, Escape)
//   - position         : 'top' | 'bottom' (défaut 'top') — au-dessus ou en-dessous du bouton
//
// Comportements UX :
//   - Fermeture sur clic hors picker (listener mousedown sur document)
//   - Fermeture sur touche Escape
//   - Mémorise la dernière catégorie ouverte dans localStorage
// =====================================================

// Catégories d'émojis — sélection ciblée pour un site de pronos foot.
// Quelques émojis fréquents par catégorie pour éviter l'overload.
const CATEGORIES = [
  {
    id: 'smileys',
    icon: '😊',
    label: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
      '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😴', '🤤', '😪', '😷', '🤒', '🤕',
      '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳',
      '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮',
      '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰',
      '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
      '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
    ],
  },
  {
    id: 'sport',
    icon: '⚽',
    label: 'Sport',
    emojis: [
      '⚽', '🏆', '🥇', '🥈', '🥉', '🎯', '🎖️', '🏅',
      '👑', '🎉', '🎊', '🎈', '✨', '⭐', '🌟', '💫',
      '🔥', '💯', '💪', '🏟️', '⚡', '🎮', '🏃', '🤸',
      '⚖️', '🎲', '🎰', '🍀',
    ],
  },
  {
    id: 'hearts',
    icon: '❤️',
    label: 'Cœurs',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '💌',
    ],
  },
  {
    id: 'hands',
    icon: '👍',
    label: 'Mains',
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟',
      '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋',
      '🤚', '🖐️', '🖖', '👋', '🤝', '🙏', '✊', '👊',
      '🤛', '🤜', '👏', '🫶', '🙌', '🫡',
    ],
  },
  {
    id: 'misc',
    icon: '🎁',
    label: 'Divers',
    emojis: [
      '☕', '🍺', '🍷', '🥂', '🍻', '🥃', '🍹', '🍾',
      '🎁', '🎂', '🍰', '🍕', '🍔', '🍟', '🌭', '🥨',
      '🚀', '💰', '💸', '💎', '🤖', '👀', '💬', '🗯️',
      '📢', '📣', '⏰', '⏳', '✅', '❌', '⚠️', '❓',
    ],
  },
]

const STORAGE_KEY = 'emoji_picker_last_category'

export function EmojiPicker({ onSelect, onClose, position = 'top' }) {
  // Catégorie active — restaurée depuis localStorage si possible
  const [activeCategory, setActiveCategory] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      return CATEGORIES.find(c => c.id === saved) ? saved : 'smileys'
    } catch {
      return 'smileys'
    }
  })
  const pickerRef = useRef(null)

  // Mémorise la catégorie active
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, activeCategory) } catch {}
  }, [activeCategory])

  // Fermeture sur clic hors picker + Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose && onClose()
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose && onClose()
    }
    // Léger délai pour éviter que le clic d'ouverture ne ferme immédiatement
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const currentCategory = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0]

  return (
    <div
      ref={pickerRef}
      className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} right-0 z-50 w-[290px] max-w-[calc(100vw-32px)] bg-[#1a1f3a] border border-white/15 rounded-xl shadow-2xl overflow-hidden`}
      role="dialog"
      aria-label="Sélecteur d'émojis"
    >
      {/* Header : onglets de catégories */}
      <div className="flex gap-0.5 px-1 pt-1.5 pb-1 border-b border-white/10 bg-black/20">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            title={cat.label}
            aria-label={cat.label}
            className={`flex-1 py-1.5 rounded-lg text-base transition ${
              activeCategory === cat.id
                ? 'bg-sport-500/30 ring-1 ring-sport-400/40'
                : 'hover:bg-white/10'
            }`}>
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Grille d'émojis (scroll si dépasse) */}
      <div className="grid grid-cols-8 gap-0.5 p-1.5 max-h-[240px] overflow-y-auto">
        {currentCategory.emojis.map((emoji, idx) => (
          <button
            key={`${currentCategory.id}-${idx}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSelect && onSelect(emoji)
            }}
            className="w-8 h-8 flex items-center justify-center text-xl hover:bg-white/10 rounded transition active:scale-90"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
