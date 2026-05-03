# 🧪 Test local & push GitHub — PRONO 2026

Guide étape par étape pour : (1) tester une dernière fois en local, (2) pousser sur GitHub.

---

## ✅ Étape 1 — Test local

### Option A : Avec Docker (recommandé, le plus représentatif de la prod)

```bash
# Place-toi à la racine du projet
cd prono2026

# Configure ton .env (juste une fois)
cp .env.example .env

# Édite .env et change au moins JWT_SECRET
# Sur Windows : ouvre .env avec Notepad++
# Sur Mac/Linux : nano .env
```

Génère un `JWT_SECRET` solide :

**Sur Windows PowerShell** :
```powershell
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

**Sur Mac/Linux** :
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

Copie le résultat dans `.env` :
```
JWT_SECRET=<la_clé_générée>
```

Puis lance Docker :
```bash
docker compose up -d --build
```

⏱️ Premier build : ~3-5 minutes.

→ Ouvre **http://localhost** dans ton navigateur.

**Vérifie que tout fonctionne** :
- [ ] La HomePage s'affiche
- [ ] Bouton "Continuer en visiteur" → tu vois les matchs
- [ ] Bouton FR / EN / ES → la langue change partout
- [ ] Bouton "Connexion" → écran de login
- [ ] Login `admin@prono26.com` / `admin123` → tu vois l'onglet Admin
- [ ] Onglet Matchs → 104 matchs (groupes + bracket)
- [ ] Clic sur un match → IA propose un score, tu peux pronostiquer
- [ ] Onglet Actualités → des news arrivent (attendre ~30 sec après le démarrage)
- [ ] Onglet Classement → tu vois ton compte

**Pour arrêter** :
```bash
docker compose down
```

**Pour tout réinitialiser (DB + secrets)** :
```bash
docker compose down -v
```

### Option B : Sans Docker

**Backend** (terminal 1) :
```bash
cd backend
python -m venv venv
# Mac/Linux
source venv/bin/activate
# Windows
venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (terminal 2) :
```bash
cd frontend
npm install
npm run dev
```

→ http://localhost:5173

---

## 🐙 Étape 2 — Push sur GitHub

### 2.1 — Crée ton compte GitHub (si pas encore fait)

Va sur https://github.com/signup — c'est gratuit.

### 2.2 — Installe Git (si pas encore fait)

**Windows** : https://git-scm.com/download/win
**Mac** : `brew install git` ou installe Xcode Command Line Tools
**Linux** : `sudo apt install git`

Vérifie :
```bash
git --version
```

### 2.3 — Configure Git (une seule fois)

```bash
git config --global user.name "Ton Nom"
git config --global user.email "ton@email.com"
```

### 2.4 — Crée un nouveau repo sur GitHub

1. Va sur https://github.com/new
2. **Repository name** : `prono2026`
3. **Description** : "Site de pronostics pour la Coupe du Monde 2026"
4. Choisis **Private** (privé) ou **Public** selon ta préférence
5. ⚠️ **Ne coche PAS** "Add a README", "Add .gitignore", "Add a license" — on a déjà tout
6. Clique **Create repository**

GitHub te montre une page avec des commandes. **Garde cet onglet ouvert.**

### 2.5 — Initialise Git dans ton projet local

Dans ton dossier `prono2026/` :

```bash
cd prono2026

# Initialise un repo git local
git init

# Vérifie ce qui sera ajouté
git status
```

> ⚠️ **Vérifie que `.env` n'apparaît PAS** dans la liste. Si oui, c'est que `.gitignore` n'est pas bien configuré. Dans ce cas vérifie que le fichier `.gitignore` existe à la racine et contient bien `.env`.

### 2.6 — Premier commit

```bash
# Ajoute tous les fichiers (sauf ceux du .gitignore)
git add .

# Vérifie une dernière fois
git status

# Premier commit
git commit -m "🎉 Initial commit — PRONO 2026 v1.0"
```

### 2.7 — Lie ton repo local à GitHub

Sur la page GitHub que tu as gardée ouverte, copie l'URL du repo (genre `https://github.com/tonpseudo/prono2026.git`).

