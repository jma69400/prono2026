# 🚀 Guide de déploiement — PRONO 2026

3 façons de mettre PRONO 2026 en ligne. Choisis selon ton budget et ton profil.

---

## 📊 Comparatif rapide

| Plateforme | Prix | Setup | Difficulté | Best for |
|---|---|---|---|---|
| **Hetzner Cloud** | 4,50 €/mois | 30 min | ⭐⭐⭐ | Production sérieuse |
| **Railway** | ~7-10 $/mois | 5 min | ⭐ | Zéro maintenance |
| **Fly.io** | 0 € (free tier) | 15 min | ⭐⭐ | Test perso, < 50 users |

---

## 🥇 Option 1 — Hetzner Cloud (recommandé)

### Étape 1 — Créer le serveur

1. Inscris-toi sur https://www.hetzner.com/cloud (~50 € de crédit gratuits via parrainage)
2. **Add Server** → choisis :
   - Location : **Falkenstein** ou **Nuremberg** (Allemagne, RGPD-friendly)
   - Image : **Ubuntu 24.04**
   - Type : **CX22** (4,50 €/mois — 2 vCPU, 4 GB RAM)
   - SSH Key : ajoute la tienne (sinon Hetzner t'envoie un mot de passe par mail)
3. Clique **Create & Buy now**

Tu reçois l'IP du serveur en ~30 secondes.

### Étape 2 — Connexion SSH + setup Docker

```bash
# Depuis ton PC
ssh root@<ip-du-serveur>

# Mise à jour système
apt update && apt upgrade -y

# Installer Docker (procédure officielle)
curl -fsSL https://get.docker.com | sh

# Tester
docker --version
docker compose version
```

### Étape 3 — Déploiement de PRONO 2026

```bash
# Cloner le projet (ou scp depuis ton PC)
cd /opt
git clone <ton-repo> prono2026
cd prono2026

# Copier la config et l'éditer
cp .env.example .env
nano .env
```

**Dans `.env`, configure au minimum** :

```bash
# Génère un secret robuste sur ton PC :
# python3 -c "import secrets; print(secrets.token_urlsafe(64))"
JWT_SECRET=ICI_TA_CLE_DE_64_CARACTERES_ALEATOIRE

# Tes liens de don
DONATION_STRIPE_LINK=https://buy.stripe.com/xxxxx
DONATION_PAYPAL_LINK=https://paypal.me/tonpseudo
DONATION_KOFI_LINK=https://ko-fi.com/tonpseudo
```

### Étape 4 — Pointer ton domaine

Chez ton registrar (OVH, Namecheap, Gandi...), ajoute un **A record** :
- Nom : `@` (ou `prono2026`)
- Valeur : l'IP du serveur Hetzner
- TTL : 300

### Étape 5 — Configurer Caddy pour HTTPS auto

Édite **`deploy/caddy/Caddyfile`** et remplace `prono2026.fr` par ton domaine :
```
prono2026.fr, www.prono2026.fr {
    encode gzip
    reverse_proxy frontend:80
}
```

### Étape 6 — Lancer la stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

⏱️ Premier build : ~3-5 minutes.

🎉 **C'est en ligne !** Va sur `https://ton-domaine.fr` — Caddy gère automatiquement le certificat Let's Encrypt.

### Étape 7 — Configurer le firewall

```bash
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable
```

### Vérifier que tout fonctionne

```bash
# État des containers
docker compose -f docker-compose.prod.yml ps

# Logs en temps réel
docker compose -f docker-compose.prod.yml logs -f backend

# Healthcheck
curl https://ton-domaine.fr/api/health
```

---

## 🥈 Option 2 — Railway (le plus simple)

Railway déploie automatiquement à chaque `git push`. Idéal si tu veux zéro maintenance.

### Étape 1 — Préparer le code

Pousse ton projet sur GitHub (ou GitLab/Bitbucket).

### Étape 2 — Créer le projet Railway

1. Va sur https://railway.app et connecte-toi avec GitHub
2. **New Project** → **Deploy from GitHub repo** → sélectionne `prono2026`
3. Railway détecte le `Dockerfile`. Tu vas créer **2 services** :

#### Service 1 — Backend
- **Root Directory** : `/backend`
- **Variables** (onglet Variables) :
  ```
  JWT_SECRET=<génère une clé>
  DONATION_STRIPE_LINK=https://buy.stripe.com/xxxxx
  DONATION_PAYPAL_LINK=https://paypal.me/tonpseudo
  DONATION_KOFI_LINK=https://ko-fi.com/tonpseudo
  CORS_ORIGINS=https://prono2026.up.railway.app
  ```
- **Volume** (onglet Volumes) : monte un volume sur `/app/data` (taille 1 GB suffit)
- **Generate Domain** → tu obtiens `prono2026-backend.up.railway.app`

#### Service 2 — Frontend
- **New Service** → même repo, **Root Directory** : `/frontend`
- **Variables** :
  ```
  VITE_API_URL=https://prono2026-backend.up.railway.app/api
  ```
- **Generate Domain** → tu obtiens `prono2026.up.railway.app`

### Étape 3 — Domaine personnalisé (optionnel)

Settings → Domains → Custom Domain → ajoute `prono2026.fr`. Railway te donne un CNAME à configurer.

### Coûts Railway
- 5 $/mois de crédit inclus
- Au-delà : ~0,000463 $/min de RAM (~7-10 $/mois pour PRONO 2026)
- **Pas de carte bancaire requise pour le tier gratuit** (limité à 5 $/mois)

---

## 🥉 Option 3 — Fly.io (gratuit jusqu'à un certain trafic)

Free tier : 3 VMs partagées 256 MB chacune. Suffisant pour un usage perso.

### Étape 1 — Installer Fly CLI

```bash
# Sur Mac/Linux
curl -L https://fly.io/install.sh | sh

# Sur Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

### Étape 2 — Login + créer le compte

```bash
fly auth signup
# Ou si déjà inscrit :
fly auth login
```

### Étape 3 — Déployer le backend

```bash
cd backend

# Copier la config Fly fournie
cp ../deploy/fly/backend.fly.toml ./fly.toml

# Première fois : créer l'app et le volume
fly launch --no-deploy   # Réponds "no" aux questions, le toml est déjà fait
fly volumes create prono_data --size 1 --region cdg

# Configurer les secrets
fly secrets set JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')"
fly secrets set DONATION_STRIPE_LINK="https://buy.stripe.com/xxxxx"
fly secrets set DONATION_PAYPAL_LINK="https://paypal.me/tonpseudo"
fly secrets set DONATION_KOFI_LINK="https://ko-fi.com/tonpseudo"
fly secrets set CORS_ORIGINS="https://prono2026.fly.dev"

# Déployer
fly deploy
```

### Étape 4 — Déployer le frontend

```bash
cd ../frontend
cp ../deploy/fly/frontend.fly.toml ./fly.toml

# Édite fly.toml et remplace VITE_API_URL par ton URL backend Fly
# (ex: https://prono2026-backend.fly.dev/api)

fly launch --no-deploy
fly deploy
```

### Étape 5 — Domaine custom (optionnel)

```bash
fly certs add prono2026.fr
# Suis les instructions pour configurer les DNS
```

### Limites Fly.io free tier
- 3 VMs maximum (256 MB chacune)
- 3 GB de stockage persistant
- 160 GB de bande passante/mois
- Si tu dépasses → ~2 $/mois par VM additionnelle

---

## 💰 Configurer les dons

Le bouton **"☕ Soutenir"** apparaît dans le header dès qu'au moins un lien est configuré.

### Stripe — recommandé pour les dons réguliers

1. Va sur https://dashboard.stripe.com/payment-links → **Nouveau lien**
2. Type : **Don**, montants suggérés : 2 €, 5 €, 10 €, 20 €
3. Active "Permettre au client de choisir le montant"
4. Copie l'URL : `https://buy.stripe.com/xxxxx`
5. Mets dans `.env` ou variables Railway/Fly : `DONATION_STRIPE_LINK=...`

**Frais Stripe** : 1,5 % + 0,25 € par transaction.

### PayPal — pour les utilisateurs déjà sur PayPal

1. Active **PayPal.me** : https://paypal.me/
2. Choisis ton pseudo (ex: `tonpseudo`)
3. Mets : `DONATION_PAYPAL_LINK=https://paypal.me/tonpseudo`

**Frais PayPal** : 1,9 % + 0,35 € par transaction.

### Ko-fi — le plus simple, sans frais

1. Inscris-toi sur https://ko-fi.com (gratuit)
2. Récupère ton lien : `https://ko-fi.com/tonpseudo`
3. Mets : `DONATION_KOFI_LINK=https://ko-fi.com/tonpseudo`

**Frais Ko-fi** : 0 % (Ko-fi prend une marge sur PayPal/Stripe utilisé pour la transaction, mais toi tu reçois 100 %).

---

## 🛡️ Checklist sécurité production

- [ ] **`JWT_SECRET`** est aléatoire 64+ caractères
- [ ] **HTTPS** activé (Caddy auto, Railway auto, Fly auto)
- [ ] **Firewall** : seuls les ports 80/443 ouverts
- [ ] **Mot de passe admin changé** : crée ton compte, supprime `admin@prono26.com`
- [ ] **Backups DB** : cron quotidien (Hetzner) ou volume Railway (auto)
- [ ] **CORS_ORIGINS** correctement configuré (uniquement ton domaine)
- [ ] **Mises à jour OS** activées (`unattended-upgrades` sur Hetzner)

---

## 🔄 Mise à jour en production

### Hetzner
```bash
ssh root@serveur
cd /opt/prono2026
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Railway
Push sur GitHub → Railway redéploie automatiquement.

### Fly.io
```bash
cd backend && fly deploy
cd ../frontend && fly deploy
```

---

## 💾 Backup de la base de données

### Hetzner
```bash
# Cron quotidien à 3h du matin
echo '0 3 * * * docker compose -f /opt/prono2026/docker-compose.prod.yml exec -T backend cp /app/data/prono2026.db /app/data/backup-$(date +\%Y\%m\%d).db' | crontab -
```

### Railway
Les volumes Railway sont sauvegardés automatiquement. Tu peux aussi exporter via l'UI.

### Fly.io
```bash
fly ssh console
cp /app/data/prono2026.db /app/data/backup-$(date +%Y%m%d).db
exit

# Télécharger en local
fly ssh sftp get /app/data/prono2026.db
```

---

## 🆘 Dépannage

### "ERESOLVE" pendant le build npm
Ton `package.json` doit avoir des versions exactes (sans `^`). C'est déjà le cas dans le projet.

### "Permission denied" sur le volume Docker
```bash
docker compose down
sudo chown -R 1000:1000 /var/lib/docker/volumes/prono2026_prono_data/_data
docker compose up -d
```

### Le backend ne voit pas les variables d'environnement
Vérifier qu'elles sont bien dans `.env` (pas `.env.local`) et que docker-compose les a chargées :
```bash
docker compose config | grep -A 5 environment
```

### CORS errors dans la console navigateur
Ajoute ton domaine à `CORS_ORIGINS` dans `.env` :
```
CORS_ORIGINS=https://prono2026.fr,https://www.prono2026.fr
```
Puis : `docker compose up -d backend`

### Les news ne se traduisent plus
Tu as dépassé le quota MyMemory (50 000 caractères/jour). Solutions :
- Attendre 24h
- Ou intégrer DeepL/Google Translate (clé API requise) — demande-moi si tu veux

---

## 📞 Support

Si quelque chose plante :
1. Regarde les logs : `docker compose logs -f`
2. Vérifie que la DB est bien dans le volume : `docker volume ls | grep prono`
3. Vérifie les variables d'env : `docker compose config`

Bonne chance pour le lancement ! 🏆
