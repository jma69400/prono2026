import { useState, useMemo } from 'react'
import { useTranslation } from './i18n'

// =====================================================
// FAQ TAB — Foire Aux Questions
// =====================================================
// Affiche toutes les questions fréquentes organisées par catégorie.
// Avec recherche, accordéon et support multilingue.
// =====================================================

// Données FAQ multilingues
const FAQ_DATA = {
  fr: [
    {
      category: '🎯 Démarrer sur United Pronos',
      icon: '🎯',
      items: [
        {
          q: 'Comment créer un compte ?',
          a: 'Clique sur le bouton "S\'inscrire" en haut à droite. Tu peux choisir entre 3 modes : Joueur Solo (jouer seul), Leader (créer un groupe avec tes amis/collègues), ou Membre (rejoindre un groupe existant). L\'inscription est 100% gratuite.',
        },
        {
          q: 'Le site est-il vraiment gratuit ?',
          a: 'Oui, totalement gratuit. Pas d\'abonnement, pas de pub, pas d\'achat intégré. United Pronos vit uniquement grâce aux dons volontaires des utilisateurs qui veulent soutenir le projet.',
        },
        {
          q: 'Faut-il télécharger une application ?',
          a: 'Non, le site fonctionne directement dans ton navigateur sur ordinateur et mobile. Tu peux l\'ajouter à ton écran d\'accueil pour un accès rapide (icône "Ajouter à l\'écran d\'accueil" dans ton navigateur).',
        },
        {
          q: 'Puis-je essayer sans m\'inscrire ?',
          a: 'Oui ! Clique sur "Continuer en visiteur" pour explorer le site, voir les matchs, le classement et les actus. Pour faire des pronostics, il faudra créer un compte (toujours gratuit).',
        },
      ],
    },
    {
      category: '📊 Faire des pronostics',
      icon: '📊',
      items: [
        {
          q: 'Jusqu\'à quand puis-je saisir ou modifier mon pronostic ?',
          a: `Tu peux saisir ou modifier ton pronostic **jusqu'à 5 minutes avant le coup d'envoi du match**.

⏰ **Pourquoi 5 minutes et pas pile au coup d'envoi ?**
- Sécurité : ça évite les pronos envoyés au dernier moment qui arrivent après le début du match
- Décalages d'horloge : ton navigateur peut avoir quelques secondes de décalage avec le serveur

⚠️ **Concrètement** :
- À J-1 (la veille) : tu peux pronostiquer librement
- À J-1h : c'est encore le bon moment
- À J-30 min : un badge orange apparaît "⏰ Plus que XX min pour pronostiquer !"
- À J-5 min : **les inputs sont grisés**, plus aucune modification possible
- Pendant le match : verrouillé
- Match terminé : tes points sont calculés automatiquement

💡 **Conseil** : saisis tes pronos à l'avance pour ne pas oublier dans la précipitation !`,
        },
        {
          q: 'Comment fonctionnent les pronostics ?',
          a: 'Pour chaque match, tu prédis le score exact (ex: 2-1). Tu peux modifier ton pronostic jusqu\'à 5 minutes avant le coup d\'envoi du match. Une fois ce délai passé, tes prédictions sont verrouillées.',
        },
        {
          q: 'Comment sont calculés les points ?',
          a: 'Score exact (ex: 2-1 et tu as misé 2-1) = 5 points. Bon vainqueur + bonne différence de buts (ex: 3-2 et tu as misé 2-1) = 3 points. Bon vainqueur seulement = 1 point. Mauvaise prédiction = 0 point.',
        },
        {
          q: 'Qu\'est-ce que la prédiction IA ?',
          a: 'C\'est notre algorithme qui calcule la probabilité de chaque résultat en se basant sur le classement FIFA, l\'historique des équipes et leur forme actuelle. Tu peux t\'en inspirer mais l\'IA ne fait pas toujours de bonnes prédictions !',
        },
        {
          q: 'Puis-je voir les pronostics des autres ?',
          a: 'Non, les pronostics restent privés jusqu\'au coup d\'envoi du match. Après le coup d\'envoi, les pronostics des autres membres de ton groupe deviennent visibles.',
        },
        {
          q: 'Que se passe-t-il en cas de prolongations ou tirs au but ?',
          a: 'Le score retenu est celui à la fin du temps réglementaire (90 minutes + arrêts de jeu), pas après prolongations ou tirs au but. C\'est la règle standard FIFA.',
        },
      ],
    },
    {
      category: '👥 Groupes et compétition',
      icon: '👥',
      items: [
        {
          q: 'Comment créer un groupe ?',
          a: 'Inscris-toi en tant que "Leader" pour créer ton groupe. Tu pourras personnaliser le nom, ajouter un logo, et inviter tes amis/collègues avec un code d\'invitation unique ou un lien direct.',
        },
        {
          q: 'Comment inviter mes amis ou collègues à rejoindre mon groupe ?',
          a: `Tu as 3 façons d'inviter des personnes dans ton groupe :

1. **Partage le lien direct** (le plus simple) : Va dans l'onglet "Mon Groupe", tu y trouveras ton lien d'invitation au format "unitedpronos.com/join/TONCODE". Clique sur "Copier le lien" et partage-le par WhatsApp, SMS, Slack, Teams, Discord ou email. La personne qui clique arrive directement sur la page d'inscription avec ton groupe déjà sélectionné.

2. **Partage juste le code** : Si tu préfères, tu peux partager seulement le code (visible aussi dans "Mon Groupe", par exemple "ABC123"). Tes amis cliquent sur "S'inscrire" → "Rejoindre un groupe" → saisissent le code → ils sont dans ton groupe.

3. **À l'oral** : tu peux dicter le code à quelqu'un par téléphone, il suffit qu'il le tape lors de son inscription.

💡 Astuce : copie-colle ce message type pour inviter rapidement :
"Salut ! Je lance un concours de pronostics gratuit pour la Coupe du Monde 2026, rejoins-moi : https://unitedpronos.com/join/TONCODE — Inscription gratuite, 30 secondes, sans pub !"`,
        },
        {
          q: 'Où trouver mon code et mon lien d\'invitation ?',
          a: 'Si tu es leader d\'un groupe : connecte-toi puis va dans l\'onglet "Mon Groupe" (en haut). Tu verras un bloc "Lien d\'invitation" avec le lien complet à copier et le code d\'invitation en dessous. Le code ne change jamais, tu peux le partager autant de fois que tu veux.',
        },
        {
          q: 'Comment rejoindre un groupe existant ?',
          a: 'Demande le code d\'invitation ou le lien à ton ami(e) leader. Inscris-toi en tant que "Membre" en utilisant ce code. Tu seras automatiquement ajouté au groupe.',
        },
        {
          q: 'Puis-je changer de groupe ?',
          a: 'Non, une fois dans un groupe, tu y restes pour toute la durée de la compétition. C\'est pour garantir l\'équité du classement. Choisis bien ton groupe avant de t\'inscrire !',
        },
        {
          q: 'Combien de personnes peuvent rejoindre un groupe ?',
          a: 'Aucune limite ! Tu peux créer un groupe avec 5 amis ou 500 collègues d\'entreprise. Le classement interne fonctionne pour toutes les tailles.',
        },
        {
          q: 'Le leader peut-il modifier son groupe ?',
          a: 'Oui, dans l\'onglet "Mon Groupe", le leader peut modifier le nom, la description et le logo de son groupe à tout moment.',
        },
        {
          q: 'Comment supprimer un membre de mon groupe (leader) ?',
          a: `En tant que **leader**, tu peux retirer un membre de ton groupe :

1. Va dans l'onglet **"Mon Groupe"**
2. Dans la liste des membres, à droite de chaque personne (sauf toi), tu verras une icône **🗑️** rouge
3. Clique dessus → une confirmation s'affiche
4. Confirme : la personne est retirée immédiatement

📌 **Ce qui se passe pour le membre retiré** :
- Il passe automatiquement en mode "joueur solo" (plus dans aucun groupe)
- **Tous ses pronostics et points sont conservés** (rien n'est supprimé)
- Il continue de jouer normalement, juste sans ton groupe
- Il peut rejoindre un autre groupe (ou ton groupe à nouveau via le code d'invitation)

⚠️ **Limitations** :
- Tu ne peux pas te retirer toi-même (il faut soit supprimer le groupe, soit contacter l'admin pour transférer le leadership)
- Tu ne peux pas retirer un autre leader (cas rare où il y en aurait plusieurs)

💡 **Bon à savoir** : la personne n'est pas notifiée automatiquement. Si tu retires quelqu'un par erreur, recontacte-la et partage-lui ton lien d'invitation pour qu'elle revienne.`,
        },
        {
          q: 'Je joue en solo, puis-je devenir leader et créer un groupe ?',
          a: `Oui ! Si tu t'es inscrit en mode "Joueur Solo" mais que tu veux maintenant créer ton propre groupe pour inviter tes amis, c'est possible :

1. Va dans l'onglet **Profil**
2. Tu verras une section **"👑 Devenir leader d'un groupe"**
3. Clique sur le bouton **"Devenir leader"** et confirme

Une fois leader, va dans l'onglet **"Mon Groupe"** pour créer ton groupe (nom, logo, description). Tu pourras ensuite inviter tes amis avec ton code d'invitation.

⚠️ **Condition** : tu ne dois PAS déjà être membre d'un autre groupe (les groupes sont verrouillés pendant la compétition pour garantir l'équité du classement). Cette option est donc réservée aux joueurs solo non-rattachés à un groupe.

📌 Note : tes pronostics et points déjà saisis sont conservés. Tu garderas ton historique en passant leader.`,
        },
      ],
    },
    {
      category: '💬 Communication',
      icon: '💬',
      items: [
        {
          q: 'Comment contacter le support ?',
          a: 'Tu as 2 options : (1) Si tu es connecté, clique sur le bouton 💬 flottant en bas à droite pour démarrer une conversation directe avec l\'équipe. (2) Si tu n\'es pas connecté, utilise le bouton ✉️ Contact en haut.',
        },
        {
          q: 'Comment fonctionne la chat-box ?',
          a: 'Le chat est intégré au site. Tu poses ta question, on te répond et tu reçois la réponse directement dans l\'app (pas par mail). Un badge rouge 🔴 s\'affiche sur le bouton 💬 quand tu as un nouveau message.',
        },
        {
          q: 'Vais-je recevoir un email de notification ?',
          a: 'Non, les réponses du support arrivent directement dans le chat de l\'app. Tu verras une bulle apparaître avec un aperçu, et le titre de l\'onglet va clignoter pour t\'avertir.',
        },
        {
          q: 'Puis-je désactiver le son des notifications ?',
          a: 'Oui, ouvre la chat-box et clique sur l\'icône 🔔 dans l\'en-tête pour la transformer en 🔕. La préférence est mémorisée.',
        },
      ],
    },
    {
      category: '🏆 Classement',
      icon: '🏆',
      items: [
        {
          q: 'Comment fonctionne le classement des groupes ?',
          a: 'Le classement des groupes utilise une formule équilibrée : Score = Moyenne par membre × (1 + log10(membres actifs)). Cette formule récompense à la fois la performance moyenne du groupe ET son engagement collectif. Un petit groupe ultra-performant peut donc battre un gros groupe peu actif. Les groupes avec moins de 2 membres actifs sont exclus du classement. Détails complets dans l\'onglet "🏆 Groupes".',
        },
        {
          q: 'À quelle fréquence le classement est mis à jour ?',
          a: 'Le classement est mis à jour automatiquement dès qu\'un résultat de match est enregistré. La mise à jour est instantanée pour toi et les autres membres du groupe.',
        },
        {
          q: 'Existe-t-il un classement global tous groupes confondus ?',
          a: 'Oui, l\'onglet "Classement" affiche le top 10 général tous joueurs confondus. Tu y vois aussi ton propre rang. Le classement par groupe est dans l\'onglet "Mon Groupe".',
        },
        {
          q: 'Que se passe-t-il en cas d\'égalité de points ?',
          a: 'En cas d\'égalité parfaite, les joueurs sont départagés par : (1) nombre de scores exacts trouvés, (2) date d\'inscription (le plus ancien en premier).',
        },
        {
          q: 'Y a-t-il des récompenses pour les premiers ?',
          a: 'Pour l\'instant, c\'est juste pour le fun et la fierté ! Mais certains groupes (entreprises, amis) organisent leurs propres récompenses. À toi de motiver tes proches !',
        },
      ],
    },
    {
      category: '⚙️ Mon compte',
      icon: '⚙️',
      items: [
        {
          q: 'Comment changer mon mot de passe ?',
          a: 'Va dans l\'onglet "Mon Profil" puis clique sur "Changer le mot de passe". Tu devras entrer ton mot de passe actuel pour confirmer.',
        },
        {
          q: 'Comment changer la langue du site ?',
          a: 'Clique sur le drapeau en haut à droite pour switcher entre FR 🇫🇷, EN 🇬🇧 et ES 🇪🇸. Ton choix est mémorisé dans ton profil.',
        },
        {
          q: 'Puis-je personnaliser mon profil ?',
          a: 'Oui, dans l\'onglet "Mon Profil", tu peux : ajouter un avatar (photo), écrire une courte bio, et choisir le thème (clair/sombre).',
        },
        {
          q: 'Comment supprimer mon compte ?',
          a: 'Contacte le support via la chat-box 💬 pour demander la suppression de ton compte. Tes données seront supprimées sous 7 jours conformément au RGPD.',
        },
        {
          q: 'J\'ai oublié mon mot de passe',
          a: 'Sur l\'écran de connexion, clique sur "Mot de passe oublié ?". Tu recevras un email avec un lien pour le réinitialiser. Si tu ne reçois rien, vérifie tes spams ou contacte le support.',
        },
      ],
    },
    {
      category: '❓ Divers',
      icon: '❓',
      items: [
        {
          q: 'Mes données sont-elles en sécurité ?',
          a: 'Oui, nous prenons la sécurité très au sérieux : connexion HTTPS, mots de passe hashés (impossibles à voir même par nous), serveurs hébergés en Allemagne (Hetzner). Aucune donnée n\'est revendue à des tiers.',
        },
        {
          q: 'Le site fait-il du tracking publicitaire ?',
          a: 'Non, aucune publicité ni tracking commercial. On utilise Google Analytics avec anonymisation d\'IP pour comprendre l\'audience générale (nombre de visiteurs, pages vues), mais aucune donnée personnelle n\'est partagée.',
        },
        {
          q: 'Comment soutenir United Pronos ?',
          a: 'Si tu kiffes le site, tu peux faire un don ☕ via Ko-fi ou Stripe (en haut à droite). 100% des dons servent à payer le serveur et maintenir le site gratuit pour tous.',
        },
        {
          q: 'Vous êtes basés où ?',
          a: 'Le projet est porté par un développeur indépendant français, passionné de foot. Le serveur est hébergé en Allemagne (RGPD). Aucune entreprise derrière, juste du fait-maison avec amour ❤️',
        },
        {
          q: 'Je veux proposer une amélioration ou signaler un bug',
          a: 'Contacte-nous via la chat-box 💬 ! Toutes les suggestions sont étudiées, et les bugs sont prioritaires. Plus tu donnes de détails (capture d\'écran, étapes pour reproduire), plus on peut résoudre vite.',
        },
        {
          q: 'Y aura-t-il d\'autres compétitions après la Coupe du Monde ?',
          a: 'Probablement ! Si le site fonctionne bien pendant le Mondial 2026, on pourrait étendre à l\'Euro 2028, la Coupe d\'Afrique, etc. Reste connecté !',
        },
      ],
    },
  ],
  en: [
    {
      category: '🎯 Getting started',
      icon: '🎯',
      items: [
        {
          q: 'How do I create an account?',
          a: 'Click "Sign up" in the top right corner. You can choose between 3 modes: Solo Player (play alone), Leader (create a group with friends/colleagues), or Member (join an existing group). Registration is 100% free.',
        },
        {
          q: 'Is the site really free?',
          a: 'Yes, completely free. No subscription, no ads, no in-app purchases. United Pronos lives only through voluntary donations from users who want to support the project.',
        },
        {
          q: 'Do I need to download an app?',
          a: 'No, the site works directly in your browser on desktop and mobile. You can add it to your home screen for quick access ("Add to home screen" option in your browser).',
        },
        {
          q: 'Can I try without signing up?',
          a: 'Yes! Click "Continue as guest" to explore the site, see matches, rankings and news. To make predictions, you\'ll need to create an account (still free).',
        },
      ],
    },
    {
      category: '📊 Making predictions',
      icon: '📊',
      items: [
        {
          q: 'Until when can I submit or change my prediction?',
          a: `You can submit or change your prediction **up to 5 minutes before kick-off**.

⏰ **Why 5 minutes and not right at kick-off?**
- Safety: avoids last-second predictions that arrive after the match starts
- Clock drift: your browser may be a few seconds out of sync with the server

⚠️ **Concretely**:
- D-1 (day before): you can predict freely
- 1h before: still a good time
- 30 min before: an orange badge appears "⏰ Only XX min left to predict!"
- 5 min before: **inputs are greyed out**, no more changes possible
- During the match: locked
- After the match: your points are calculated automatically

💡 **Tip**: submit your predictions in advance to avoid forgetting in the rush!`,
        },
        {
          q: 'How do predictions work?',
          a: 'For each match, you predict the exact score (e.g., 2-1). You can modify your prediction up to 5 minutes before kick-off. Once that deadline passes, your predictions are locked.',
        },
        {
          q: 'How are points calculated?',
          a: 'Exact score (e.g., 2-1 predicted, 2-1 actual) = 5 points. Right winner + right goal difference (e.g., 3-2 actual, 2-1 predicted) = 3 points. Right winner only = 1 point. Wrong prediction = 0 points.',
        },
        {
          q: 'What is AI prediction?',
          a: 'It\'s our algorithm that calculates the probability of each result based on FIFA ranking, team history and current form. You can use it for inspiration but AI doesn\'t always predict well!',
        },
        {
          q: 'Can I see other people\'s predictions?',
          a: 'No, predictions remain private until kickoff. After kickoff, your group members\' predictions become visible.',
        },
        {
          q: 'What happens with extra time or penalties?',
          a: 'The score considered is the one at the end of regular time (90 minutes + stoppage time), not after extra time or penalties. Standard FIFA rule.',
        },
      ],
    },
    {
      category: '👥 Groups and competition',
      icon: '👥',
      items: [
        {
          q: 'How do I create a group?',
          a: 'Sign up as "Leader" to create your group. You can customize the name, add a logo, and invite friends/colleagues with a unique invite code or direct link.',
        },
        {
          q: 'How do I invite friends or colleagues to join my group?',
          a: `You have 3 ways to invite people to your group:

1. **Share the direct link** (easiest) : Go to the "My Group" tab where you'll find your invitation link in the format "unitedpronos.com/join/YOURCODE". Click "Copy link" and share it via WhatsApp, SMS, Slack, Teams, Discord or email. The person who clicks lands directly on the signup page with your group pre-selected.

2. **Share just the code** : If you prefer, you can share only the code (also visible in "My Group", for example "ABC123"). Your friends click "Sign up" → "Join a group" → enter the code → they're in your group.

3. **Verbally** : you can dictate the code to someone over the phone, they just need to type it during signup.

💡 Tip: copy-paste this template message for quick invites:
"Hey! I'm running a free predictions contest for the 2026 World Cup, join me: https://unitedpronos.com/join/YOURCODE — Free signup, 30 seconds, no ads!"`,
        },
        {
          q: 'Where can I find my invitation code and link?',
          a: 'If you are a group leader: log in and go to the "My Group" tab (at the top). You\'ll see an "Invitation link" block with the full link to copy and the invitation code below. The code never changes, you can share it as many times as you want.',
        },
        {
          q: 'How do I join an existing group?',
          a: 'Ask your leader friend for the invite code or link. Sign up as "Member" using this code. You\'ll be automatically added to the group.',
        },
        {
          q: 'Can I switch groups?',
          a: 'No, once in a group, you stay there for the entire competition. This ensures fair rankings. Choose your group carefully before signing up!',
        },
        {
          q: 'How many people can join a group?',
          a: 'No limit! You can create a group with 5 friends or 500 colleagues. The internal ranking works for all sizes.',
        },
        {
          q: 'Can the leader modify their group?',
          a: 'Yes, in the "My Group" tab, the leader can modify the name, description and logo of their group at any time.',
        },
        {
          q: 'How do I remove a member from my group (as leader)?',
          a: `As **leader**, you can remove a member from your group:

1. Go to the **"My Group"** tab
2. In the members list, next to each person (except you), you'll see a red **🗑️** icon
3. Click it → a confirmation pops up
4. Confirm: the person is removed immediately

📌 **What happens to the removed member**:
- They automatically switch to "solo player" mode (no group)
- **All their predictions and points are preserved** (nothing is deleted)
- They continue playing normally, just without your group
- They can join another group (or yours again via the invitation code)

⚠️ **Limitations**:
- You cannot remove yourself (you must either delete the group or contact admin to transfer leadership)
- You cannot remove another leader (rare case where there'd be multiple)

💡 **Good to know**: the person is not automatically notified. If you remove someone by mistake, reach out to them and share your invitation link so they can come back.`,
        },
        {
          q: 'I play solo, can I become a leader and create a group?',
          a: `Yes! If you signed up in "Solo Player" mode but now want to create your own group to invite friends, it's possible:

1. Go to the **Profile** tab
2. You'll see a section **"👑 Become a group leader"**
3. Click the **"Become a leader"** button and confirm

Once a leader, go to the **"My Group"** tab to create your group (name, logo, description). You'll then be able to invite friends with your invitation code.

⚠️ **Condition**: you must NOT already be a member of another group (groups are locked during the competition to ensure fair rankings). This option is therefore reserved for solo players not attached to a group.

📌 Note: your already saved predictions and points are preserved. You'll keep your history when switching to leader.`,
        },
      ],
    },
    {
      category: '💬 Communication',
      icon: '💬',
      items: [
        {
          q: 'How do I contact support?',
          a: 'You have 2 options: (1) If you\'re logged in, click the floating 💬 button at the bottom right to start a direct conversation with the team. (2) If not logged in, use the ✉️ Contact button at the top.',
        },
        {
          q: 'How does the chatbox work?',
          a: 'Chat is integrated into the site. You ask your question, we reply and you receive the response directly in the app (not by email). A red 🔴 badge appears on the 💬 button when you have a new message.',
        },
        {
          q: 'Will I receive notification emails?',
          a: 'No, support responses arrive directly in the in-app chat. You\'ll see a bubble appear with a preview, and the tab title will flash to alert you.',
        },
        {
          q: 'Can I disable notification sounds?',
          a: 'Yes, open the chatbox and click the 🔔 icon in the header to switch it to 🔕. The preference is saved.',
        },
      ],
    },
    {
      category: '🏆 Rankings',
      icon: '🏆',
      items: [
        {
          q: 'How does the groups ranking work?',
          a: 'The groups ranking uses a balanced formula: Score = Average per member × (1 + log10(active members)). It rewards both individual performance AND collective engagement. A small high-performing group can beat a large inactive one. Groups with fewer than 2 active members are excluded. Full details in the "🏆 Groups" tab.',
        },
        {
          q: 'How often is the ranking updated?',
          a: 'The ranking is updated automatically as soon as a match result is recorded. The update is instant for you and other group members.',
        },
        {
          q: 'Is there a global ranking across all groups?',
          a: 'Yes, the "Ranking" tab shows the overall top 10 across all players. You also see your own rank. Group-specific ranking is in the "My Group" tab.',
        },
        {
          q: 'What happens in case of a tie?',
          a: 'In case of a perfect tie, players are ranked by: (1) number of exact scores found, (2) registration date (oldest first).',
        },
        {
          q: 'Are there rewards for the winners?',
          a: 'For now, it\'s just for fun and pride! But some groups (companies, friends) organize their own rewards. Up to you to motivate your friends!',
        },
      ],
    },
    {
      category: '⚙️ My account',
      icon: '⚙️',
      items: [
        {
          q: 'How do I change my password?',
          a: 'Go to "My Profile" tab and click "Change password". You\'ll need to enter your current password to confirm.',
        },
        {
          q: 'How do I change the site language?',
          a: 'Click the flag in the top right corner to switch between FR 🇫🇷, EN 🇬🇧 and ES 🇪🇸. Your choice is saved in your profile.',
        },
        {
          q: 'Can I customize my profile?',
          a: 'Yes, in "My Profile" tab, you can: add an avatar (photo), write a short bio, and choose the theme (light/dark).',
        },
        {
          q: 'How do I delete my account?',
          a: 'Contact support via the 💬 chatbox to request account deletion. Your data will be deleted within 7 days in accordance with GDPR.',
        },
        {
          q: 'I forgot my password',
          a: 'On the login screen, click "Forgot password?". You\'ll receive an email with a link to reset it. If you don\'t receive anything, check your spam or contact support.',
        },
      ],
    },
    {
      category: '❓ Miscellaneous',
      icon: '❓',
      items: [
        {
          q: 'Is my data safe?',
          a: 'Yes, we take security very seriously: HTTPS connection, hashed passwords (we can\'t even see them), servers hosted in Germany (Hetzner). No data is sold to third parties.',
        },
        {
          q: 'Does the site do advertising tracking?',
          a: 'No, no ads or commercial tracking. We use Google Analytics with IP anonymization to understand general audience (visitor count, page views), but no personal data is shared.',
        },
        {
          q: 'How can I support United Pronos?',
          a: 'If you love the site, you can donate ☕ via Ko-fi or Stripe (top right). 100% of donations pay for the server and keep the site free for everyone.',
        },
        {
          q: 'Where are you based?',
          a: 'The project is run by an independent French developer, football enthusiast. Server hosted in Germany (GDPR). No company behind, just homemade with love ❤️',
        },
        {
          q: 'I want to suggest an improvement or report a bug',
          a: 'Contact us via the 💬 chatbox! All suggestions are studied, and bugs are priority. The more details you give (screenshot, steps to reproduce), the faster we can fix.',
        },
        {
          q: 'Will there be other competitions after the World Cup?',
          a: 'Probably! If the site works well during the 2026 World Cup, we could extend to Euro 2028, Africa Cup, etc. Stay tuned!',
        },
      ],
    },
  ],
  es: [
    {
      category: '🎯 Empezar',
      icon: '🎯',
      items: [
        {
          q: '¿Cómo creo una cuenta?',
          a: 'Haz clic en "Registrarse" en la esquina superior derecha. Puedes elegir entre 3 modos: Jugador Solo (jugar solo), Líder (crear un grupo con amigos/colegas), o Miembro (unirse a un grupo existente). El registro es 100% gratuito.',
        },
        {
          q: '¿El sitio es realmente gratis?',
          a: 'Sí, totalmente gratis. Sin suscripción, sin anuncios, sin compras integradas. United Pronos vive solo gracias a las donaciones voluntarias de los usuarios que quieren apoyar el proyecto.',
        },
        {
          q: '¿Necesito descargar una aplicación?',
          a: 'No, el sitio funciona directamente en tu navegador en ordenador y móvil. Puedes añadirlo a tu pantalla de inicio para acceso rápido (opción "Añadir a pantalla de inicio" en tu navegador).',
        },
        {
          q: '¿Puedo probar sin registrarme?',
          a: '¡Sí! Haz clic en "Continuar como invitado" para explorar el sitio, ver partidos, clasificación y noticias. Para hacer pronósticos, deberás crear una cuenta (siempre gratis).',
        },
      ],
    },
    {
      category: '📊 Hacer pronósticos',
      icon: '📊',
      items: [
        {
          q: '¿Hasta cuándo puedo enviar o modificar mi pronóstico?',
          a: `Puedes enviar o modificar tu pronóstico **hasta 5 minutos antes del inicio del partido**.

⏰ **¿Por qué 5 minutos y no justo al inicio?**
- Seguridad: evita pronósticos enviados en el último segundo que llegan después del inicio
- Desfase de reloj: tu navegador puede tener unos segundos de diferencia con el servidor

⚠️ **En concreto**:
- D-1 (día antes): puedes pronosticar libremente
- 1h antes: aún es buen momento
- 30 min antes: aparece una insignia naranja "⏰ ¡Solo XX min para pronosticar!"
- 5 min antes: **los campos se bloquean**, ya no hay cambios posibles
- Durante el partido: bloqueado
- Después del partido: tus puntos se calculan automáticamente

💡 **Consejo**: ¡envía tus pronósticos con antelación para no olvidar en el último momento!`,
        },
        {
          q: '¿Cómo funcionan los pronósticos?',
          a: 'Para cada partido, predices el resultado exacto (ej: 2-1). Puedes modificar tu pronóstico hasta 5 minutos antes del inicio del partido. Pasado ese plazo, tus predicciones se bloquean.',
        },
        {
          q: '¿Cómo se calculan los puntos?',
          a: 'Resultado exacto (ej: 2-1 pronosticado y real) = 5 puntos. Ganador correcto + diferencia correcta (ej: 3-2 real, 2-1 pronosticado) = 3 puntos. Solo ganador correcto = 1 punto. Pronóstico incorrecto = 0 puntos.',
        },
        {
          q: '¿Qué es la predicción IA?',
          a: 'Es nuestro algoritmo que calcula la probabilidad de cada resultado basándose en el ranking FIFA, historial de equipos y forma actual. ¡Puedes usarlo como inspiración pero la IA no siempre predice bien!',
        },
        {
          q: '¿Puedo ver los pronósticos de otros?',
          a: 'No, los pronósticos permanecen privados hasta el inicio del partido. Después del inicio, los pronósticos de los miembros de tu grupo se vuelven visibles.',
        },
        {
          q: '¿Qué pasa con prórroga o penaltis?',
          a: 'El resultado considerado es al final del tiempo reglamentario (90 minutos + tiempo añadido), no después de prórroga o penaltis. Regla estándar FIFA.',
        },
      ],
    },
    {
      category: '👥 Grupos y competición',
      icon: '👥',
      items: [
        {
          q: '¿Cómo creo un grupo?',
          a: 'Regístrate como "Líder" para crear tu grupo. Puedes personalizar el nombre, añadir logo, e invitar amigos/colegas con un código de invitación único o enlace directo.',
        },
        {
          q: '¿Cómo invito a amigos o colegas para que se unan a mi grupo?',
          a: `Tienes 3 formas de invitar personas a tu grupo:

1. **Comparte el enlace directo** (lo más fácil) : Ve a la pestaña "Mi Grupo" donde encontrarás tu enlace de invitación con el formato "unitedpronos.com/join/TUCODIGO". Haz clic en "Copiar enlace" y compártelo por WhatsApp, SMS, Slack, Teams, Discord o email. La persona que haga clic llegará directamente a la página de registro con tu grupo ya seleccionado.

2. **Comparte solo el código** : Si lo prefieres, puedes compartir solo el código (también visible en "Mi Grupo", por ejemplo "ABC123"). Tus amigos hacen clic en "Registrarse" → "Unirse a un grupo" → ingresan el código → están en tu grupo.

3. **Verbalmente** : puedes dictar el código a alguien por teléfono, solo necesita escribirlo durante el registro.

💡 Truco: copia-pega este mensaje tipo para invitar rápidamente:
"¡Hola! Estoy organizando un concurso gratis de pronósticos para el Mundial 2026, únete: https://unitedpronos.com/join/TUCODIGO — Registro gratis, 30 segundos, ¡sin publicidad!"`,
        },
        {
          q: '¿Dónde encuentro mi código y enlace de invitación?',
          a: 'Si eres líder de un grupo: inicia sesión y ve a la pestaña "Mi Grupo" (arriba). Verás un bloque "Enlace de invitación" con el enlace completo para copiar y el código de invitación debajo. El código nunca cambia, puedes compartirlo todas las veces que quieras.',
        },
        {
          q: '¿Cómo me uno a un grupo existente?',
          a: 'Pide el código de invitación o enlace a tu amigo líder. Regístrate como "Miembro" usando este código. Serás añadido automáticamente al grupo.',
        },
        {
          q: '¿Puedo cambiar de grupo?',
          a: 'No, una vez en un grupo, te quedas durante toda la competición. Esto garantiza rankings justos. ¡Elige bien tu grupo antes de registrarte!',
        },
        {
          q: '¿Cuántas personas pueden unirse a un grupo?',
          a: '¡Sin límite! Puedes crear un grupo con 5 amigos o 500 colegas. El ranking interno funciona para todos los tamaños.',
        },
        {
          q: '¿El líder puede modificar su grupo?',
          a: 'Sí, en la pestaña "Mi Grupo", el líder puede modificar nombre, descripción y logo de su grupo en cualquier momento.',
        },
        {
          q: '¿Cómo elimino a un miembro de mi grupo (como líder)?',
          a: `Como **líder**, puedes quitar a un miembro de tu grupo:

1. Ve a la pestaña **"Mi Grupo"**
2. En la lista de miembros, junto a cada persona (excepto tú), verás un icono **🗑️** rojo
3. Haz clic → aparece una confirmación
4. Confirma: la persona es eliminada inmediatamente

📌 **Qué pasa con el miembro eliminado**:
- Pasa automáticamente a modo "jugador solo" (sin grupo)
- **Todos sus pronósticos y puntos se conservan** (no se elimina nada)
- Sigue jugando normalmente, solo sin tu grupo
- Puede unirse a otro grupo (o al tuyo de nuevo con el código de invitación)

⚠️ **Limitaciones**:
- No puedes eliminarte a ti mismo (debes eliminar el grupo o contactar al admin para transferir el liderazgo)
- No puedes eliminar a otro líder (caso raro donde haya varios)

💡 **Bueno saber**: la persona no recibe notificación automática. Si quitas a alguien por error, contáctala y compártele tu enlace de invitación para que regrese.`,
        },
        {
          q: 'Juego en solo, ¿puedo convertirme en líder y crear un grupo?',
          a: `¡Sí! Si te registraste en modo "Jugador Solo" pero ahora quieres crear tu propio grupo para invitar a tus amigos, es posible:

1. Ve a la pestaña **Perfil**
2. Verás una sección **"👑 Convertirse en líder de un grupo"**
3. Haz clic en el botón **"Convertirse en líder"** y confirma

Una vez líder, ve a la pestaña **"Mi Grupo"** para crear tu grupo (nombre, logo, descripción). Luego podrás invitar a tus amigos con tu código de invitación.

⚠️ **Condición**: NO debes ser ya miembro de otro grupo (los grupos están bloqueados durante la competición para garantizar la equidad del ranking). Esta opción está por tanto reservada a los jugadores solo no vinculados a un grupo.

📌 Nota: tus pronósticos y puntos ya guardados se conservan. Mantendrás tu historial al cambiar a líder.`,
        },
      ],
    },
    {
      category: '💬 Comunicación',
      icon: '💬',
      items: [
        {
          q: '¿Cómo contacto con soporte?',
          a: 'Tienes 2 opciones: (1) Si estás conectado, haz clic en el botón flotante 💬 abajo a la derecha para iniciar una conversación directa con el equipo. (2) Si no estás conectado, usa el botón ✉️ Contacto arriba.',
        },
        {
          q: '¿Cómo funciona el chat?',
          a: 'El chat está integrado en el sitio. Haces tu pregunta, te respondemos y recibes la respuesta directamente en la app (no por email). Un badge rojo 🔴 aparece en el botón 💬 cuando tienes un mensaje nuevo.',
        },
        {
          q: '¿Recibiré emails de notificación?',
          a: 'No, las respuestas de soporte llegan directamente al chat de la app. Verás una burbuja aparecer con una vista previa, y el título de la pestaña parpadeará para avisarte.',
        },
        {
          q: '¿Puedo desactivar el sonido de notificaciones?',
          a: 'Sí, abre el chat y haz clic en el icono 🔔 en el encabezado para cambiarlo a 🔕. La preferencia se guarda.',
        },
      ],
    },
    {
      category: '🏆 Clasificación',
      icon: '🏆',
      items: [
        {
          q: '¿Cómo funciona la clasificación de grupos?',
          a: 'La clasificación de grupos usa una fórmula equilibrada: Puntuación = Promedio por miembro × (1 + log10(miembros activos)). Recompensa tanto el rendimiento medio como el compromiso colectivo. Un grupo pequeño de alto rendimiento puede vencer a uno grande poco activo. Se excluyen los grupos con menos de 2 miembros activos. Detalles completos en la pestaña "🏆 Grupos".',
        },
        {
          q: '¿Con qué frecuencia se actualiza la clasificación?',
          a: 'La clasificación se actualiza automáticamente en cuanto se registra un resultado de partido. La actualización es instantánea para ti y otros miembros del grupo.',
        },
        {
          q: '¿Hay una clasificación global de todos los grupos?',
          a: 'Sí, la pestaña "Clasificación" muestra el top 10 general de todos los jugadores. También ves tu propio rango. La clasificación por grupo está en la pestaña "Mi Grupo".',
        },
        {
          q: '¿Qué pasa en caso de empate?',
          a: 'En caso de empate perfecto, los jugadores se ordenan por: (1) número de resultados exactos encontrados, (2) fecha de registro (más antiguo primero).',
        },
        {
          q: '¿Hay recompensas para los ganadores?',
          a: 'Por ahora, ¡es solo por diversión y orgullo! Pero algunos grupos (empresas, amigos) organizan sus propias recompensas. ¡Depende de ti motivar a tus amigos!',
        },
      ],
    },
    {
      category: '⚙️ Mi cuenta',
      icon: '⚙️',
      items: [
        {
          q: '¿Cómo cambio mi contraseña?',
          a: 'Ve a la pestaña "Mi Perfil" y haz clic en "Cambiar contraseña". Deberás introducir tu contraseña actual para confirmar.',
        },
        {
          q: '¿Cómo cambio el idioma del sitio?',
          a: 'Haz clic en la bandera en la esquina superior derecha para cambiar entre FR 🇫🇷, EN 🇬🇧 y ES 🇪🇸. Tu elección se guarda en tu perfil.',
        },
        {
          q: '¿Puedo personalizar mi perfil?',
          a: 'Sí, en la pestaña "Mi Perfil", puedes: añadir un avatar (foto), escribir una bio corta, y elegir el tema (claro/oscuro).',
        },
        {
          q: '¿Cómo elimino mi cuenta?',
          a: 'Contacta con soporte vía el chat 💬 para solicitar la eliminación. Tus datos se eliminarán en 7 días según RGPD.',
        },
        {
          q: 'Olvidé mi contraseña',
          a: 'En la pantalla de login, haz clic en "¿Olvidaste tu contraseña?". Recibirás un email con un enlace para restablecerla. Si no recibes nada, revisa spam o contacta soporte.',
        },
      ],
    },
    {
      category: '❓ Varios',
      icon: '❓',
      items: [
        {
          q: '¿Mis datos están seguros?',
          a: 'Sí, nos tomamos la seguridad muy en serio: conexión HTTPS, contraseñas hasheadas (ni siquiera nosotros podemos verlas), servidores alojados en Alemania (Hetzner). No se venden datos a terceros.',
        },
        {
          q: '¿El sitio hace tracking publicitario?',
          a: 'No, sin anuncios ni tracking comercial. Usamos Google Analytics con anonimización de IP para entender la audiencia general (visitantes, páginas vistas), pero no se comparten datos personales.',
        },
        {
          q: '¿Cómo puedo apoyar a United Pronos?',
          a: 'Si te encanta el sitio, puedes donar ☕ vía Ko-fi o Stripe (arriba a la derecha). El 100% de las donaciones pagan el servidor y mantienen el sitio gratis para todos.',
        },
        {
          q: '¿Dónde están ubicados?',
          a: 'El proyecto está llevado por un desarrollador francés independiente, apasionado del fútbol. Servidor alojado en Alemania (RGPD). Sin empresa detrás, hecho a mano con amor ❤️',
        },
        {
          q: 'Quiero sugerir una mejora o reportar un bug',
          a: '¡Contáctanos vía el chat 💬! Todas las sugerencias se estudian, y los bugs son prioritarios. Cuantos más detalles des (captura, pasos para reproducir), más rápido podemos arreglar.',
        },
        {
          q: '¿Habrá otras competiciones después del Mundial?',
          a: '¡Probablemente! Si el sitio funciona bien durante el Mundial 2026, podríamos extender a la Eurocopa 2028, Copa África, etc. ¡Mantente atento!',
        },
      ],
    },
  ],
}