```bash
# Lie ton repo local au repo GitHub
git remote add origin https://github.com/tonpseudo/prono2026.git

# Renomme la branche par défaut en "main"
git branch -M main

# Pousse le code sur GitHub
git push -u origin main
```

GitHub va te demander de t'authentifier. **N'utilise PAS ton mot de passe GitHub** — il faut un **Personal Access Token (PAT)** :

1. Va sur https://github.com/settings/tokens/new
2. **Note** : "Mon ordi"
3. **Expiration** : 90 days (ou plus)
4. **Scopes** : coche `repo` (toutes les sous-options)
5. Clique **Generate token**
6. **COPIE LE TOKEN** (il commence par `ghp_...`) — tu ne le verras plus jamais
7. Quand Git te demande le password, **colle ce token** à la place

### 2.8 — Vérification

Va sur `https://github.com/tonpseudo/prono2026` — tu dois voir tous tes fichiers !

**Sauf** :
- ❌ `.env` (pas pushé, c'est normal — il contient tes secrets)
- ❌ `node_modules/` (pas pushé)
- ❌ `venv/` (pas pushé)
- ❌ `prono2026.db` et `.jwt_secret` (pas pushés)

✅ Tu dois voir :
- `backend/`, `frontend/`, `deploy/`
- Les `Dockerfile`, `docker-compose*.yml`
- Le `README.md` qui s'affiche en bas
- `.env.example` (sans tes vrais secrets)

---

## 🔄 Étape 3 — Workflow de développement

Maintenant chaque fois que tu modifies du code :

```bash
# Voir ce qui a changé
git status

# Ajouter les modifs
git add .

# Commit avec un message descriptif
git commit -m "Description courte de ce que tu as changé"

# Pousser sur GitHub
git push
```

**Bonnes pratiques** :
- 1 commit = 1 changement logique (pas 50 modifs en vrac)
- Messages au présent : "Ajoute X", "Corrige Y" (pas "Ajouté")
- Push souvent (1-2 fois par jour minimum)

---

## 🚨 Problèmes courants

### "Permission denied (publickey)"
Tu utilises l'URL SSH au lieu de HTTPS. Solution :
```bash
git remote set-url origin https://github.com/tonpseudo/prono2026.git
```

### "fatal: refusing to merge unrelated histories"
GitHub a déjà un README ou un .gitignore (créé par mégarde). Solution :
```bash
git pull origin main --allow-unrelated-histories
git push
```

### J'ai pushé un fichier sensible (`.env`) par erreur 🆘
1. **Change immédiatement tous les secrets** (JWT_SECRET, mots de passe)
2. Supprime le fichier de l'historique :
```bash
git rm --cached .env
git commit -m "Retire .env de l'historique"
git push
```
3. Pour un nettoyage complet de l'historique : utilise [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

### "fatal: not a git repository"
Tu n'es pas dans le bon dossier. Tape `pwd` (Mac/Linux) ou `cd` (Windows) pour voir où tu es. Tu dois être dans `prono2026/`.

---

## 🎯 Check-list finale avant de pousser

- [ ] Le site fonctionne en local (Docker ou non)
- [ ] Login admin fonctionne
- [ ] Au moins 1 prono peut être saisi
- [ ] Les news se chargent (attendre 30 sec)
- [ ] Le sélecteur FR/EN/ES fonctionne
- [ ] `.env` n'est PAS dans `git status` avant le commit
- [ ] `.gitignore` contient bien `.env`, `node_modules`, `venv`, `*.db`, `.jwt_secret`
- [ ] README.md s'affiche bien sur GitHub après le push
- [ ] Tu peux re-cloner ton repo et le relancer (test ultime)

---

## 🚀 Et après ?

Une fois ton code sur GitHub, tu pourras :
- **Déployer en 1 commande** sur Hetzner / Railway / Fly.io (voir `DEPLOYMENT.md`)
- **Inviter des collaborateurs** sur ton repo
- **Recevoir des bugs reports** via les Issues GitHub
- **Avoir un historique complet** de toutes tes modifs (et pouvoir revenir en arrière)

Bonne chance ! 🏆
