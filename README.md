# 🏆 PRONO 2026

> Site web de pronostics pour la **Coupe du Monde de la FIFA 2026** (USA · Canada · Mexique).
> Prédis les scores, défie tes amis, suis l'actualité des sélections en 3 langues.

![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Languages](https://img.shields.io/badge/langues-FR%20%C2%B7%20EN%20%C2%B7%20ES-green)

---

## ✨ Fonctionnalités

- 📅 **Les 104 matchs du Mondial 2026** — phase de groupes complète + bracket complet (16e → finale)
- 🤖 **IA prédictive style bookmaker** — modèle Dixon-Coles + Monte Carlo (10 000 simulations par match)
- 🏆 **Classement temps réel** — système de scoring (15/8/5/0 pts)
- 👥 **48 équipes**, **12 groupes officiels** (tirage du 5 décembre 2025)
- 📰 **Agrégateur RSS multi-langues** — 10 sources internationales (L'Équipe, BBC, FIFA, Marca…)
- 🌐 **Traduction automatique** des actus en FR/EN/ES (MyMemory)
- 🔒 **Authentification JWT** + Argon2id + audit log
- 👁 **Mode visiteur** — accès public en lecture, inscription requise pour pronostiquer
- 💛 **Système de dons** intégré (Stripe + PayPal + Ko-fi)
- 🐳 **Docker production-ready** avec HTTPS auto via Caddy

---

## 🚀 Démarrage rapide

### En local (Windows / Mac / Linux)

```bash
# 1. Clone le repo
git clone https://github.com/<ton-pseudo>/prono2026.git
cd prono2026

# 2. Lance avec Docker (le plus simple)
docker compose up -d --build
```

→ Site sur **http://localhost** · API sur http://localhost:8000/docs

### Sans Docker (développement)

**Mac / Linux** :
```bash
chmod +x start.sh && ./start.sh
```

**Windows** :
```cmd
start.bat
```

> Ouvre `http://localhost:5173` dans le navigateur.

---

## 👤 Comptes par défaut

| Email | Mot de passe | Rôle |
|---|---|---|
| `admin@prono26.com` | `admin123` | 👑 Admin |
| `demo@prono26.com` | `demo123` | 👤 Utilisateur |

> ⚠️ **Change le mot de passe admin avant de mettre en production !**

---

## 📂 Structure du projet

```
prono2026/
├── 🐳 docker-compose.yml          ← Stack dev local
├── 🐳 docker-compose.prod.yml     ← Stack production avec HTTPS auto
├── 🔐 .env.example                ← Template variables d'environnement
├── 🔐 .gitignore
├── 📚 README.md                   ← (ce fichier)
├── 📚 DEPLOYMENT.md               ← Guide de déploiement Hetzner / Railway / Fly.io
├── 📚 WINDOWS.md                  ← Guide spécifique Windows
│
├── backend/                       ← API Python (port 8000)
│   ├── 🐳 Dockerfile
│   ├── main.py                    ← FastAPI + SQLite + JWT + RSS aggregator
│   └── requirements.txt
│
├── frontend/                      ← App React (port 5173 dev / 80 prod)
│   ├── 🐳 Dockerfile
│   ├── 🌐 nginx.conf              ← Config Nginx prod (proxy /api → backend)
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx                ← Composant principal
│       ├── api.js                 ← Client API
│       ├── i18n.jsx               ← Traductions FR/EN/ES
│       ├── teams.jsx              ← 48 équipes + drapeaux + groupes
│       ├── predictor.js           ← Modèle IA Dixon-Coles + Monte Carlo
│       ├── main.jsx
│       └── index.css
│
├── deploy/                        ← Configurations spécifiques par hébergeur
│   ├── caddy/Caddyfile
│   ├── fly/backend.fly.toml
│   ├── fly/frontend.fly.toml
│   └── railway/railway.json
│
└── start.sh, start.bat, …         ← Scripts de lancement local
```

---

## 🛠️ Stack technique

**Backend**
- FastAPI 0.115 + Uvicorn (Python 3.12)
- SQLite (zéro config, fichier unique)
- Argon2id (passlib) pour le hash des mots de passe
- python-jose pour les tokens JWT
- feedparser pour l'agrégation RSS
- MyMemory API pour la traduction (gratuit, ~50k caractères/jour)

**Frontend**
- React 18 + Vite 5 + Tailwind CSS 3
- lucide-react (icônes)
- Modèle IA : Elo + Poisson + Dixon-Coles + Monte Carlo (côté client)

**Infra**
- Docker + Docker Compose
- Nginx pour le serving + reverse proxy
- Caddy pour HTTPS automatique en production

---

## 🎯 Système de scoring

| Cas | Points |
|---|---|
| Score exact | **15 pts** |
| Bon vainqueur + bon écart de buts | **8 pts** |
| Bon vainqueur (1N2) | **5 pts** |
| Mauvais résultat | **0 pt** |

---

## 🤖 Modèle de prédiction

L'IA utilise le **modèle Dixon-Coles** (Poisson modifié) avec :
- Forces d'attaque/défense par équipe (calibrées sur Elo + résultats récents)
- Coefficient de forme récente
- Avantage du domicile (+10 %)
- Bonus pays hôte pour USA/CAN/MEX (+18 %)
- Correction Dixon-Coles pour les scores serrés (0-0, 1-0, 0-1, 1-1)
- **10 000 simulations Monte Carlo** par match

Sortie : score le plus probable + top 5 scores + probabilités 1X2 + cotes décimales (style bookmaker) + over 2.5 / BTTS.

---

## 🚀 Déploiement en production

Voir **[DEPLOYMENT.md](./DEPLOYMENT.md)** pour le guide complet.

Trois plateformes supportées :
1. **Hetzner Cloud** (4,50 €/mois) — recommandé
2. **Railway** (~7-10 $/mois) — zéro maintenance
3. **Fly.io** (gratuit jusqu'à un certain volume)

---

## 💰 Configurer les dons

Le bouton **"☕ Soutenir"** apparaît dans le header dès qu'au moins un lien de don est configuré.

Édite `.env` :
```bash
DONATION_STRIPE_LINK=https://buy.stripe.com/xxxxx
DONATION_PAYPAL_LINK=https://paypal.me/tonpseudo
DONATION_KOFI_LINK=https://ko-fi.com/tonpseudo
```

Détails dans [DEPLOYMENT.md](./DEPLOYMENT.md#-configurer-les-dons).

---

## 🔒 Sécurité

- Mots de passe hashés Argon2id (winner du Password Hashing Competition)
- JWT signé HS256 avec clé 64+ caractères
- CORS configurable par environnement
- Audit log de toutes les actions admin
- Rate limit doux sur les traductions
- Backend non exposé publiquement en prod (proxifié par Nginx/Caddy)

---

## 📝 API REST

Documentation Swagger auto-générée disponible sur **`/api/docs`** une fois le backend lancé.

Principaux endpoints :

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | non | Inscription |
| POST | `/api/auth/login` | non | Connexion |
| GET | `/api/me` | oui | Profil courant |
| GET | `/api/matches` | non | Tous les matchs |
| GET | `/api/predictions` | oui | Mes pronos |
| POST | `/api/predictions` | oui | Sauvegarder un prono |
| GET | `/api/leaderboard` | non | Classement |
| GET | `/api/news` | non | Actus traduites |
| GET | `/api/config` | non | Config publique (dons activés ?) |
| `*` | `/api/admin/*` | admin | Endpoints admin |

---

## 🧪 Réinitialiser la base

```bash
# Local sans Docker
rm backend/prono2026.db backend/.jwt_secret

# Avec Docker
docker compose down -v
```

---

## 📄 Licence

MIT — fais-en ce que tu veux.

---

## 🙋 FAQ

**Q : Le site marche-t-il sans Internet pour les drapeaux ?**
R : Les drapeaux sont chargés depuis flagcdn.com. Si tu veux du 100 % offline, on peut les embarquer en SVG dans le code.

**Q : Comment ajouter une langue (allemand, italien…) ?**
R : Édite `frontend/src/i18n.jsx` et ajoute un bloc avec ta langue. Pour les noms d'équipes, idem dans `teams.jsx`.

**Q : La traduction des news ne marche plus**
R : Quota MyMemory dépassé (50k caractères/jour). Attendre 24h ou intégrer DeepL/Google Translate.

**Q : Le prono d'un match est verrouillé**
R : Une fois qu'un admin saisit le score réel, les pronos sont verrouillés et les points sont calculés automatiquement.

---

🏆 **Le mondial 2026 démarre le 11 juin 2026 à l'Estadio Azteca (Mexico).**