export function FAQTab() {
  const { lang } = useTranslation()
  const [search, setSearch] = useState('')
  const [openItems, setOpenItems] = useState(new Set())

  const faqData = FAQ_DATA[lang] || FAQ_DATA.fr

  // Filtre par recherche
  const filteredData = useMemo(() => {
    if (!search.trim()) return faqData
    const q = search.toLowerCase()
    return faqData.map(category => ({
      ...category,
      items: category.items.filter(item =>
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q)
      ),
    })).filter(category => category.items.length > 0)
  }, [faqData, search])

  // Compteur total de questions
  const totalQuestions = useMemo(
    () => faqData.reduce((acc, cat) => acc + cat.items.length, 0),
    [faqData]
  )
  const filteredQuestions = useMemo(
    () => filteredData.reduce((acc, cat) => acc + cat.items.length, 0),
    [filteredData]
  )

  const toggleItem = (key) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Si recherche active, ouvre tout par défaut pour montrer les résultats
  const isItemOpen = (key) => {
    if (search.trim()) return true
    return openItems.has(key)
  }

  // Textes localisés
  const labels = {
    fr: {
      title: 'Foire Aux Questions',
      subtitle: `Tout ce qu'il faut savoir sur United Pronos en ${totalQuestions} questions`,
      search: '🔍 Rechercher une question...',
      noResults: 'Aucune question ne correspond à ta recherche',
      noResultsHelp: 'Essaie avec d\'autres mots-clés, ou contacte-nous via 💬',
      resultsCount: (n) => `${n} question${n > 1 ? 's' : ''} trouvée${n > 1 ? 's' : ''}`,
      stillQuestion: 'Tu n\'as pas trouvé ta réponse ?',
      contactUs: 'Contacte-nous via la chat-box 💬',
    },
    en: {
      title: 'Frequently Asked Questions',
      subtitle: `Everything you need to know about United Pronos in ${totalQuestions} questions`,
      search: '🔍 Search a question...',
      noResults: 'No question matches your search',
      noResultsHelp: 'Try other keywords, or contact us via 💬',
      resultsCount: (n) => `${n} question${n > 1 ? 's' : ''} found`,
      stillQuestion: 'Couldn\'t find your answer?',
      contactUs: 'Contact us via the chat-box 💬',
    },
    es: {
      title: 'Preguntas Frecuentes',
      subtitle: `Todo lo que necesitas saber sobre United Pronos en ${totalQuestions} preguntas`,
      search: '🔍 Buscar una pregunta...',
      noResults: 'Ninguna pregunta coincide con tu búsqueda',
      noResultsHelp: 'Prueba con otras palabras, o contáctanos vía 💬',
      resultsCount: (n) => `${n} pregunta${n > 1 ? 's' : ''} encontrada${n > 1 ? 's' : ''}`,
      stillQuestion: '¿No encontraste tu respuesta?',
      contactUs: 'Contáctanos vía el chat 💬',
    },
  }
  const L = labels[lang] || labels.fr

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-cta-500 to-cta-600 bg-clip-text text-transparent mb-2">
          {L.title}
        </h1>
        <p className="text-white/60">{L.subtitle}</p>
      </div>

      {/* Barre de recherche */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={L.search}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base focus:outline-none focus:border-sport-400/50 focus:bg-white/10 transition"
        />
        {search && (
          <div className="text-sm text-white/60 mt-2 px-1">
            {L.resultsCount(filteredQuestions)}
          </div>
        )}
      </div>

      {/* Aucun résultat */}
      {filteredData.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🤔</div>
          <p className="text-white/70 mb-2">{L.noResults}</p>
          <p className="text-sm text-white/50">{L.noResultsHelp}</p>
        </div>
      )}

      {/* Catégories */}
      <div className="space-y-6">
        {filteredData.map((category, catIdx) => (
          <div key={catIdx}>
            <h2 className="text-xl font-bold mb-3 text-white/90">
              {category.category}
            </h2>
            <div className="space-y-2">
              {category.items.map((item, itemIdx) => {
                const key = `${catIdx}-${itemIdx}`
                const isOpen = isItemOpen(key)
                return (
                  <div
                    key={key}
                    className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-sport-400/30 transition"
                  >
                    <button
                      onClick={() => toggleItem(key)}
                      className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-white/5 transition"
                      aria-expanded={isOpen}
                    >
                      <span className="font-semibold text-white/90 flex-1">
                        {item.q}
                      </span>
                      <span className={`text-sport-400 text-xl flex-shrink-0 transition-transform ${
                        isOpen ? 'rotate-45' : ''
                      }`}>
                        +
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-0 text-sm text-white/70 leading-relaxed border-t border-white/5">
                        <div className="pt-3 space-y-2">
                          {/* Rendu enrichi : supporte sauts de ligne et **gras** Markdown.
                              Sécurisé car on découpe d'abord par \n\n, puis on rend les **bold**
                              en React (pas de dangerouslySetInnerHTML, donc pas de XSS). */}
                          {item.a.split('\n\n').map((paragraph, pIdx) => {
                            // Parse le markdown gras : **texte** → <strong>texte</strong>
                            // Découpe en segments alternant texte normal / texte gras
                            const parts = paragraph.split(/(\*\*[^*]+\*\*)/g)
                            return (
                              <p key={pIdx} className="whitespace-pre-line">
                                {parts.map((part, idx) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={idx} className="text-white/90 font-semibold">{part.slice(2, -2)}</strong>
                                  }
                                  return <span key={idx}>{part}</span>
                                })}
                              </p>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer : invitation au contact */}
      <div className="mt-12 p-6 bg-gradient-to-br from-sport-500/10 to-sport-600/10 border border-sport-400/30 rounded-xl text-center">
        <p className="text-white/80 mb-2">{L.stillQuestion}</p>
        <p className="text-sm text-white/60">{L.contactUs}</p>
      </div>
    </div>
  )
}
