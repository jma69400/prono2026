import { useState, useMemo, useEffect } from 'react'
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
          tag: 'create-account',
          a: 'Clique sur le bouton "S\'inscrire" en haut à droite. Tu peux choisir entre 3 modes : Joueur Solo (jouer seul), Leader (créer un groupe avec tes amis/collègues), ou Membre (rejoindre un groupe existant). L\'inscription est 100% gratuite.',
        },
        {
          q: 'Le site est-il vraiment gratuit ?',
          tag: 'is-free',
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
          tag: 'when-predict',
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
          tag: 'how-predict',
          a: 'Pour chaque match, tu prédis le score exact (ex: 2-1). Tu peux modifier ton pronostic jusqu\'à 5 minutes avant le coup d\'envoi du match. Une fois ce délai passé, tes prédictions sont verrouillées.',
        },
        {
          q: 'Comment sont calculés les points ?',
          tag: 'how-points',
          a: `📊 SCORE PRINCIPAL :
• Score exact (ex: 2-1 et tu as misé 2-1) = 5 points
• Bon vainqueur + bonne différence de buts (ex: 3-2 et tu as misé 2-1) = 3 points
• Bon vainqueur seulement = 1 point
• Mauvaise prédiction = 0 point

🎁 BONUS PRONOS (optionnels, +2 points chacun si correct) :
• Plus/Moins 2,5 buts : tu prédis si le match aura 3 buts ou plus (Plus) ou 2 buts ou moins (Moins)
• Les 2 équipes marquent : tu prédis si les 2 équipes marqueront au moins 1 but

💡 Score maximum par match : 5 + 2 + 2 = 9 points
ℹ️ Les bonus sont FACULTATIFS : si tu ne réponds pas, tu gagnes 0 point sur ce bonus (pas de pénalité).`,
        },
        {
          q: 'Qu\'est-ce que la prédiction IA ?',
          a: 'C\'est notre algorithme qui calcule la probabilité de chaque résultat en se basant sur le classement FIFA, l\'historique des équipes et leur forme actuelle. Tu peux t\'en inspirer mais l\'IA ne fait pas toujours de bonnes prédictions !',
        },
        {
          q: 'Puis-je voir les pronostics des autres membres de mon groupe ?',
          a: `Oui, **dès le coup d'envoi d'un match**, tu peux voir les pronostics de tous les membres de ton groupe pour ce match.

📍 **Où voir ça ?** Onglet **"Mon Groupe"** → section **"Pronostics du groupe"** en bas de la page.

📊 **2 vues disponibles** :
- **Par match** : un tableau qui montre tous les membres en colonnes, chaque match en ligne, et les pronos dans les cellules. Pratique pour comparer rapidement.
- **Par membre** : tu sélectionnes un membre, et tu vois TOUS ses pronos sur les matchs déjà commencés. Pratique pour analyser le style de quelqu'un.

🎨 **Code couleur des pronos** :
- 🟢 **Vert vif (5pt)** : score exact deviné
- 🟢 **Vert clair (3pt)** : bon vainqueur + bonne différence de buts
- 🟡 **Jaune (1pt)** : bon vainqueur seulement
- ⚪ **Gris (0pt)** : prono raté
- 🔵 **Bleu** : match en cours (pas encore de score officiel)
- ❌ **Pointillés** : pas de pronostic posé

🤝 **Règle fair-play stricte** :
Les pronostics ne deviennent visibles **qu'au coup d'envoi du match**. Avant, ils restent **strictement privés**, même pour le leader du groupe. Pourquoi ? Pour éviter que quelqu'un puisse copier le pronostic du meilleur joueur juste avant le verrouillage.`,
        },
        {
          q: 'Pourquoi les scores LIVE ont-ils 5 à 15 minutes de retard ?',
          tag: 'live-delay',
          a: `Notre source de données sportives (Football-Data.org) est **gratuite** et met les scores à jour avec **5 à 15 minutes de délai**.

**Pourquoi ce délai ?**
Les APIs sportives en temps réel coûtent entre 25 et 500 €/mois selon les fournisseurs. Pour rester **100% gratuit pour vous**, nous utilisons une source gratuite qui actualise ses données par lot.

**Est-ce que ça change quelque chose pour mes pronostics ?**
**Non, absolument pas !** Tous les pronostics sont comptabilisés correctement à la fin du match. Le délai n'affecte que l'affichage en direct, pas le scoring.

**Comment savoir le score réel en direct ?**
- 📺 Regarde le match à la TV ou en streaming
- 🌐 Va sur un site spécialisé (L'Équipe, Goal, BeIN Sports...)
- 📱 Active les notifications de ta fédération sportive

**Et si vous payiez une API temps réel ?**
Ça coûterait ~25-50 €/mois pendant le Mondial. Si United Pronos devient suffisamment populaire, on envisagera cet investissement. En attendant, on a fait le choix de la gratuité totale pour tout le monde.

Merci pour votre compréhension ! 🙏`,
        },
        {
          q: 'Que se passe-t-il en cas de prolongations ou tirs au but ?',
          tag: 'extra-time',
          a: 'Le score retenu est celui à la fin du temps réglementaire (90 minutes + arrêts de jeu), pas après prolongations ou tirs au but. C\'est la règle standard FIFA.',
        },
        {
          q: '📱 Comment installer United Pronos comme une vraie application ?',
          tag: 'pwa-install',
          a: `Oui, United Pronos peut s'installer comme une vraie app sur ton smartphone, ta tablette ou ton PC ! C'est **100% gratuit**, ça ne prend que 30 secondes, et tu auras une icône directement sur ton écran d'accueil.

**Pourquoi installer ?**
- ✅ Accès en 1 clic depuis ton écran d'accueil
- ✅ Plein écran (sans la barre du navigateur)
- ✅ Marche même sans connexion pour voir tes données déjà chargées
- ✅ Reçois des notifications de matchs (à venir)
- ✅ Plus rapide qu'ouvrir le navigateur

---

**📱 Sur iPhone / iPad (Safari obligatoire)** :
1. Ouvre **unitedpronos.com** dans **Safari** (important : pas dans Chrome iOS, ça ne marche pas)
2. Touche le bouton **Partager** en bas de l'écran (l'icône carré avec une flèche vers le haut ↗️)
3. Fais défiler vers le bas et touche **"Sur l'écran d'accueil"**
4. Touche **"Ajouter"** en haut à droite
5. ✅ L'icône United Pronos apparait sur ton écran d'accueil comme une app normale !

---

**🤖 Sur Android (Chrome, Firefox, Samsung Internet, etc.)** :
1. Ouvre **unitedpronos.com** dans **Chrome** (ou ton navigateur préféré)
2. Touche les **3 points** en haut à droite ⋮
3. Choisis **"Installer l'application"** ou **"Ajouter à l'écran d'accueil"**
4. Confirme en touchant **"Installer"**
5. ✅ L'icône apparait sur ton écran d'accueil ou ton tiroir d'applications

Astuce : Chrome propose parfois directement une bannière "Installer l'app" en bas de l'écran. Tu peux toucher dessus directement.

---

**💻 Sur PC (Windows, Mac, Linux)** :

**Chrome / Edge / Brave** :
1. Va sur **unitedpronos.com**
2. Dans la barre d'adresse, à droite, tu vois une **icône d'écran avec une flèche ⊕** (ou un + dans un cercle)
3. Clique dessus, puis sur **"Installer"**
4. ✅ United Pronos s'ouvre dans sa propre fenêtre, et une icône est créée dans ton menu Démarrer / Applications

**Firefox** : 
Firefox ne propose pas l'installation directe pour le moment. Tu peux toujours ajouter le site en favori et l'épingler à la barre des tâches.

---

**❓ Tu n'as pas d'icône d'installation ?**

Le navigateur ne propose l'installation que la 1ère fois ou si tu n'as jamais visité le site. Solution :
1. Vide le cache de ton navigateur (Ctrl+Shift+Delete sur PC, ou paramètres → effacer données sur mobile)
2. Re-visite **unitedpronos.com**
3. L'option d'installation devrait réapparaitre

Si ça ne marche toujours pas, écris-nous via le formulaire de contact, on t'aidera !`,
        },
      ],
    },
    {
      category: '👥 Groupes et compétition',
      icon: '👥',
      items: [
        {
          q: 'Comment créer un groupe ?',
          tag: 'create-group',
          a: 'Inscris-toi en tant que "Leader" pour créer ton groupe. Tu pourras personnaliser le nom, ajouter un logo, et inviter tes amis/collègues avec un code d\'invitation unique ou un lien direct.',
        },
        {
          q: 'Comment inviter mes amis ou collègues à rejoindre mon groupe ?',
          tag: 'invite-friends',
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
          tag: 'join-group',
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
          tag: 'contact-support',
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
          tag: 'groups-ranking',
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
          tag: 'delete-account',
          a: 'Contacte le support via la chat-box 💬 pour demander la suppression de ton compte. Tes données seront supprimées sous 7 jours conformément au RGPD.',
        },
        {
          q: 'J\'ai oublié mon mot de passe',
          tag: 'forgot-password',
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
          tag: 'data-safety',
          a: 'Oui, nous prenons la sécurité très au sérieux : connexion HTTPS, mots de passe hashés (impossibles à voir même par nous), serveurs hébergés en Allemagne (Hetzner). Aucune donnée n\'est revendue à des tiers.',
        },
        {
          q: 'Le site fait-il du tracking publicitaire ?',
          a: 'Non, aucune publicité ni tracking commercial. On utilise Google Analytics avec anonymisation d\'IP pour comprendre l\'audience générale (nombre de visiteurs, pages vues), mais aucune donnée personnelle n\'est partagée.',
        },
        {
          q: 'Comment soutenir United Pronos ?',
          tag: 'support-site',
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
          tag: 'create-account',
          a: 'Click "Sign up" in the top right corner. You can choose between 3 modes: Solo Player (play alone), Leader (create a group with friends/colleagues), or Member (join an existing group). Registration is 100% free.',
        },
        {
          q: 'Is the site really free?',
          tag: 'is-free',
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
          tag: 'when-predict',
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
          tag: 'how-predict',
          a: 'For each match, you predict the exact score (e.g., 2-1). You can modify your prediction up to 5 minutes before kick-off. Once that deadline passes, your predictions are locked.',
        },
        {
          q: 'How are points calculated?',
          tag: 'how-points',
          a: `📊 MAIN SCORE:
• Exact score (e.g., 2-1 predicted, 2-1 actual) = 5 points
• Right winner + right goal difference (e.g., 3-2 actual, 2-1 predicted) = 3 points
• Right winner only = 1 point
• Wrong prediction = 0 points

🎁 BONUS PREDICTIONS (optional, +2 points each if correct):
• Over/Under 2.5 goals: predict if the match will have 3+ goals (Over) or 2 or fewer (Under)
• Both teams score: predict if both teams will score at least once

💡 Max score per match: 5 + 2 + 2 = 9 points
ℹ️ Bonuses are OPTIONAL: if you don't pick, you get 0 points on that bonus (no penalty).`,
        },
        {
          q: 'What is AI prediction?',
          a: 'It\'s our algorithm that calculates the probability of each result based on FIFA ranking, team history and current form. You can use it for inspiration but AI doesn\'t always predict well!',
        },
        {
          q: 'Can I see other group members\' predictions?',
          a: `Yes, **as soon as a match kicks off**, you can see the predictions of all members of your group for that match.

📍 **Where?** Tab **"My Group"** → **"Group predictions"** section at the bottom of the page.

📊 **2 views available**:
- **By match**: a table with all members as columns, each match as a row, and predictions in the cells. Useful for quick comparison.
- **By member**: select a member to see ALL their predictions on matches already started. Useful for analyzing someone's style.

🎨 **Color code**:
- 🟢 **Bright green (5pt)**: exact score
- 🟢 **Light green (3pt)**: right winner + right goal difference
- 🟡 **Yellow (1pt)**: right winner only
- ⚪ **Grey (0pt)**: wrong prediction
- 🔵 **Blue**: match in progress (no official score yet)
- ❌ **Dashed**: no prediction submitted

🤝 **Strict fair-play rule**:
Predictions only become visible **at kickoff**. Before that, they remain **strictly private**, even for the group leader. Why? To prevent anyone from copying the top player's prediction just before lock-in.`,
        },
        {
          q: 'Why do LIVE scores have a 5-15 minute delay?',
          tag: 'live-delay',
          a: `Our sports data source (Football-Data.org) is **free** and updates scores with a **5 to 15 minute delay**.

**Why this delay?**
Real-time sports APIs cost between €25 and €500/month depending on the provider. To keep United Pronos **100% free for you**, we use a free source that updates data in batches.

**Does this affect my predictions?**
**Not at all!** All predictions are correctly tallied at the end of the match. The delay only affects the live display, not the scoring.

**How can I know the real-time score?**
- 📺 Watch the match on TV or streaming
- 🌐 Go to a specialized website (ESPN, Goal, Sky Sports...)
- 📱 Enable notifications from your sports federation

Thank you for your understanding! 🙏`,
        },
        {
          q: 'What happens with extra time or penalties?',
          tag: 'extra-time',
          a: 'The score considered is the one at the end of regular time (90 minutes + stoppage time), not after extra time or penalties. Standard FIFA rule.',
        },
        {
          q: '📱 How do I install United Pronos as a real app?',
          tag: 'pwa-install',
          a: `Yes, United Pronos can be installed as a real app on your smartphone, tablet or PC! It's **100% free**, takes only 30 seconds, and you'll have an icon directly on your home screen.

**Why install?**
- ✅ Access in 1 click from your home screen
- ✅ Full screen (no browser bar)
- ✅ Works offline to see your already-loaded data
- ✅ Receive match notifications (coming soon)
- ✅ Faster than opening the browser

---

**📱 On iPhone / iPad (Safari required)**:
1. Open **unitedpronos.com** in **Safari** (important: not Chrome iOS, it won't work)
2. Tap the **Share** button at the bottom of the screen (square icon with arrow ↗️)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right
5. ✅ The United Pronos icon appears on your home screen like a normal app!

---

**🤖 On Android (Chrome, Firefox, Samsung Internet, etc.)**:
1. Open **unitedpronos.com** in **Chrome** (or your preferred browser)
2. Tap the **3 dots** in the top right ⋮
3. Choose **"Install app"** or **"Add to Home screen"**
4. Confirm by tapping **"Install"**
5. ✅ The icon appears on your home screen or app drawer

Tip: Chrome sometimes offers a banner "Install app" at the bottom of the screen. You can tap it directly.

---

**💻 On PC (Windows, Mac, Linux)**:

**Chrome / Edge / Brave**:
1. Go to **unitedpronos.com**
2. In the address bar, on the right, you'll see a **screen icon with arrow ⊕** (or a + in a circle)
3. Click it, then click **"Install"**
4. ✅ United Pronos opens in its own window, and an icon is created in your Start menu / Applications

**Firefox**: Firefox doesn't offer direct installation at the moment. You can still bookmark the site and pin it to your taskbar.

---

**❓ Don't see an install icon?**

The browser only offers installation the first time, or if you've never visited the site. Solution:
1. Clear your browser cache (Ctrl+Shift+Delete on PC, or settings → clear data on mobile)
2. Re-visit **unitedpronos.com**
3. The install option should reappear

If it still doesn't work, write to us via the contact form, we'll help you!`,
        },
      ],
    },
    {
      category: '👥 Groups and competition',
      icon: '👥',
      items: [
        {
          q: 'How do I create a group?',
          tag: 'create-group',
          a: 'Sign up as "Leader" to create your group. You can customize the name, add a logo, and invite friends/colleagues with a unique invite code or direct link.',
        },
        {
          q: 'How do I invite friends or colleagues to join my group?',
          tag: 'invite-friends',
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
          tag: 'join-group',
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
          tag: 'contact-support',
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
          tag: 'groups-ranking',
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
          tag: 'delete-account',
          a: 'Contact support via the 💬 chatbox to request account deletion. Your data will be deleted within 7 days in accordance with GDPR.',
        },
        {
          q: 'I forgot my password',
          tag: 'forgot-password',
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
          tag: 'data-safety',
          a: 'Yes, we take security very seriously: HTTPS connection, hashed passwords (we can\'t even see them), servers hosted in Germany (Hetzner). No data is sold to third parties.',
        },
        {
          q: 'Does the site do advertising tracking?',
          a: 'No, no ads or commercial tracking. We use Google Analytics with IP anonymization to understand general audience (visitor count, page views), but no personal data is shared.',
        },
        {
          q: 'How can I support United Pronos?',
          tag: 'support-site',
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
          tag: 'is-free',
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
          tag: 'how-predict',
          a: 'Para cada partido, predices el resultado exacto (ej: 2-1). Puedes modificar tu pronóstico hasta 5 minutos antes del inicio del partido. Pasado ese plazo, tus predicciones se bloquean.',
        },
        {
          q: '¿Cómo se calculan los puntos?',
          tag: 'how-points',
          a: `📊 PUNTUACIÓN PRINCIPAL:
• Resultado exacto (ej: 2-1 pronosticado y real) = 5 puntos
• Ganador correcto + diferencia correcta (ej: 3-2 real, 2-1 pronosticado) = 3 puntos
• Solo ganador correcto = 1 punto
• Pronóstico incorrecto = 0 puntos

🎁 PRONÓSTICOS BONUS (opcionales, +2 puntos cada uno si correcto):
• Más/Menos 2,5 goles: predice si el partido tendrá 3+ goles (Más) o 2 o menos (Menos)
• Ambos equipos marcan: predice si los 2 equipos marcarán al menos 1 gol

💡 Puntuación máx por partido: 5 + 2 + 2 = 9 puntos
ℹ️ Los bonus son OPCIONALES: si no eliges, ganas 0 puntos en ese bonus (sin penalización).`,
        },
        {
          q: '¿Qué es la predicción IA?',
          a: 'Es nuestro algoritmo que calcula la probabilidad de cada resultado basándose en el ranking FIFA, historial de equipos y forma actual. ¡Puedes usarlo como inspiración pero la IA no siempre predice bien!',
        },
        {
          q: '¿Puedo ver los pronósticos de los demás miembros de mi grupo?',
          a: `Sí, **en cuanto comienza un partido**, puedes ver los pronósticos de todos los miembros de tu grupo para ese partido.

📍 **¿Dónde?** Pestaña **"Mi Grupo"** → sección **"Pronósticos del grupo"** abajo de la página.

📊 **2 vistas disponibles**:
- **Por partido**: una tabla con todos los miembros en columnas, cada partido en una fila, y los pronósticos en las celdas. Útil para comparar rápidamente.
- **Por miembro**: selecciona un miembro para ver TODOS sus pronósticos sobre los partidos ya iniciados. Útil para analizar el estilo de alguien.

🎨 **Código de colores**:
- 🟢 **Verde brillante (5pt)**: resultado exacto adivinado
- 🟢 **Verde claro (3pt)**: ganador correcto + diferencia correcta
- 🟡 **Amarillo (1pt)**: ganador correcto solamente
- ⚪ **Gris (0pt)**: pronóstico fallado
- 🔵 **Azul**: partido en curso (sin resultado oficial todavía)
- ❌ **Punteado**: sin pronóstico

🤝 **Regla de juego limpio estricta**:
Los pronósticos solo se vuelven visibles **al inicio del partido**. Antes, permanecen **estrictamente privados**, incluso para el líder del grupo. ¿Por qué? Para evitar que alguien copie el pronóstico del mejor jugador justo antes del cierre.`,
        },
        {
          q: '¿Por qué los resultados EN VIVO tienen un retraso de 5-15 minutos?',
          tag: 'live-delay',
          a: `Nuestra fuente de datos deportivos (Football-Data.org) es **gratuita** y actualiza los resultados con un **retraso de 5 a 15 minutos**.

**¿Por qué este retraso?**
Las APIs deportivas en tiempo real cuestan entre 25 y 500 €/mes según el proveedor. Para mantener United Pronos **100% gratis para ti**, usamos una fuente gratuita que actualiza los datos por lotes.

**¿Afecta esto a mis pronósticos?**
**¡En absoluto!** Todos los pronósticos se calculan correctamente al final del partido. El retraso solo afecta a la visualización en directo, no a la puntuación.

**¿Cómo saber el resultado en tiempo real?**
- 📺 Mira el partido en TV o streaming
- 🌐 Ve a una web especializada (Marca, AS, ESPN...)
- 📱 Activa las notificaciones de tu federación deportiva

¡Gracias por tu comprensión! 🙏`,
        },
        {
          q: '¿Qué pasa con prórroga o penaltis?',
          tag: 'extra-time',
          a: 'El resultado considerado es al final del tiempo reglamentario (90 minutos + tiempo añadido), no después de prórroga o penaltis. Regla estándar FIFA.',
        },
        {
          q: '📱 ¿Cómo instalo United Pronos como una app de verdad?',
          tag: 'pwa-install',
          a: `¡Sí, United Pronos se puede instalar como una app de verdad en tu móvil, tablet o PC! Es **100% gratis**, solo lleva 30 segundos, y tendrás un icono directamente en tu pantalla de inicio.

**¿Por qué instalar?**
- ✅ Acceso en 1 clic desde tu pantalla de inicio
- ✅ Pantalla completa (sin la barra del navegador)
- ✅ Funciona sin conexión para ver tus datos ya cargados
- ✅ Recibe notificaciones de partidos (próximamente)
- ✅ Más rápido que abrir el navegador

---

**📱 En iPhone / iPad (Safari obligatorio)**:
1. Abre **unitedpronos.com** en **Safari** (importante: no en Chrome iOS, no funciona)
2. Toca el botón **Compartir** abajo de la pantalla (icono cuadrado con flecha ↗️)
3. Desplázate hacia abajo y toca **"Añadir a pantalla de inicio"**
4. Toca **"Añadir"** arriba a la derecha
5. ✅ ¡El icono de United Pronos aparece en tu pantalla de inicio como una app normal!

---

**🤖 En Android (Chrome, Firefox, Samsung Internet, etc.)**:
1. Abre **unitedpronos.com** en **Chrome** (o tu navegador preferido)
2. Toca los **3 puntos** arriba a la derecha ⋮
3. Elige **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**
4. Confirma tocando **"Instalar"**
5. ✅ El icono aparece en tu pantalla de inicio o cajón de apps

Consejo: Chrome a veces ofrece un banner "Instalar app" en la parte inferior de la pantalla. Puedes tocarlo directamente.

---

**💻 En PC (Windows, Mac, Linux)**:

**Chrome / Edge / Brave**:
1. Ve a **unitedpronos.com**
2. En la barra de direcciones, a la derecha, verás un **icono de pantalla con flecha ⊕** (o un + en un círculo)
3. Haz clic ahí, luego en **"Instalar"**
4. ✅ United Pronos se abre en su propia ventana, y se crea un icono en tu menú Inicio / Aplicaciones

**Firefox**: Firefox no ofrece instalación directa por ahora. Puedes guardar el sitio en favoritos y anclarlo a la barra de tareas.

---

**❓ ¿No ves icono de instalación?**

El navegador solo ofrece la instalación la primera vez, o si nunca has visitado el sitio. Solución:
1. Limpia la caché del navegador (Ctrl+Shift+Delete en PC, o ajustes → borrar datos en móvil)
2. Vuelve a visitar **unitedpronos.com**
3. La opción de instalación debería volver a aparecer

Si no funciona, escríbenos por el formulario de contacto, ¡te ayudaremos!`,
        },
      ],
    },
    {
      category: '👥 Grupos y competición',
      icon: '👥',
      items: [
        {
          q: '¿Cómo creo un grupo?',
          tag: 'create-group',
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
          tag: 'join-group',
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
          tag: 'groups-ranking',
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
          tag: 'delete-account',
          a: 'Contacta con soporte vía el chat 💬 para solicitar la eliminación. Tus datos se eliminarán en 7 días según RGPD.',
        },
        {
          q: 'Olvidé mi contraseña',
          tag: 'forgot-password',
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
          tag: 'data-safety',
          a: 'Sí, nos tomamos la seguridad muy en serio: conexión HTTPS, contraseñas hasheadas (ni siquiera nosotros podemos verlas), servidores alojados en Alemania (Hetzner). No se venden datos a terceros.',
        },
        {
          q: '¿El sitio hace tracking publicitario?',
          a: 'No, sin anuncios ni tracking comercial. Usamos Google Analytics con anonimización de IP para entender la audiencia general (visitantes, páginas vistas), pero no se comparten datos personales.',
        },
        {
          q: '¿Cómo puedo apoyar a United Pronos?',
          tag: 'support-site',
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


export function FAQTab({ deepLink, onDeepLinkConsumed }) {
  const { lang } = useTranslation()
  const [search, setSearch] = useState('')
  const [openItems, setOpenItems] = useState(new Set())
  // Item à mettre en surbrillance (highlight orange pendant 3s après scroll)
  const [highlightedKey, setHighlightedKey] = useState(null)

  const faqData = FAQ_DATA[lang] || FAQ_DATA.fr

  // Effet : si un deepLink est passé, trouve la question taggée correspondante,
  // l'ouvre, scrolle dessus, et la met en surbrillance pendant 3 secondes.
  useEffect(() => {
    if (!deepLink) return
    // Cherche dans toutes les catégories
    let foundKey = null
    faqData.forEach((cat, catIdx) => {
      cat.items.forEach((item, itemIdx) => {
        if (item.tag === deepLink && !foundKey) {
          foundKey = `${catIdx}-${itemIdx}`
        }
      })
    })
    if (!foundKey) return

    // Ouvre l'item
    setOpenItems(prev => {
      const next = new Set(prev)
      next.add(foundKey)
      return next
    })
    setHighlightedKey(foundKey)

    // Scroll vers l'élément après un court délai (le temps que React render l'ouverture)
    setTimeout(() => {
      const el = document.getElementById(`faq-item-${foundKey}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 200)

    // Retire la surbrillance après 3 secondes
    const timer = setTimeout(() => {
      setHighlightedKey(null)
      // Notifie le parent que le deep-link a été consommé (pour qu'il puisse le reset)
      if (onDeepLinkConsumed) onDeepLinkConsumed()
    }, 3500)
    return () => clearTimeout(timer)
  }, [deepLink, faqData])

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
                const isHighlighted = highlightedKey === key
                return (
                  <div
                    key={key}
                    id={`faq-item-${key}`}
                    className={`bg-white/5 border rounded-xl overflow-hidden transition-all duration-500 ${
                      isHighlighted
                        ? 'border-orange-400 ring-4 ring-orange-400/40 shadow-lg shadow-orange-500/30 scale-[1.01]'
                        : 'border-white/10 hover:border-sport-400/30'
                    }`}
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
