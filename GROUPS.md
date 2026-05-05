# 👥 Groupes — Guide complet

PRONO 2026 supporte maintenant 3 types de comptes pour s'adapter aux pronostics individuels ou en groupe (entreprises, sociétés, clubs).

---

## 🎭 Les 3 rôles

| Rôle | Description |
|---|---|
| 🏃 **Solo** | Pronostiqueur individuel, joue dans le classement global |
| 👥 **Leader** | Crée et gère un groupe (entreprise, club, équipe) |
| 👑 **Admin** | Toi — accès total : tous les utilisateurs et groupes |

---

## 🚀 Workflow utilisateur

### Solo (le plus simple)
1. Inscription → choix "Pronostiqueur Solo"
2. Pronostique normalement, joue dans le classement global

### Leader (cas pro / groupes d'amis)
1. Inscription → choix "Leader de groupe"
2. Étape suivante : **création du groupe**
   - Nom (ex: "Société Acme", "PSG Fans Club")
   - Logo (upload local, max 500 KB)
   - Description (facultative)
3. Le leader obtient un **lien d'invitation** : `https://unitedpronos.com/join/ABC12345`
4. Il partage ce lien à ses membres

### Membre (rejoint via lien)
1. Reçoit le lien d'invitation
2. Arrive sur une page avec aperçu du groupe (logo, nom, description, nombre de membres)
3. S'inscrit (ou se connecte) → automatiquement rattaché au groupe
4. ⚠️ **Verrouillage à vie** : ne peut pas quitter le groupe sauf si l'admin l'en retire

---

## 🛡️ Règles de sécurité

| Règle | Pourquoi |
|---|---|
| Membre verrouillé dans son groupe | Cas pro/entreprise — évite les défections |
| Seul l'admin peut supprimer un groupe | Évite que les leaders fassent n'importe quoi |
| Seul l'admin peut retirer un membre | Centralisation pour les cas litigieux |
| Le leader ne peut pas se "kick" lui-même | Évite les groupes orphelins |
| Le code d'invitation peut être régénéré (par l'admin) | Si fuite, on coupe l'accès |
| Un user ne peut être que dans **un** groupe à la fois | Logique simple, pas de complications |

---

## 🎨 Personnalisation du groupe

Le leader peut personnaliser :
- ✅ **Nom** (modifiable à tout moment)
- ✅ **Description** (texte court)
- ✅ **Logo** (upload local, JPG/PNG/WebP, max 500 KB)
- 🔒 Code d'invitation (seul l'admin peut le régénérer)

Le **logo apparaît** :
- Sur la page "Mon groupe" du leader
- Dans le **classement global** à côté de chaque membre
- Sur la page d'invitation (`/join/CODE`)
- Dans le panneau admin

---

## 📊 Le classement

**Un seul classement global** où tout le monde apparaît. À côté de chaque utilisateur :
- Son nom
- 🏆 Logo + nom du groupe (s'il en fait partie)
- 👑 Badge "Leader" si c'est le chef d'un groupe

Pas de classement séparé par groupe — tout le monde dans le même classement.

---

## 🔧 Espace Leader (onglet "Mon groupe")

Le leader a accès à un onglet dédié avec :
- Carte du groupe (nom, logo, description, modifiables)
- Code d'invitation + lien copiable en 1 clic
- Liste des membres avec leurs scores
- Bouton "Modifier" pour changer nom/description/logo

---

## 👑 Espace Admin (onglet "Groupes")

L'admin a accès à un nouveau sous-onglet **"👥 Groupes"** dans l'admin avec :
- Liste de **tous les groupes**
- Pour chaque groupe : voir ses membres, retirer un membre
- Bouton **"🔄 Code"** pour régénérer le code d'invitation (utile en cas de fuite)
- Bouton **🗑️** pour supprimer le groupe (les membres redeviennent solo)

---

## 🌐 Routes / URLs

| URL | Comportement |
|---|---|
| `/` | Page d'accueil normale |
| `/join/ABC12345` | Page d'invitation à un groupe |

Quand quelqu'un arrive sur `/join/CODE` :
- **S'il n'est pas connecté** → page d'inscription pré-remplie avec invite
- **S'il est connecté solo et pas dans un groupe** → bouton "Rejoindre"
- **S'il est déjà dans un groupe** → erreur "déjà membre d'un groupe"
- **S'il est leader** → erreur (un leader ne peut pas rejoindre un autre groupe)
- **S'il est admin** → erreur (admin ne fait pas partie de groupes)

---

## 🚦 Migration des comptes existants

Lors du déploiement, les comptes actuels sont **automatiquement migrés** :
- `admin@prono26.com` → reste **admin**
- Tout autre compte (`role='user'`) → devient **`solo`**
- Aucune donnée perdue (pronostics, classement préservés)

La migration est **idempotente** (peut être exécutée plusieurs fois sans risque).

---

## 🎯 Cas d'usage

### 🏢 Entreprise
"Société Acme" : 50 employés font des pronostics ensemble pour la Coupe du Monde.
→ Le RH crée un compte **leader**, configure le logo de l'entreprise.
→ Il envoie le lien d'invitation par email à tous les employés.
→ Chaque employé s'inscrit et rejoint automatiquement le groupe.
→ Tout le monde joue dans le classement global mais le RH a une vue dédiée sur ses 50 collègues.

### 🍻 Groupe d'amis
"Les Potes du Foot" : 10 amis veulent jouer ensemble.
→ Un des amis crée son compte **leader** + son groupe.
→ Il partage le lien WhatsApp à ses potes.
→ Tous se connectent et apparaissent dans le classement avec le logo du groupe.

### 🏃 Pronostiqueur solo
Quelqu'un qui veut juste s'amuser tout seul.
→ Inscription **solo**, c'est tout. Joue dans le classement global avec tout le monde.

---

## 💡 Évolutions possibles (pas implémentées)

- Limite de membres par groupe (actuellement illimité)
- Classement séparé par groupe (actuellement un seul global)
- Plusieurs leaders par groupe (actuellement un seul)
- Groupes privés (actuellement le code suffit)
- Notifications email aux membres (avant chaque match)
- Statistiques avancées du groupe (taux de réussite, etc.)

Demande quand tu veux les implémenter !
