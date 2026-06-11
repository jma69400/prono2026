"""
United Pronos — Backend FastAPI complet
Auth JWT + SQLite + agrégateur RSS + scoring temps réel
Lancement : uvicorn main:app --reload --port 8000
"""
import os
import sqlite3
import secrets
import threading
import time
import json
import json as json_lib
import urllib.request
import urllib.parse
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.base import MIMEBase
from email import encoders
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import feedparser
from fastapi import FastAPI, HTTPException, Depends, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

# =====================================================
# CONFIG
# =====================================================
BASE_DIR = Path(__file__).resolve().parent
# Permet de surcharger via env (pour Docker avec volume monté)
DB_PATH = Path(os.environ.get("DB_PATH", BASE_DIR / "prono2026.db"))
SECRET_FILE = Path(os.environ.get("SECRET_FILE", BASE_DIR / ".jwt_secret"))

# JWT_SECRET : priorité à l'env, puis fichier, puis génération
if os.environ.get("JWT_SECRET") and os.environ.get("JWT_SECRET") not in ("change_me_in_production", "change_me_remplace_par_une_cle_aleatoire_de_64_caracteres"):
    JWT_SECRET = os.environ["JWT_SECRET"]
elif SECRET_FILE.exists():
    JWT_SECRET = SECRET_FILE.read_text().strip()
else:
    JWT_SECRET = secrets.token_urlsafe(64)
    SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
    SECRET_FILE.write_text(JWT_SECRET)

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# =====================================================
# CACHE MÉMOIRE (TTL) — pour endpoints chauds
# =====================================================
# Cache simple en RAM avec expiration. Utilisé pour réduire la charge BDD
# sur les endpoints très appelés (leaderboard, leaderboard/groups, matches).
# Avec 100+ utilisateurs simultanés en polling, ça divise par 10-30 le RPS BDD.
#
# Stratégie : invalidation par TTL court (10-30s). Le classement ne change qu'après
# qu'un admin enregistre un score → l'utilisateur voit le résultat dans les 30s max.
import time as _time_mod
import threading as _threading_mod

_cache_store = {}
_cache_lock = _threading_mod.Lock()

def cache_get(key):
    """Récupère une valeur du cache si non expirée, sinon None."""
    with _cache_lock:
        entry = _cache_store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if _time_mod.time() > expires_at:
            # Expiré, on le retire
            _cache_store.pop(key, None)
            return None
        return value

def cache_set(key, value, ttl_seconds):
    """Stocke une valeur en cache avec TTL en secondes."""
    with _cache_lock:
        _cache_store[key] = (value, _time_mod.time() + ttl_seconds)

def cache_invalidate(prefix=""):
    """Invalide les entrées dont la clé commence par prefix (vide = tout)."""
    with _cache_lock:
        if not prefix:
            _cache_store.clear()
        else:
            keys_to_remove = [k for k in _cache_store if k.startswith(prefix)]
            for k in keys_to_remove:
                _cache_store.pop(k, None)


# =====================================================
# DATABASE
# =====================================================
@contextmanager
def get_db():
    # check_same_thread=False : utile pour FastAPI threadpool + acceptable car
    # chaque appel ouvre/ferme sa propre connexion (pas de partage entre threads)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    # === OPTIMISATIONS PERFORMANCE (CPX42 : 16 GB RAM, 8 vCPU) ===
    # WAL (Write-Ahead Logging) : lectures concurrentes sans bloquer les écritures.
    # CRITIQUE pour 100+ utilisateurs simultanés. Sans WAL, chaque lecture verrouille
    # toute la BDD pendant qu'une écriture se fait → temps de réponse en cascade.
    # Le mode WAL est persistant (une fois set, reste actif pour le fichier).
    #
    # IMPORTANT MULTI-WORKER : ces réglages s'appliquent PAR CONNEXION et donc
    # se MULTIPLIENT par le nombre de connexions ouvertes. Avec 4 workers uvicorn
    # × ~10 connexions concurrentes, on peut atteindre 40 connexions. Donc on reste
    # RAISONNABLE pour éviter l'OOM killer Docker :
    # - cache_size: 20 MB par connexion (suffit largement pour ~35 MB de BDD)
    # - mmap_size: 64 MB par connexion (couvre toute la BDD en mmap)
    # - busy_timeout: 30s pour tolérer les pics
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")     # plus rapide, toujours safe en WAL
        conn.execute("PRAGMA cache_size=-20000")      # 20 MB de cache RAM par connexion
        conn.execute("PRAGMA temp_store=MEMORY")      # tables temp en RAM
        conn.execute("PRAGMA mmap_size=67108864")     # 64 MB de mmap par connexion
        conn.execute("PRAGMA busy_timeout=30000")     # 30s d'attente si locked (au lieu d'erreur)
        conn.execute("PRAGMA wal_autocheckpoint=2000") # checkpoint tous les 2000 pages
    except Exception:
        pass  # ne pas crasher si les PRAGMA ne s'appliquent pas (ex: en test)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'solo',
            group_id INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            description TEXT DEFAULT '',
            logo_data TEXT,
            invite_code TEXT UNIQUE NOT NULL,
            leader_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (leader_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            home_team TEXT NOT NULL,
            away_team TEXT NOT NULL,
            match_date TEXT NOT NULL,
            stage TEXT NOT NULL DEFAULT 'group',
            group_letter TEXT,
            stadium TEXT,
            home_score INTEGER,
            away_score INTEGER,
            status TEXT NOT NULL DEFAULT 'scheduled'
        );

        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            match_id INTEGER NOT NULL,
            home_score INTEGER NOT NULL,
            away_score INTEGER NOT NULL,
            points INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(user_id, match_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            ip TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            summary TEXT,
            link TEXT UNIQUE,
            source TEXT NOT NULL,
            team TEXT,
            sentiment TEXT DEFAULT 'neutral',
            published_at TEXT,
            fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
            lang TEXT DEFAULT 'en',
            title_fr TEXT,
            title_en TEXT,
            title_es TEXT,
            summary_fr TEXT,
            summary_en TEXT,
            summary_es TEXT
        );

        CREATE TABLE IF NOT EXISTS contact_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT,
            message TEXT NOT NULL,
            user_id INTEGER,
            ip TEXT,
            user_agent TEXT,
            status TEXT DEFAULT 'new',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
        CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
        CREATE INDEX IF NOT EXISTS idx_news_team ON news(team);
        CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status);
        CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages(created_at DESC);
        """)

    # === MIGRATION : ajouter group_id à la table users si la colonne n'existe pas ===
    with get_db() as db:
        cols = [r["name"] for r in db.execute("PRAGMA table_info(users)").fetchall()]
        if "group_id" not in cols:
            print("[MIGRATION] Ajout de group_id à users")
            db.execute("ALTER TABLE users ADD COLUMN group_id INTEGER")
        # Migration : transformer les anciens 'user' en 'solo'
        db.execute("UPDATE users SET role='solo' WHERE role='user'")
        # Migration : ajouter avatar_data, bio, lang, theme
        if "avatar_data" not in cols:
            print("[MIGRATION] Ajout de avatar_data, bio, lang, theme à users")
            db.execute("ALTER TABLE users ADD COLUMN avatar_data TEXT")
            db.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")
            db.execute("ALTER TABLE users ADD COLUMN lang TEXT DEFAULT 'fr'")
            db.execute("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'")
        # Migration : ajouter last_seen_at (suivi de la dernière activité utilisateur)
        if "last_seen_at" not in cols:
            print("[MIGRATION] Ajout de last_seen_at à users")
            db.execute("ALTER TABLE users ADD COLUMN last_seen_at TEXT")
            # Index pour permettre tri rapide par dernière connexion
            db.execute("CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at)")

    # === MIGRATION : ajouter colonnes admin_reply, replied_at à contact_messages ===
    with get_db() as db:
        contact_cols = {row[1] for row in db.execute("PRAGMA table_info(contact_messages)").fetchall()}
        if "admin_reply" not in contact_cols:
            print("[MIGRATION] Ajout de admin_reply, replied_at à contact_messages")
            db.execute("ALTER TABLE contact_messages ADD COLUMN admin_reply TEXT")
            db.execute("ALTER TABLE contact_messages ADD COLUMN replied_at TEXT")

    # === MIGRATION : créer tables conversations et conversation_messages (chat-box) ===
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                subject TEXT DEFAULT '',
                status TEXT DEFAULT 'open',
                unread_user INTEGER DEFAULT 0,
                unread_admin INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_message_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS conversation_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                sender TEXT NOT NULL,
                content TEXT NOT NULL,
                attachments TEXT DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_conv_status ON conversations(status)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_conv_msg ON conversation_messages(conversation_id)")

    # === MIGRATION : créer table password_reset_tokens (reset password) ===
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_reset_expires ON password_reset_tokens(expires_at)")

    # === MIGRATION : table donations (pour le compteur de supporters) ===
    # Stocke les utilisateurs qui ont déclaré avoir fait un don (auto-déclaration).
    # Choix conscient : on NE stocke PAS de montants, juste l'identité du supporter
    # pour reconnaître les contributeurs avec un badge ❤️.
    # Note : on ne peut pas tracker automatiquement les paiements Ko-fi/Stripe sans
    # configurer leurs webhooks ; on permet donc à l'utilisateur de se déclarer
    # supporter après don. Un admin peut valider/invalider via le panel admin.
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS donations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount_eur REAL,
                provider TEXT,
                declared_at TEXT DEFAULT CURRENT_TIMESTAMP,
                verified INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_donations_user ON donations(user_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_donations_verified ON donations(verified)")

    # === Table KOP UNITED : chat communautaire global ===
    # Tous les utilisateurs connectés peuvent y poster.
    # Modération par filtre de mots interdits côté serveur avant insertion.
    # Soft-delete via flag is_deleted pour audit/historique (au lieu de DELETE)
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS kop_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                is_deleted INTEGER DEFAULT 0,
                deleted_by INTEGER,
                deleted_reason TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
            )
        """)
        # Index optimisés pour les requêtes principales :
        # - Listing récent : ORDER BY created_at DESC LIMIT N
        # - Anti-flood : count des messages d'un user dans la dernière minute
        db.execute("CREATE INDEX IF NOT EXISTS idx_kop_created ON kop_messages(created_at DESC)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_kop_user_created ON kop_messages(user_id, created_at DESC)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_kop_deleted ON kop_messages(is_deleted)")

    # === Index APRÈS la migration (pour éviter "no such column: group_id") ===
    with get_db() as db:
        db.execute("CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_groups_invite ON groups(invite_code)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_groups_leader ON groups(leader_id)")
        # === Index ajoutés pour optimisation 100+ utilisateurs simultanés ===
        # idx_users_role : accélère le filtre "WHERE u.role != 'admin'" du leaderboard
        # idx_predictions_points : accélère le SUM/aggregations du leaderboard
        # idx_matches_date : accélère le ORDER BY match_date du /api/matches (le plus appelé)
        # idx_matches_status : accélère les filtres "scheduled"/"finished"
        db.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_predictions_points ON predictions(points)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_predictions_user_match ON predictions(user_id, match_id)")
        # === Index ajoutés pour /api/snapshot et requêtes leaderboard récurrentes ===
        # Composite (group_id, id) : accélère le LEFT JOIN groups dans /api/leaderboard
        db.execute("CREATE INDEX IF NOT EXISTS idx_users_group_id ON users(group_id, id)")
        # Donations verified : utilisé dans le EXISTS() du leaderboard (badge supporter)
        db.execute("CREATE INDEX IF NOT EXISTS idx_donations_user_verified ON donations(user_id, verified)")
        # PRAGMA optimize : SQLite réanalyse les stats des tables pour optimiser le query planner
        # Recommandé après ajout d'index ou de gros volumes de données
        db.execute("PRAGMA optimize")

    # === MIGRATION : dates des matchs en UTC officielles FIFA ===
    # Mise à jour conservatrice :
    # - Identifie chaque match par (home_team, away_team)
    # - Met à jour ses dates/stades sans toucher aux pronos liés
    # - Tag les matchs déjà migrés via une table `_meta` pour ne le faire qu'une fois
    # - RÉSILIENT : si wc2026_schedule.py manque (ex: Dockerfile pas à jour),
    #   on log un warning mais on ne fait PAS crasher le backend
    with get_db() as db:
        # Crée une table meta pour tracer les migrations one-shot
        db.execute("""
            CREATE TABLE IF NOT EXISTS _meta_migrations (
                key TEXT PRIMARY KEY,
                applied_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        already = db.execute(
            "SELECT 1 FROM _meta_migrations WHERE key='match_dates_utc_v2_official'"
        ).fetchone()

        if not already:
            try:
                from wc2026_schedule import ALL_MATCHES, GROUP_MATCHES
                print("[MIGRATION v2] Reconstruction complète du calendrier officiel FIFA")

                # === STRATÉGIE v2 ===
                # On identifie les matchs existants par (group_letter, position chronologique)
                # plutôt que par (home, away) car les équipes peuvent être fausses dans la BDD.
                # Pour chaque groupe, on trie les matchs par date et on UPDATE en ordre.

                from collections import defaultdict
                # Groupe les nouveaux matchs officiels par lettre, en ordre chronologique
                new_by_group = defaultdict(list)
                for m in GROUP_MATCHES:
                    h, a, d, s, g, st = m
                    new_by_group[g].append((h, a, d, st))
                # Trie chaque groupe par date pour stabilité
                for g in new_by_group:
                    new_by_group[g].sort(key=lambda x: x[2])

                updated, not_found = 0, 0

                # Pour chaque groupe, récupère les matchs existants en BDD (triés par date)
                # et les UPDATE position par position
                for g_letter, new_matches in new_by_group.items():
                    existing = db.execute(
                        "SELECT id FROM matches WHERE group_letter=? ORDER BY id",
                        (g_letter,)
                    ).fetchall()
                    if len(existing) != len(new_matches):
                        print(f"[MIGRATION v2] ⚠️ Groupe {g_letter}: {len(existing)} matchs en BDD vs {len(new_matches)} attendus")
                    # On remappe les N premiers (ou tous si moins en BDD)
                    for i, ex in enumerate(existing[:len(new_matches)]):
                        h, a, d, st = new_matches[i]
                        db.execute(
                            "UPDATE matches SET home_team=?, away_team=?, match_date=?, stadium=?, stage='group', group_letter=? "
                            "WHERE id=?",
                            (h, a, d, st, g_letter, ex["id"])
                        )
                        updated += 1

                # Pour les knockouts : juste mettre à jour les dates/stades (sans toucher aux équipes
                # qui sont des placeholders type R32_73)
                for h, a, d, s, g, st in ALL_MATCHES:
                    if s == 'group':
                        continue  # déjà fait
                    result = db.execute(
                        "UPDATE matches SET match_date=?, stadium=?, stage=? "
                        "WHERE home_team=? OR (home_team LIKE ? AND stage=?)",
                        (d, st, s, h, h.split('_')[0] + '%', s)
                    )
                    if result.rowcount > 0:
                        updated += 1
                    else:
                        not_found += 1

                db.execute(
                    "INSERT INTO _meta_migrations (key) VALUES ('match_dates_utc_v2_official')"
                )
                print(f"[MIGRATION v2] ✓ {updated} matchs mis à jour, {not_found} knockouts non trouvés")
            except ModuleNotFoundError as e:
                # Le fichier wc2026_schedule.py n'est pas dans le container Docker.
                # On NE marque PAS la migration comme appliquée → elle sera retentée au prochain démarrage.
                print(f"[MIGRATION] ⚠️  wc2026_schedule.py introuvable, migration UTC reportée: {e}")
                print(f"[MIGRATION] ⚠️  Vérifier le Dockerfile backend (doit COPY wc2026_schedule.py)")
            except Exception as e:
                # Toute autre erreur : log mais ne crashe pas le backend
                print(f"[MIGRATION] ⚠️  Erreur lors de la migration UTC: {e}")
                # On NE marque PAS appliquée pour pouvoir réessayer


def seed_data():
    with get_db() as db:
        if db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            users = [
                # Compte admin par défaut — CHANGE LE MOT DE PASSE EN PRODUCTION !
                # Tu peux aussi le supprimer après avoir créé ton vrai compte admin
                ("admin@prono26.com", "Admin", "admin123", "admin"),
            ]
            for email, name, pwd, role in users:
                db.execute(
                    "INSERT OR IGNORE INTO users (email, username, password_hash, role) VALUES (?, ?, ?, ?)",
                    (email, name, pwd_context.hash(pwd), role),
                )

        if db.execute("SELECT COUNT(*) FROM matches").fetchone()[0] == 0:
            # =====================================================
            # 104 matchs CDM 2026 — dates UTC officielles FIFA
            # Source : inside.fifa.com (6 décembre 2025)
            # Format : dates en UTC ISO 8601, converties par le frontend
            #          dans le fuseau du visiteur
            # =====================================================
            try:
                from wc2026_schedule import ALL_MATCHES

                for h, a, d, s, g, st in ALL_MATCHES:
                    db.execute(
                        "INSERT INTO matches (home_team, away_team, match_date, stage, group_letter, stadium) VALUES (?,?,?,?,?,?)",
                        (h, a, d, s, g, st),
                    )
                print(f"[SEED] ✓ {len(ALL_MATCHES)} matchs insérés depuis wc2026_schedule")
            except ModuleNotFoundError:
                # Fallback : si le fichier n'est pas là, on n'insère rien
                # et l'admin verra "0 matchs" → diagnostic clair côté Docker
                print("[SEED] ⚠️  wc2026_schedule.py introuvable, aucun match inséré")
                print("[SEED] ⚠️  Vérifier le Dockerfile backend")


# =====================================================
# SECURITY
# =====================================================
def create_token(user_id: int, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Token invalide ou expiré")


def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(401, "Non authentifié")
    payload = decode_token(token)
    user_id = int(payload["sub"])
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(401, "Utilisateur introuvable")
        user_dict = dict(user)

        # Tracking : mise à jour de last_seen_at avec throttling (max 1 UPDATE / 5 min)
        # Évite de surcharger la BDD à chaque API call.
        now = datetime.now(timezone.utc)
        last_seen = user_dict.get("last_seen_at")
        should_update = False
        if not last_seen:
            should_update = True
        else:
            try:
                last_seen_dt = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
                # Si dernière mise à jour > 5 min, on update
                if (now - last_seen_dt).total_seconds() > 300:
                    should_update = True
            except Exception:
                # Format invalide → on update pour réparer
                should_update = True

        if should_update:
            now_iso = now.isoformat()
            try:
                db.execute("UPDATE users SET last_seen_at=? WHERE id=?", (now_iso, user_id))
                user_dict["last_seen_at"] = now_iso
            except Exception as e:
                # Ne JAMAIS bloquer l'authentification si la mise à jour du tracking échoue
                print(f"[TRACKING] Erreur update last_seen_at user={user_id}: {e}")

        return user_dict


def require_admin(user=Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Accès admin requis")
    return user


def require_user(user=Depends(get_current_user)) -> dict:
    """Tout utilisateur connecté (solo, leader, admin)."""
    return user


def require_leader_or_admin(user=Depends(get_current_user)) -> dict:
    if user["role"] not in ("leader", "admin"):
        raise HTTPException(403, "Accès leader ou admin requis")
    return user


def log_action(user_id: Optional[int], action: str, details: str = "", db=None):
    """Enregistre une action dans l'audit log.
    Si db est fourni, réutilise la connexion existante (évite SQLite lock).
    Sinon, ouvre une nouvelle connexion."""
    if db is not None:
        # Connexion existante : on l'utilise directement
        try:
            db.execute(
                "INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)",
                (user_id, action, details),
            )
        except Exception as e:
            print(f"[AUDIT] erreur (avec db) : {e}")
    else:
        # Nouvelle connexion (utilisé en dehors de transactions)
        try:
            with get_db() as new_db:
                new_db.execute(
                    "INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)",
                    (user_id, action, details),
                )
        except Exception as e:
            print(f"[AUDIT] erreur (sans db) : {e}")


# =====================================================
# SCORING
# =====================================================
def compute_points(pred_h: int, pred_a: int, real_h: int, real_a: int) -> int:
    if pred_h == real_h and pred_a == real_a:
        return 15
    pred_diff = pred_h - pred_a
    real_diff = real_h - real_a
    pred_winner = 0 if pred_diff == 0 else (1 if pred_diff > 0 else -1)
    real_winner = 0 if real_diff == 0 else (1 if real_diff > 0 else -1)
    if pred_winner == real_winner and pred_diff == real_diff:
        return 8
    if pred_winner == real_winner:
        return 5
    return 0


def recalc_match_points(match_id: int):
    with get_db() as db:
        m = db.execute("SELECT * FROM matches WHERE id=?", (match_id,)).fetchone()
        if not m:
            return
        preds = db.execute("SELECT * FROM predictions WHERE match_id=?", (match_id,)).fetchall()
        # Si le match n'a plus de score (reset), on remet tous les points à 0
        if m["home_score"] is None or m["away_score"] is None:
            for p in preds:
                db.execute("UPDATE predictions SET points=0 WHERE id=?", (p["id"],))
            return
        for p in preds:
            pts = compute_points(p["home_score"], p["away_score"], m["home_score"], m["away_score"])
            db.execute("UPDATE predictions SET points=? WHERE id=?", (pts, p["id"]))


# =====================================================
# AGRÉGATEUR RSS (background thread)
# =====================================================
RSS_FEEDS = [
    # =====================================================
    # Sources dédiées équipes nationales / FIFA / international
    # On évite les flux "transferts/clubs" pour n'avoir que de l'actu sélection
    # =====================================================
    # FRANÇAIS — sélection nationale / international
    ("L'Équipe (Bleus)", "https://www.lequipe.fr/rss/actu_rss_Football-Equipe%20de%20France.xml", "fr"),
    ("L'Équipe (Coupe du Monde)", "https://www.lequipe.fr/rss/actu_rss_Football-Coupe%20du%20Monde.xml", "fr"),
    ("RMC Sport (Bleus)", "https://rmcsport.bfmtv.com/rss/football/equipe-de-france/", "fr"),
    # ANGLAIS — international / national teams
    ("ESPN FC International", "https://www.espn.com/espn/rss/soccer/news", "en"),
    ("BBC Sport International", "https://feeds.bbci.co.uk/sport/football/internationals/rss.xml", "en"),
    ("FIFA News", "https://www.fifa.com/rss-feeds/news", "en"),
    ("UEFA News", "https://www.uefa.com/rssfeed/news/rss.xml", "en"),
    # ESPAGNOL — sélections / mondial
    ("Marca (Selección)", "https://e00-marca.uecdn.es/rss/futbol/seleccion-espanola.xml", "es"),
    ("AS (Selección)", "https://as.com/rss/futbol/seleccion.xml", "es"),
    ("Marca (Mundial)", "https://e00-marca.uecdn.es/rss/futbol/mundial-2026.xml", "es"),
]

# Mots-clés de clubs à EXCLURE (si on détecte un nom de club, on filtre)
CLUB_BLACKLIST = [
    # Premier League
    "manchester united", "manchester city", "liverpool", "chelsea", "arsenal",
    "tottenham", "newcastle", "aston villa", "everton", "west ham",
    "man utd", "man city", "spurs",
    # La Liga
    "real madrid", "barcelona", "atletico madrid", "atlético madrid", "barça",
    "barca", "sevilla", "valencia", "athletic bilbao", "real sociedad",
    "fc barcelona",
    # Serie A
    "juventus", "inter milan", "ac milan", "as roma", "napoli", "lazio",
    "fiorentina", "atalanta", "internazionale",
    # Bundesliga
    "bayern", "dortmund", "bvb", "leverkusen", "rb leipzig", "schalke",
    # Ligue 1
    "psg", "paris saint-germain", "paris sg", "marseille", "om ", "olympique",
    "monaco", "lyon", " ol ", "lille", "losc", "nice", "rennes",
    # Champions League / clubs internationaux
    "champions league", "ligue des champions", "europa league", "ligue europa",
    "transfer", "transfert", "mercato", "signed for", "fiche pour",
    "loan", "prêt", "cláusula",
]

# Mots-clés indiquant un contexte ÉQUIPE NATIONALE (whitelist forte)
NATIONAL_TEAM_INDICATORS = [
    "national team", "équipe nationale", "selección", "selecao", "selecção",
    "world cup", "coupe du monde", "copa del mundo", "copa do mundo",
    "international", "qualifiers", "qualifications", "qualifs", "clasificación",
    "world cup 2026", "cdm 2026", "mundial 2026", "fifa", "uefa nations",
    "friendly", "amical", "amistoso",
    # Les "trois lions", "albiceleste" etc. désignent des sélections
    "three lions", "les bleus", "albiceleste", "selecao", "la roja",
    "national side", "tournoi", "tournament",
]

TEAM_KEYWORDS = {
    "FRA": ["france", "francia", "mbapp", "deschamps", "bleus", "griezmann", "tchouameni", "kant"],
    "BRA": ["brazil", "brésil", "bresil", "brasil", "neymar", "vinicius", "rodrygo", "selecao", "selección brasileña"],
    "ARG": ["argentina", "argentine", "messi", "scaloni", "albiceleste", "lautaro", "alvarez"],
    "ENG": ["england", "angleterre", "inglaterra", "kane", "bellingham", "saka", "three lions", "foden"],
    "ESP": ["spain", "espagne", "españa", "yamal", "pedri", "rodri", "la roja", "lamine", "morata", "selección española"],
    "GER": ["germany", "allemagne", "alemania", "musiala", "wirtz", "mannschaft", "havertz", "kimmich"],
    "POR": ["portugal", "ronaldo", "bernardo silva", "selecao das quinas", "joao felix", "leão"],
    "NED": ["netherlands", "pays-bas", "países bajos", "paises bajos", "van dijk", "depay", "oranje", "gakpo"],
    "USA": ["usmnt", "united states", "estados unidos", "pulisic", "reyna", "weah"],
    "MEX": ["mexico", "mexique", "méxico", "el tri", "lozano", "raúl jiménez", "raul jimenez"],
    "CAN": ["canada", "canadá", "alphonso davies", "jonathan david"],
    "BEL": ["belgium", "belgique", "bélgica", "belgica", "lukaku", "de bruyne", "doku"],
    "CRO": ["croatia", "croatie", "croacia", "modric", "kovacic"],
    "JPN": ["japan", "japon", "japón", "kubo", "samurai blue", "mitoma"],
    "SEN": ["senegal", "sénégal", "sadio mane", "lions de la teranga", "koulibaly"],
    "MAR": ["morocco", "maroc", "marruecos", "hakimi", "ziyech", "en-nesyri"],
    "URU": ["uruguay", "valverde", "núñez", "nunez"],
    "COL": ["colombia", "colombie", "james rodriguez", "luis diaz", "luis díaz"],
    "ITA": ["italy", "italie", "italia", "azzurri"],
    "POR": ["portugal", "ronaldo", "bernardo silva", "leão", "leao"],
    "NOR": ["norway", "norvège", "noruega", "haaland", "ødegaard", "odegaard"],
    "AUT": ["austria", "autriche", "alaba", "arnautović"],
    "TUR": ["turkey", "turquie", "turquía", "türkiye", "calhanoglu", "güler"],
    "SUI": ["switzerland", "suisse", "suiza", "xhaka", "shaqiri"],
    "AUS": ["australia", "australie", "socceroos"],
    "KOR": ["south korea", "corée du sud", "corea del sur", "son heung-min"],
    "ECU": ["ecuador", "équateur", "valencia"],
    "EGY": ["egypt", "égypte", "egipto", "salah"],
    "IRN": ["iran", "irán", "azmoun", "taremi"],
    "PAR": ["paraguay", "almirón", "almiron"],
    "GHA": ["ghana", "kudus"],
    "ALG": ["algeria", "algérie", "argelia", "mahrez"],
    "TUN": ["tunisia", "tunisie", "túnez", "msakni"],
    "CIV": ["ivory coast", "côte d'ivoire", "costa de marfil", "kessié", "haller"],
    "NZL": ["new zealand", "nouvelle-zélande", "nueva zelanda"],
    "RSA": ["south africa", "afrique du sud", "sudáfrica"],
    "PAN": ["panama", "panamá"],
    "JOR": ["jordan", "jordanie", "jordania"],
    "KSA": ["saudi", "arabie saoudite", "arabia saudí", "al-hilal"],
    "QAT": ["qatar", "catar"],
    "UZB": ["uzbekistan", "ouzbékistan", "uzbekistán"],
    "COD": ["dr congo", "rd congo"],
    "CPV": ["cape verde", "cap-vert", "cabo verde"],
    "HAI": ["haiti", "haïti", "haití"],
    "SCO": ["scotland", "écosse", "escocia"],
    "BIH": ["bosnia", "bosnie", "bosnia y herzegovina", "džeko"],
    "SWE": ["sweden", "suède", "suecia", "isak", "kulusevski"],
    "IRQ": ["iraq", "irak"],
    "CZE": ["czech", "tchéquie", "chequia", "schick"],
    "CUW": ["curaçao", "curazao"],
}

POSITIVE = ["win", "victory", "goal", "victoire", "but", "qualifié", "qualifie", "triumph", "score",
            "victoria", "gol", "clasificado", "triunfo", "ganar", "ganó", "vence"]
NEGATIVE = ["injury", "lose", "defeat", "blessure", "défaite", "blessé", "forfait", "out",
            "lesión", "derrota", "fuera", "lesionado", "perdió"]


def detect_team(text: str) -> Optional[str]:
    text_lower = text.lower()
    # On préfère les matchs avec les mots-clés les plus longs (ex: "estados unidos" avant "argentina")
    matches = []
    for code, keywords in TEAM_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                matches.append((len(kw), code))
                break
    if matches:
        matches.sort(reverse=True)
        return matches[0][1]
    return None


def detect_sentiment(text: str) -> str:
    text_lower = text.lower()
    pos = sum(1 for w in POSITIVE if w in text_lower)
    neg = sum(1 for w in NEGATIVE if w in text_lower)
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"


def is_national_team_news(text: str, source_name: str) -> bool:
    """Retourne True si l'article concerne une équipe nationale, False s'il parle d'un club.

    Logique :
    1. Si la source est dédiée aux sélections (FIFA, UEFA, "Bleus", "Selección"), accepter d'office
    2. Si on détecte un nom de club célèbre, rejeter
    3. Si on détecte un mot-clé "équipe nationale", accepter
    4. Si on détecte un nom d'équipe nationale via TEAM_KEYWORDS, accepter
    5. Sinon, rejeter par défaut (mieux vaut moins d'actus mais pertinentes)
    """
    text_lower = text.lower()
    source_lower = source_name.lower()

    # 1. Sources 100% nationale → on garde tout
    trusted_national_sources = ['fifa', 'uefa', 'bleus', 'selección', 'seleccion',
                                 'mundial', 'coupe du monde', 'world cup', 'national']
    if any(s in source_lower for s in trusted_national_sources):
        return True

    # 2. Si on détecte un club connu, on rejette
    for club in CLUB_BLACKLIST:
        if club in text_lower:
            return False

    # 3. Si on détecte un indicateur équipe nationale, on accepte
    for indicator in NATIONAL_TEAM_INDICATORS:
        if indicator in text_lower:
            return True

    # 4. Sinon, on regarde si une équipe nationale est mentionnée explicitement
    if detect_team(text):
        return True

    # 5. Par défaut, rejeter (mieux vaut moins de news mais pertinentes)
    return False


# =====================================================
# TRADUCTION (MyMemory API + circuit breaker)
# - Sans clé : ~50000 caractères/jour par IP
# - Avec clé : ~1M caractères/jour (gratuit, juste un email)
#   → set MYMEMORY_EMAIL=ton@email.com dans .env
# =====================================================

# Cache mémoire pour éviter de re-traduire les mêmes textes
_translation_cache = {}

# Circuit breaker : si on reçoit un 429, on arrête de spammer pendant X temps
_translate_blocked_until = 0  # timestamp Unix
_translate_429_count = 0


def _try_mymemory(text: str, source_lang: str, target_lang: str):
    """Tente une traduction via MyMemory. Retourne le texte traduit ou None."""
    global _translate_blocked_until, _translate_429_count

    if time.time() < _translate_blocked_until:
        return None

    try:
        params_dict = {
            'q': text,
            'langpair': f'{source_lang}|{target_lang}',
        }
        email = os.environ.get("MYMEMORY_EMAIL")
        if email:
            params_dict['de'] = email
        params = urllib.parse.urlencode(params_dict)
        req = urllib.request.Request(
            f'https://api.mymemory.translated.net/get?{params}',
            headers={'User-Agent': 'PRONO2026/1.0'},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json_lib.loads(resp.read().decode('utf-8'))
            translated = data.get('responseData', {}).get('translatedText', '')
            if not translated:
                return None
            if 'MYMEMORY WARNING' in translated.upper() or 'INVALID' in translated.upper():
                _translate_blocked_until = time.time() + 3600
                print(f"[TRANSLATE] MyMemory quota dépassé — pause 1h")
                return None
            # Heuristique : si la traduction est identique au texte original (cas des très courts textes),
            # MyMemory a probablement renvoyé tel quel = pas vraiment traduit
            if translated.strip().lower() == text.strip().lower():
                return None
            _translate_429_count = 0
            return translated
    except urllib.error.HTTPError as e:
        if e.code == 429:
            _translate_429_count += 1
            wait_seconds = min(5 * 60 * (2 ** _translate_429_count), 7200)
            _translate_blocked_until = time.time() + wait_seconds
            print(f"[TRANSLATE] MyMemory 429 — pause {wait_seconds // 60} min")
        else:
            print(f"[TRANSLATE] MyMemory HTTP {e.code} {source_lang}->{target_lang}")
        return None
    except Exception as e:
        print(f"[TRANSLATE] MyMemory exception {source_lang}->{target_lang}: {e}")
        return None


def _try_libretranslate(text: str, source_lang: str, target_lang: str):
    """Fallback : LibreTranslate (instances publiques gratuites).
    Retourne le texte traduit ou None."""
    # Quelques instances publiques connues. On essaie chacune jusqu'à succès.
    instances = [
        os.environ.get("LIBRETRANSLATE_URL"),  # personnalisé via env
        "https://translate.flossboxin.org.in/translate",
        "https://libretranslate.de/translate",
        "https://translate.terraprint.co/translate",
    ]
    for url in instances:
        if not url:
            continue
        try:
            payload = json_lib.dumps({
                'q': text,
                'source': source_lang,
                'target': target_lang,
                'format': 'text',
            }).encode('utf-8')
            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'PRONO2026/1.0',
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json_lib.loads(resp.read().decode('utf-8'))
                translated = data.get('translatedText', '')
                if translated and translated.strip().lower() != text.strip().lower():
                    return translated
        except Exception as e:
            print(f"[TRANSLATE] LibreTranslate {url}: {e}")
            continue
    return None


def translate_text(text: str, source_lang: str, target_lang: str):
    """Traduit un texte. Retourne le texte traduit ou None si échec.
    Tente MyMemory d'abord, puis LibreTranslate en backup.
    Cache mémoire global pour éviter les appels redondants."""
    if not text or source_lang == target_lang:
        return text

    # Nettoyer
    clean = text.replace('\n', ' ').strip()
    if len(clean) > 480:
        clean = clean[:477] + "..."

    # Cache mémoire
    cache_key = f"{source_lang}->{target_lang}:{clean[:120]}"
    if cache_key in _translation_cache:
        return _translation_cache[cache_key]

    # 1. MyMemory (rapide et bonne qualité)
    result = _try_mymemory(clean, source_lang, target_lang)

    # 2. LibreTranslate en fallback
    if not result:
        result = _try_libretranslate(clean, source_lang, target_lang)

    if result:
        _translation_cache[cache_key] = result
        return result

    # Tous les services ont échoué → None (pas le texte original !)
    return None


def translate_to_all_langs(text: str, source_lang: str) -> dict:
    """Traduit un texte vers fr, en, es. La langue source est gardée telle quelle.
    Retourne None pour les langues où la traduction a échoué (sera retraduit à la demande)."""
    result = {'fr': None, 'en': None, 'es': None}
    result[source_lang] = text
    for target in ['fr', 'en', 'es']:
        if target != source_lang and text:
            result[target] = translate_text(text, source_lang, target)  # peut être None
            time.sleep(0.6)
    return result


def fetch_news_once(translate=True):
    """Récupère les flux RSS et traduit en FR/EN/ES si translate=True."""
    total = 0
    for source_name, url, lang in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            with get_db() as db:
                for entry in feed.entries[:5]:  # limité à 5 par source pour ménager le quota MyMemory
                    title = getattr(entry, "title", "")
                    summary = getattr(entry, "summary", "")[:500]
                    link = getattr(entry, "link", "")
                    pub = getattr(entry, "published", datetime.now(timezone.utc).isoformat())

                    # Skip si déjà en base
                    existing = db.execute("SELECT 1 FROM news WHERE link=?", (link,)).fetchone()
                    if existing:
                        continue

                    # Nettoyer HTML basique du résumé
                    summary_clean = summary
                    if '<' in summary_clean:
                        import re
                        summary_clean = re.sub(r'<[^>]+>', '', summary_clean).strip()

                    text = f"{title} {summary_clean}"

                    # ⚽ FILTRE : on ne garde que les actus équipes nationales
                    if not is_national_team_news(text, source_name):
                        continue

                    team = detect_team(text)
                    sentiment = detect_sentiment(text)

                    # Traduction (en arrière-plan, peut prendre 1-2 sec par article)
                    if translate:
                        titles = translate_to_all_langs(title, lang)
                        summaries = translate_to_all_langs(summary_clean[:300], lang) if summary_clean else {'fr':'','en':'','es':''}
                    else:
                        titles = {lang: title, 'fr': title, 'en': title, 'es': title}
                        summaries = {lang: summary_clean, 'fr': summary_clean, 'en': summary_clean, 'es': summary_clean}

                    try:
                        db.execute(
                            """INSERT OR IGNORE INTO news
                               (title, summary, link, source, team, sentiment, published_at, lang,
                                title_fr, title_en, title_es, summary_fr, summary_en, summary_es)
                               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                            (title, summary_clean, link, source_name, team, sentiment, pub, lang,
                             titles['fr'], titles['en'], titles['es'],
                             summaries['fr'], summaries['en'], summaries['es']),
                        )
                        total += 1
                    except Exception as e:
                        print(f"[RSS] insert erreur: {e}")
        except Exception as e:
            print(f"[RSS] {source_name} erreur : {e}")
    print(f"[RSS] {total} articles traités")


def news_worker():
    """Tourne en boucle toutes les 10 minutes."""
    while True:
        try:
            fetch_news_once()
        except Exception as e:
            print(f"[RSS] worker erreur : {e}")
        time.sleep(600)


# =====================================================
# SCHEMAS
# =====================================================
class SignupIn(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=40)
    password: str = Field(min_length=6, max_length=100)
    # Rôle choisi à l'inscription : 'solo' (défaut) ou 'leader'
    # 'admin' interdit ici (créé manuellement)
    role: Optional[str] = "solo"
    # Si l'inscription provient d'un lien d'invitation (rejoint un groupe automatiquement)
    invite_code: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PredictionIn(BaseModel):
    match_id: int
    home_score: int = Field(ge=0, le=20)
    away_score: int = Field(ge=0, le=20)


class ScoreIn(BaseModel):
    home_score: int = Field(ge=0, le=20)
    away_score: int = Field(ge=0, le=20)


class AdminPredictionIn(BaseModel):
    user_id: int
    match_id: int
    home_score: int = Field(ge=0, le=20)
    away_score: int = Field(ge=0, le=20)


# =====================================================
# APP
# =====================================================
app = FastAPI(title="United Pronos API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://localhost"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()
    seed_data()
    # Lance l'agrégateur RSS en arrière-plan
    thread = threading.Thread(target=news_worker, daemon=True)
    thread.start()
    # Lance le fetch des résultats Football-Data.org si la clé API est définie
    results_thread = threading.Thread(target=results_worker, daemon=True)
    results_thread.start()
    print("=" * 60)
    print("🏆 United Pronos backend démarré")
    print(f"📁 Base : {DB_PATH}")
    print("👤 Compte admin : admin@prono26.com (change le mot de passe !)")
    if os.environ.get("FOOTBALL_DATA_API_KEY"):
        print("⚽ Fetch automatique des résultats : ACTIVÉ")
    else:
        print("⚠️  FOOTBALL_DATA_API_KEY non défini — fetch automatique désactivé")
    print("=" * 60)


# --- Auth ---
@app.post("/api/auth/signup")
def signup(data: SignupIn):
    # Sécurité : un visiteur ne peut s'inscrire qu'en solo ou leader
    chosen_role = data.role if data.role in ("solo", "leader") else "solo"

    with get_db() as db:
        if db.execute("SELECT 1 FROM users WHERE email=?", (data.email,)).fetchone():
            raise HTTPException(400, "Email déjà utilisé")

        # Si invite_code fourni : on force le rôle solo + on le rattache au groupe
        target_group_id = None
        if data.invite_code:
            invite = data.invite_code.upper().strip()
            grp = db.execute("SELECT id FROM groups WHERE invite_code=?", (invite,)).fetchone()
            if not grp:
                raise HTTPException(400, "Code d'invitation invalide")
            target_group_id = grp["id"]
            chosen_role = "solo"  # un membre est toujours 'solo' avec group_id

        cur = db.execute(
            "INSERT INTO users (email, username, password_hash, role, group_id) VALUES (?,?,?,?,?)",
            (data.email, data.username, pwd_context.hash(data.password), chosen_role, target_group_id),
        )
        user_id = cur.lastrowid
        log_action(user_id, "signup", f"{data.email} role={chosen_role}", db=db)
        token = create_token(user_id, chosen_role)

    # Envoi de l'email de bienvenue (hors du with db, non bloquant en cas d'erreur SMTP)
    try:
        send_welcome_email(data.email, data.username)
    except Exception as e:
        # Ne JAMAIS bloquer l'inscription si l'envoi du mail échoue
        # (le user peut s'être inscrit avec un email Microsoft qui rejette nos mails)
        print(f"[SIGNUP] Email bienvenue non envoyé à {data.email}: {e}")

    return {
        "token": token,
        "user": {
            "id": user_id, "email": data.email, "username": data.username,
            "role": chosen_role, "group_id": target_group_id,
        },
    }


@app.post("/api/auth/login")
def login(data: LoginIn):
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE email=?", (data.email,)).fetchone()
        if not user or not pwd_context.verify(data.password, user["password_hash"]):
            log_action(user["id"] if user else None, "login_failed", data.email, db=db)
            raise HTTPException(401, "Email ou mot de passe invalide")
        log_action(user["id"], "login_success", data.email, db=db)
        # Mise à jour immédiate du last_seen_at au login
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            db.execute("UPDATE users SET last_seen_at=? WHERE id=?", (now_iso, user["id"]))
        except Exception as e:
            print(f"[TRACKING] Erreur update last_seen_at login user={user['id']}: {e}")
        token = create_token(user["id"], user["role"])
        return {
            "token": token,
            "user": {
                "id": user["id"], "email": user["email"], "username": user["username"],
                "role": user["role"], "group_id": user["group_id"],
            },
        }


# =====================================================
# RESET PASSWORD : Mot de passe oublié
# =====================================================

@app.post("/api/auth/password-reset-request")
def password_reset_request(data: dict):
    """Demande de réinitialisation : envoie un email avec un token unique (1h de validité).
    Sécurité : on renvoie TOUJOURS un succès même si l'email n'existe pas
    (évite la "user enumeration" — pratique courante des hackers).
    """
    email = (data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Email invalide")

    with get_db() as db:
        user = db.execute("SELECT id, username, email FROM users WHERE email=?", (email,)).fetchone()
        if user:
            # Génère un token sécurisé
            import secrets
            token = secrets.token_urlsafe(48)  # 64 caractères, ~256 bits d'entropie
            expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

            # Supprime les anciens tokens non-utilisés pour cet utilisateur (1 seul actif)
            db.execute("DELETE FROM password_reset_tokens WHERE user_id=? AND used=0", (user["id"],))

            # Crée le nouveau token
            db.execute(
                "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?,?,?)",
                (token, user["id"], expires_at),
            )
            log_action(user["id"], "password_reset_request", email, db=db)

            # Envoi de l'email (hors with, non bloquant)
            try:
                send_password_reset_email(user["email"], user["username"], token)
            except Exception as e:
                print(f"[PASSWORD_RESET] Erreur envoi email à {email}: {e}")
        else:
            # User inexistant : on simule un délai pour cacher l'absence
            # (sécurité : éviter user enumeration)
            log_action(None, "password_reset_unknown_email", email, db=db)

    # Toujours renvoyer un succès (sécurité)
    return {
        "ok": True,
        "message": "Si cet email existe, un lien de réinitialisation a été envoyé.",
    }


@app.post("/api/auth/password-reset-confirm")
def password_reset_confirm(data: dict):
    """Confirme la réinitialisation : valide le token et change le mot de passe."""
    token = (data.get("token") or "").strip()
    new_password = (data.get("password") or "").strip()

    if not token:
        raise HTTPException(400, "Token manquant")
    if not new_password or len(new_password) < 8:
        raise HTTPException(400, "Le mot de passe doit faire au moins 8 caractères")
    if len(new_password) > 200:
        raise HTTPException(400, "Mot de passe trop long")

    with get_db() as db:
        row = db.execute("""
            SELECT t.*, u.email, u.username
            FROM password_reset_tokens t
            JOIN users u ON u.id = t.user_id
            WHERE t.token = ?
        """, (token,)).fetchone()

        if not row:
            raise HTTPException(400, "Lien invalide ou expiré")

        if row["used"]:
            raise HTTPException(400, "Ce lien a déjà été utilisé")

        # Vérifie l'expiration
        try:
            expires_at = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires_at:
                raise HTTPException(400, "Ce lien a expiré. Demande un nouveau lien de réinitialisation.")
        except (ValueError, AttributeError):
            raise HTTPException(400, "Lien invalide")

        # Hash et met à jour le mot de passe
        new_hash = pwd_context.hash(new_password)
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (new_hash, row["user_id"]))
        # Marque le token comme utilisé
        db.execute("UPDATE password_reset_tokens SET used=1 WHERE token=?", (token,))
        log_action(row["user_id"], "password_reset_confirm", row["email"], db=db)

    return {
        "ok": True,
        "message": "Mot de passe réinitialisé avec succès. Tu peux maintenant te connecter.",
    }


@app.post("/api/me/resend-welcome")
def resend_welcome_email(user=Depends(get_current_user)):
    """Renvoie l'email de bienvenue à l'utilisateur connecté.
    Utile si l'utilisateur n'a jamais reçu son email (ex: bloqué par Outlook)."""
    try:
        success = send_welcome_email(user["email"], user["username"])
        log_action(user["id"], "resend_welcome", user["email"])
        if success:
            return {"ok": True, "message": "Email de bienvenue renvoyé"}
        else:
            return {"ok": False, "message": "Erreur lors de l'envoi (config SMTP)"}
    except Exception as e:
        print(f"[RESEND_WELCOME] Erreur: {e}")
        raise HTTPException(500, "Erreur lors de l'envoi de l'email")


@app.get("/api/me")
def me(user=Depends(get_current_user)):
    return {
        "id": user["id"], "email": user["email"], "username": user["username"],
        "role": user["role"], "group_id": user.get("group_id"),
        "avatar_data": user.get("avatar_data"), "bio": user.get("bio") or "",
        "lang": user.get("lang") or "fr", "theme": user.get("theme") or "dark",
    }


# --- Matches ---
@app.get("/api/matches")
def list_matches(response: Response):
    """Liste des matchs. Cachée 30s côté client/proxy + 15s côté serveur (RAM).
    Avec 100+ users en polling, le cache RAM divise par 10-30 le RPS BDD.

    PROTECTION : on ne cache JAMAIS une valeur vide. Si la query renvoie [] (ex: race
    condition au démarrage, BDD lock momentané), on évite d'empoisonner le cache
    qui afficherait "Aucun match" à tous les utilisateurs pendant 15s.
    """
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=60"
    # Cache RAM côté serveur (partagé entre clients du même worker)
    cached = cache_get("matches:all")
    if cached:  # truthy uniquement = non vide
        return cached
    with get_db() as db:
        rows = db.execute("SELECT * FROM matches ORDER BY match_date").fetchall()
        result = [dict(r) for r in rows]
        # IMPORTANT : on ne stocke en cache QUE si on a des résultats.
        # Sinon, on accepte de re-query la BDD au prochain appel (mieux que cacher [])
        if result:
            cache_set("matches:all", result, ttl_seconds=30)
        return result


@app.get("/api/snapshot")
def app_snapshot(response: Response):
    """Endpoint OPTIMISÉ pour le polling : retourne en 1 seul appel
    les matches + leaderboard + news. Réduit drastiquement le nombre
    de requêtes HTTP avec 100+ utilisateurs en polling toutes les 45s.

    Avant : 3 requêtes parallèles toutes les 45s × 100 users = 400 req/min
    Après : 1 requête toutes les 45s × 100 users = 130 req/min
            → -67% de charge HTTP/middleware/parsing

    Toutes les sous-données utilisent leur propre cache RAM (15-30s),
    donc la BDD n'est pas plus sollicitée — c'est l'overhead HTTP/réseau
    qui est divisé par 3.
    """
    response.headers["Cache-Control"] = "public, max-age=20, stale-while-revalidate=40"

    # === MATCHES (donnée critique - on ne tolère JAMAIS d'envoyer une liste vide) ===
    # Stratégie en 2 temps : cache d'abord, BDD direct si cache vide/manquant.
    # IMPORTANT : on ne stocke en cache QUE si la query renvoie au moins 1 match
    # (sinon on empoisonne le cache pour 15s)
    matches_data = cache_get("matches:all")
    if not matches_data:  # None OU liste vide
        try:
            with get_db() as db:
                rows = db.execute("SELECT * FROM matches ORDER BY match_date").fetchall()
                matches_data = [dict(r) for r in rows]
                if matches_data:  # ne cache QUE si non vide
                    cache_set("matches:all", matches_data, ttl_seconds=30)
        except Exception as e:
            print(f"[ERROR snapshot/matches] {e}")
            matches_data = []

    # === LEADERBOARD (idem : on ne cache jamais un classement vide) ===
    leaderboard_data = cache_get("leaderboard:global")
    if not leaderboard_data or not leaderboard_data.get("ranked"):
        try:
            with get_db() as db:
                # OPTIMISATION : pas d'avatar_data, email, logo_data (gonfle la réponse à 20+ MB)
                rows = db.execute("""
                    SELECT u.id, u.username, u.role, u.group_id,
                           COALESCE(SUM(p.points), 0) AS total_points,
                           COUNT(p.id) AS predictions_count,
                           g.name AS group_name,
                           g.slug AS group_slug,
                           EXISTS(SELECT 1 FROM donations d WHERE d.user_id = u.id AND d.verified = 1) AS is_supporter
                    FROM users u
                    LEFT JOIN predictions p ON p.user_id = u.id
                    LEFT JOIN groups g ON g.id = u.group_id
                    WHERE u.role != 'admin' OR u.id IN (SELECT user_id FROM predictions)
                    GROUP BY u.id
                    ORDER BY total_points DESC, predictions_count DESC
                """).fetchall()
                excluded = db.execute("""
                    SELECT COUNT(*) AS n FROM users u
                    WHERE u.role = 'admin'
                      AND u.id NOT IN (SELECT user_id FROM predictions WHERE user_id IS NOT NULL)
                """).fetchone()["n"]
                ranked = [dict(r) for r in rows]
                leaderboard_data = {
                    "ranked": ranked,
                    "ranked_count": len(ranked),
                    "excluded_admins": excluded,
                    "total_users": len(ranked) + excluded,
                }
                if ranked:  # ne cache QUE si on a des utilisateurs
                    cache_set("leaderboard:global", leaderboard_data, ttl_seconds=15)
        except Exception as e:
            print(f"[ERROR snapshot/leaderboard] {e}")
            leaderboard_data = {"ranked": [], "ranked_count": 0, "excluded_admins": 0, "total_users": 0}

    # News : utilise le cache existant (avec lang=fr par défaut)
    # Pas critique d'avoir les news en temps réel
    news_data = cache_get("news:all:fr") or []

    return {
        "matches": matches_data,
        "leaderboard": leaderboard_data,
        "news": news_data,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


# --- Predictions ---
@app.get("/api/predictions")
def my_predictions(user=Depends(get_current_user), response: Response = None):
    """Pronostics de l'utilisateur connecté. Cache privé court (30s).
    L'utilisateur invalide ce cache implicitement quand il save un nouveau pronostic
    (le frontend recharge alors avec un nouveau timestamp via Cache-Control max-age)."""
    if response is not None:
        # Cache privé : seul ce client peut le réutiliser (pas les proxys partagés).
        # 30s : compromis entre fraîcheur et économie de requêtes (15-20 req/min/user → 2 req/min)
        response.headers["Cache-Control"] = "private, max-age=30"
    with get_db() as db:
        rows = db.execute("SELECT * FROM predictions WHERE user_id=?", (user["id"],)).fetchall()
        return [dict(r) for r in rows]


@app.post("/api/predictions")
def save_prediction(data: PredictionIn, user=Depends(get_current_user)):
    """Sauvegarde un pronostic. Avec 150+ users en simultané, on peut avoir des
    locks SQLite passagers. On retry jusqu'à 3 fois avec backoff exponentiel
    avant de renvoyer une erreur claire à l'utilisateur."""
    import time as _t
    last_err = None

    # === RÈGLE DE VERROUILLAGE DES PRONOSTICS ===
    # Un pronostic est verrouillé dans 2 cas :
    # 1. Le match a déjà été terminé (status='finished', mis par l'admin)
    # 2. Le match commence dans MOINS DE 5 MINUTES (PREDICTION_LOCK_MINUTES)
    #
    # Pourquoi 5 minutes et pas pile au coup d'envoi :
    # - Sécurité réseau : latence d'envoi de requête (1-3s parfois)
    # - Décalages d'horloge clients : un navigateur peut avoir 30s d'avance
    # - Convention sportive : la plupart des sites verrouillent 2-15 min avant
    # - Évite que quelqu'un puisse pronostiquer pendant que les équipes entrent sur le terrain
    PREDICTION_LOCK_MINUTES = 5

    for attempt in range(3):
        try:
            with get_db() as db:
                m = db.execute("SELECT * FROM matches WHERE id=?", (data.match_id,)).fetchone()
                if not m:
                    raise HTTPException(404, "Match introuvable")
                # Verrou #1 : match déjà terminé (admin a saisi un score)
                if m["status"] == "finished":
                    raise HTTPException(400, "Match terminé, prono verrouillé")
                # Verrou #2 : kickoff trop proche ou passé
                # match_date est stocké en UTC ISO 8601 par notre migration v2
                try:
                    match_dt = datetime.fromisoformat(m["match_date"].replace("Z", "+00:00"))
                    if match_dt.tzinfo is None:
                        # Si pas de timezone, on assume UTC (notre format standard)
                        match_dt = match_dt.replace(tzinfo=timezone.utc)
                    now_utc = datetime.now(timezone.utc)
                    lock_at = match_dt - timedelta(minutes=PREDICTION_LOCK_MINUTES)
                    if now_utc >= lock_at:
                        # Match trop proche : on bloque
                        # On formate l'heure locale du match pour le message d'erreur
                        if now_utc >= match_dt:
                            raise HTTPException(
                                400,
                                "Le match a commencé, les pronostics sont fermés."
                            )
                        else:
                            mins_left = int((match_dt - now_utc).total_seconds() / 60)
                            raise HTTPException(
                                400,
                                f"Pronostics fermés : le match commence dans moins de "
                                f"{PREDICTION_LOCK_MINUTES} minutes ({mins_left} min restantes)."
                            )
                except HTTPException:
                    raise
                except (ValueError, AttributeError) as e:
                    # Si la date est mal formatée, on log et on laisse passer pour ne pas
                    # bloquer tous les pronos par sécurité défensive
                    print(f"[WARN save_prediction] match_date mal formaté pour match {data.match_id}: {m['match_date']} - {e}")

                existing = db.execute(
                    "SELECT id FROM predictions WHERE user_id=? AND match_id=?",
                    (user["id"], data.match_id),
                ).fetchone()
                if existing:
                    db.execute(
                        "UPDATE predictions SET home_score=?, away_score=?, updated_at=datetime('now') WHERE id=?",
                        (data.home_score, data.away_score, existing["id"]),
                    )
                else:
                    db.execute(
                        "INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (?,?,?,?)",
                        (user["id"], data.match_id, data.home_score, data.away_score),
                    )
                # Invalide le cache leaderboard car les stats utilisateur changent
                cache_invalidate("leaderboard:")
                return {"ok": True}
        except HTTPException:
            raise  # erreur fonctionnelle, on propage
        except sqlite3.OperationalError as e:
            last_err = e
            if "locked" in str(e).lower() or "busy" in str(e).lower():
                # backoff exponentiel : 50ms, 200ms, 800ms
                _t.sleep(0.05 * (4 ** attempt))
                continue
            raise HTTPException(500, f"Erreur BDD : {e}")
    # Échec après 3 retry
    print(f"[ERROR save_prediction] user={user['id']} match={data.match_id} : {last_err}")
    raise HTTPException(503, "Serveur très sollicité, réessaie dans quelques secondes")


# --- Leaderboard ---
@app.get("/api/leaderboard")
def leaderboard(response: Response):
    """Classement global avec infos de groupe pour chaque joueur.

    Logique métier : les admins SANS pronostic sont exclus du classement
    (ils ne sont pas censés concourir). Les admins QUI font des pronos restent inclus.

    Cache 20s HTTP + 15s RAM serveur. Le classement ne change qu'après un match terminé.
    """
    response.headers["Cache-Control"] = "public, max-age=20, stale-while-revalidate=40"
    # Cache RAM serveur — on vérifie que le cache contient un classement non vide.
    cached = cache_get("leaderboard:global")
    if cached and cached.get("ranked"):
        return cached
    with get_db() as db:
        # OPTIMISATION RÉPONSE : on a EXCLU avatar_data, email, logo_data du SELECT.
        # Pour 1283 users, ces champs base64 pouvaient gonfler la réponse à 20+ MB et
        # provoquer des troncatures côté nginx/Caddy → "aucun participant" affiché.
        # La réponse passe maintenant de ~20 MB à ~300 KB pour 1283 users.
        # Les avatars ne sont pas affichés dans le classement (juste le pseudo + points),
        # donc aucune perte fonctionnelle.
        rows = db.execute("""
            SELECT u.id, u.username, u.role, u.group_id,
                   COALESCE(SUM(p.points), 0) AS total_points,
                   COUNT(p.id) AS predictions_count,
                   g.name AS group_name,
                   g.slug AS group_slug,
                   EXISTS(SELECT 1 FROM donations d WHERE d.user_id = u.id AND d.verified = 1) AS is_supporter
            FROM users u
            LEFT JOIN predictions p ON p.user_id = u.id
            LEFT JOIN groups g ON g.id = u.group_id
            WHERE u.role != 'admin' OR u.id IN (SELECT user_id FROM predictions)
            GROUP BY u.id
            ORDER BY total_points DESC, predictions_count DESC
        """).fetchall()

        # Compte les admins exclus (utile pour transparence côté admin/frontend)
        excluded_count = db.execute("""
            SELECT COUNT(*) AS n FROM users u
            WHERE u.role = 'admin'
              AND u.id NOT IN (SELECT user_id FROM predictions WHERE user_id IS NOT NULL)
        """).fetchone()["n"]

        ranked = [dict(r) for r in rows]
        result = {
            "ranked": ranked,
            "ranked_count": len(ranked),
            "excluded_admins": excluded_count,
            "total_users": len(ranked) + excluded_count,
        }
        # Ne cache que si on a au moins 1 utilisateur classé (évite l'empoisonnement cache)
        if ranked:
            cache_set("leaderboard:global", result, ttl_seconds=30)
        return result


@app.get("/api/leaderboard/groups")
def leaderboard_groups(response: Response):
    """Classement des GROUPES — calcul équilibré performance × engagement.

    FORMULE (visible aussi côté front pour transparence) :
        score = moyenne_points_par_membre × (1 + log10(nb_membres_actifs))

    Récompense à la fois :
    - La PERFORMANCE moyenne du groupe (un groupe avec de bons pronostiqueurs)
    - L'ENGAGEMENT collectif (plus de membres actifs = bonus, mais plafonné par log)

    Un "membre actif" = a fait au moins 1 pronostic.
    Les groupes avec moins de 2 membres actifs sont EXCLUS (groupes fantômes).

    Cache 60s : recalcul lourd (jointures + agrégations), peu de variation à court terme.

    OPTIMISATION : on utilise un seul JOIN au lieu de 4 sous-requêtes corrélées
    par utilisateur (ancien comportement : N+1 query problem avec 100+ utilisateurs).
    """
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
    import math

    # Cache RAM serveur : recalcul lourd, donc TTL 30s suffisant
    cached = cache_get("leaderboard:groups")
    if cached is not None:
        return cached

    with get_db() as db:
        # Optimisation : on agrège côté SQL en JOINTANT users → predictions
        # Une seule passe sur les tables au lieu de N sous-requêtes par utilisateur.
        # Le COUNT(DISTINCT) ne compte chaque utilisateur qu'une fois même avec plusieurs predictions.
        rows = db.execute("""
            SELECT
                g.id, g.name, g.description, g.logo_data, g.slug, g.invite_code,
                g.created_at,
                COUNT(DISTINCT u.id) AS members_count,
                COUNT(DISTINCT p.user_id) AS active_members,
                COALESCE(SUM(p.points), 0) AS total_points,
                COALESCE(COUNT(p.id), 0) AS total_predictions,
                leader.username AS leader_username
            FROM groups g
            LEFT JOIN users u ON u.group_id = g.id
            LEFT JOIN predictions p ON p.user_id = u.id
            LEFT JOIN users leader ON leader.id = g.leader_id
            GROUP BY g.id
        """).fetchall()

        # Calcul du score équilibré côté Python (plus lisible que SQL avec log)
        groups_ranked = []
        excluded_count = 0
        for r in rows:
            d = dict(r)
            active = d["active_members"]
            total_pts = d["total_points"] or 0

            # Exclusion des groupes fantômes (< 2 membres actifs)
            if active < 2:
                excluded_count += 1
                continue

            # Score équilibré : moyenne × (1 + log10(nb actifs))
            average = total_pts / active if active > 0 else 0
            engagement_bonus = 1 + math.log10(active)
            balanced_score = average * engagement_bonus

            d["average_points"] = round(average, 1)
            d["engagement_bonus"] = round(engagement_bonus, 2)
            d["balanced_score"] = round(balanced_score, 1)
            groups_ranked.append(d)

        # Tri par score équilibré décroissant, puis par moyenne en tie-breaker
        groups_ranked.sort(
            key=lambda x: (x["balanced_score"], x["average_points"]),
            reverse=True
        )

        result = {
            "groups": groups_ranked,
            "groups_count": len(groups_ranked),
            "excluded_count": excluded_count,
            "formula": {
                "description": "moyenne_points × (1 + log10(nb_membres_actifs))",
                "min_active_members": 2,
            },
        }
        cache_set("leaderboard:groups", result, ttl_seconds=60)
        return result


# --- News ---
@app.get("/api/news")
def list_news(response: Response, team: Optional[str] = None, lang: Optional[str] = 'fr', limit: int = 50):
    """Renvoie les actus avec titre/résumé traduits dans la langue demandée.
    Le paramètre 'lang' choisit la langue d'affichage (fr/en/es), pas la source.
    Si une traduction manque en BDD, elle est calculée à la volée et mise en cache.

    Cache 60s : les news sont rafraîchies en async côté backend, et changent rarement.
    """
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
    if lang not in ('fr', 'en', 'es'):
        lang = 'fr'

    with get_db() as db:
        conditions = []
        params = []
        if team:
            conditions.append("team=?")
            params.append(team)
        where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        params.append(limit)
        rows = db.execute(
            f"SELECT * FROM news{where} ORDER BY fetched_at DESC LIMIT ?",
            params,
        ).fetchall()

        result = []
        # Limiter le nombre de traductions à la volée par requête (anti-rate-limit)
        on_demand_translations = 0
        MAX_ON_DEMAND = 8

        for r in rows:
            d = dict(r)
            source_lang = d.get('lang') or 'fr'

            # Choisit la version traduite selon la langue demandée
            translated_title = d.get(f'title_{lang}')
            translated_summary = d.get(f'summary_{lang}')

            # Traduction à la volée si manquante (et budget pas dépassé)
            need_translation = (
                lang != source_lang and
                (not translated_title or not translated_summary) and
                on_demand_translations < MAX_ON_DEMAND
            )
            if need_translation:
                try:
                    new_title = None
                    new_summary = None
                    if not translated_title and d.get('title'):
                        new_title = translate_text(d['title'], source_lang, lang)  # None si échec
                        if new_title:
                            translated_title = new_title
                    if not translated_summary and d.get('summary'):
                        new_summary = translate_text(d['summary'][:300], source_lang, lang)
                        if new_summary:
                            translated_summary = new_summary
                    # Ne cache en BDD QUE si on a obtenu de vraies traductions
                    # (sinon, on retentera plus tard)
                    if new_title or new_summary:
                        # Update partiel : on ne touche qu'aux colonnes vraiment traduites
                        sets = []
                        params_upd = []
                        if new_title:
                            sets.append(f"title_{lang}=?"); params_upd.append(new_title)
                        if new_summary:
                            sets.append(f"summary_{lang}=?"); params_upd.append(new_summary)
                        params_upd.append(d['id'])
                        db.execute(
                            f"UPDATE news SET {', '.join(sets)} WHERE id=?",
                            params_upd
                        )
                        on_demand_translations += 1
                except Exception as e:
                    print(f"[NEWS translate on-demand] erreur: {e}")

            # Fallback final pour l'affichage : si toujours pas de traduction → texte original
            display_title = translated_title or d.get('title') or ''
            display_summary = translated_summary or d.get('summary') or ''

            result.append({
                'id': d['id'],
                'title': display_title,
                'summary': display_summary,
                'link': d['link'],
                'source': d['source'],
                'team': d['team'],
                'sentiment': d['sentiment'],
                'published_at': d['published_at'],
                'fetched_at': d['fetched_at'],
                'lang': source_lang,         # langue d'origine
                'displayed_lang': lang,       # langue affichée
                'translated': source_lang != lang and bool(translated_title),
            })
        return result


@app.post("/api/news/refresh")
def refresh_news(user=Depends(require_admin)):
    fetch_news_once()
    return {"ok": True}


@app.post("/api/news/translate-missing")
def admin_translate_missing(user=Depends(require_admin), max_news: int = 30):
    """Force la traduction des news existantes qui n'ont pas de version EN/ES.
    Utilisé pour rattraper les news ingérées avant que la traduction ne fonctionne.
    Limité à `max_news` news par appel pour éviter de saturer l'API de traduction.
    À relancer plusieurs fois si beaucoup de news à traduire."""
    translated = 0
    failed = 0
    with get_db() as db:
        # Trouver les news qui ont au moins une langue manquante
        rows = db.execute("""
            SELECT id, title, summary, lang, title_fr, title_en, title_es,
                   summary_fr, summary_en, summary_es
            FROM news
            WHERE (title_en IS NULL OR title_en = '' OR title_es IS NULL OR title_es = ''
                   OR title_fr IS NULL OR title_fr = '')
            ORDER BY fetched_at DESC
            LIMIT ?
        """, (max_news,)).fetchall()

        for r in rows:
            d = dict(r)
            source_lang = d.get('lang') or 'fr'
            updates = {}
            for target in ('fr', 'en', 'es'):
                if target == source_lang:
                    # La langue source : on s'assure qu'elle est bien remplie
                    if not d.get(f'title_{target}') and d.get('title'):
                        updates[f'title_{target}'] = d['title']
                    if not d.get(f'summary_{target}') and d.get('summary'):
                        updates[f'summary_{target}'] = d['summary']
                else:
                    # Langues à traduire
                    if not d.get(f'title_{target}') and d.get('title'):
                        t_title = translate_text(d['title'], source_lang, target)
                        if t_title:
                            updates[f'title_{target}'] = t_title
                            time.sleep(0.6)
                    if not d.get(f'summary_{target}') and d.get('summary'):
                        t_summary = translate_text(d['summary'][:300], source_lang, target)
                        if t_summary:
                            updates[f'summary_{target}'] = t_summary
                            time.sleep(0.6)

            if updates:
                sets = ", ".join(f"{col}=?" for col in updates.keys())
                params = list(updates.values()) + [d['id']]
                db.execute(f"UPDATE news SET {sets} WHERE id=?", params)
                translated += 1
            else:
                failed += 1

    log_action(user["id"], "translate_missing", f"translated={translated} failed={failed}")
    return {"ok": True, "translated": translated, "failed": failed, "checked": len(rows)}


# --- Admin ---
@app.get("/api/admin/users")
def admin_users(user=Depends(require_admin)):
    """Liste tous les utilisateurs avec leur dernière connexion."""
    with get_db() as db:
        rows = db.execute("""
            SELECT id, email, username, role, created_at, last_seen_at, group_id
            FROM users
            ORDER BY (last_seen_at IS NULL), last_seen_at DESC, id DESC
        """).fetchall()
        return [dict(r) for r in rows]


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    reason: str = "",
    notify: bool = True,
    user=Depends(require_admin)
):
    """Supprime un compte utilisateur (conforme RGPD Article 17).

    Query params optionnels :
    - reason : motif de suppression (affiché dans l'email RGPD si fourni)
    - notify : envoyer l'email de confirmation RGPD (défaut True, recommandé)

    Ordre des opérations :
    1. Récupère email + username AVANT suppression (sinon on perd l'adresse)
    2. Envoie l'email de confirmation RGPD
    3. Supprime en cascade en BDD (avec garde-fous)
    4. Log l'action dans l'audit (anonymisé : seul l'ID, pas l'email)
    """
    if user_id == user["id"]:
        raise HTTPException(400, "Impossible de supprimer son propre compte")

    with get_db() as db:
        # 1. Récupérer les infos AVANT suppression
        target = db.execute(
            "SELECT id, email, username FROM users WHERE id=?",
            (user_id,)
        ).fetchone()
        if not target:
            raise HTTPException(404, "Utilisateur introuvable")

        target_email = target["email"]
        target_username = target["username"]

    # 2. Envoyer l'email de confirmation RGPD (hors transaction BDD)
    # IMPORTANT : on l'envoie AVANT la suppression au cas où l'envoi échoue
    # et qu'on doive recommencer. Si on supprimait avant, on perdrait l'adresse.
    email_sent = False
    if notify:
        try:
            email_sent = send_account_deletion_email(
                target_email, target_username, reason.strip() if reason else ""
            )
        except Exception as e:
            print(f"[DELETE_USER] Erreur envoi email RGPD à {target_email}: {e}")
            # On continue quand même la suppression (l'utilisateur a demandé l'effacement)

    # 3. Suppression en BDD avec cascade explicite
    # Note : les FK avec ON DELETE CASCADE devraient gérer ça, mais on est explicite
    # pour garantir RGPD compliance même si une FK manque.
    with get_db() as db:
        # Données personnelles directes
        db.execute("DELETE FROM predictions WHERE user_id=?", (user_id,))

        # Conversations et messages (chat interne)
        # Note : conversation_messages cascade automatiquement via FK
        db.execute("DELETE FROM conversations WHERE user_id=?", (user_id,))

        # Tokens de reset password (au cas où)
        db.execute("DELETE FROM password_reset_tokens WHERE user_id=?", (user_id,))

        # Messages de contact envoyés par cet utilisateur (si table existe)
        try:
            db.execute("DELETE FROM contact_messages WHERE user_id=?", (user_id,))
        except Exception:
            pass  # Table peut ne pas exister selon migrations

        # Si l'utilisateur est leader d'un groupe, on désigne le groupe comme "orphelin"
        # (on ne supprime PAS le groupe pour ne pas pénaliser les autres membres)
        db.execute("UPDATE groups SET leader_id=NULL WHERE leader_id=?", (user_id,))

        # Suppression du user lui-même
        db.execute("DELETE FROM users WHERE id=?", (user_id,))

        # 4. Log d'audit ANONYMISÉ (RGPD : pas d'email/username, juste l'ID)
        log_action(
            user["id"], "delete_user_gdpr",
            f"user_id={user_id} email_sent={email_sent} reason={'yes' if reason else 'none'}",
            db=db
        )

    return {
        "ok": True,
        "user_id": user_id,
        "email_notification_sent": email_sent,
        "message": f"Compte de {target_username} supprimé. " + (
            "Email de confirmation RGPD envoyé." if email_sent
            else "⚠️ Email de confirmation non envoyé (vérifier SMTP)."
        )
    }


@app.get("/api/admin/users/{user_id}/predictions")
def admin_user_predictions(user_id: int, user=Depends(require_admin)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM predictions WHERE user_id=?", (user_id,)).fetchall()
        return [dict(r) for r in rows]


@app.put("/api/admin/predictions")
def admin_set_prediction(data: AdminPredictionIn, user=Depends(require_admin)):
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM predictions WHERE user_id=? AND match_id=?",
            (data.user_id, data.match_id),
        ).fetchone()
        if existing:
            db.execute(
                "UPDATE predictions SET home_score=?, away_score=?, updated_at=datetime('now') WHERE id=?",
                (data.home_score, data.away_score, existing["id"]),
            )
        else:
            db.execute(
                "INSERT INTO predictions (user_id, match_id, home_score, away_score) VALUES (?,?,?,?)",
                (data.user_id, data.match_id, data.home_score, data.away_score),
            )
        log_action(user["id"], "edit_prediction", f"user={data.user_id} match={data.match_id}", db=db)
        # Si le match est déjà terminé, recalcule
        m = db.execute("SELECT status FROM matches WHERE id=?", (data.match_id,)).fetchone()
        if m and m["status"] == "finished":
            recalc_match_points(data.match_id)
        return {"ok": True}


@app.post("/api/admin/matches/{match_id}/score")
def admin_set_score(match_id: int, data: ScoreIn, user=Depends(require_admin)):
    with get_db() as db:
        m = db.execute("SELECT * FROM matches WHERE id=?", (match_id,)).fetchone()
        if not m:
            raise HTTPException(404, "Match introuvable")
        db.execute(
            "UPDATE matches SET home_score=?, away_score=?, status='finished' WHERE id=?",
            (data.home_score, data.away_score, match_id),
        )
        log_action(user["id"], "set_score", f"match={match_id} {data.home_score}-{data.away_score}", db=db)
    recalc_match_points(match_id)
    # Invalide tous les caches affectés : matches, classements (le score change le ranking)
    cache_invalidate("matches:")
    cache_invalidate("leaderboard:")
    # Compter les pronostics impactés
    with get_db() as db:
        pred_count = db.execute("SELECT COUNT(*) as c FROM predictions WHERE match_id=?", (match_id,)).fetchone()["c"]
    return {"ok": True, "predictions_recalculated": pred_count}


@app.post("/api/admin/matches/{match_id}/reset-score")
def admin_reset_score(match_id: int, user=Depends(require_admin)):
    """Annule un score saisi : remet le match en 'scheduled' et points=0 pour tous les pronos."""
    with get_db() as db:
        m = db.execute("SELECT * FROM matches WHERE id=?", (match_id,)).fetchone()
        if not m:
            raise HTTPException(404, "Match introuvable")
        db.execute(
            "UPDATE matches SET home_score=NULL, away_score=NULL, status='scheduled' WHERE id=?",
            (match_id,),
        )
        log_action(user["id"], "reset_score", f"match={match_id}", db=db)
    recalc_match_points(match_id)  # remet points=0
    cache_invalidate("matches:")
    cache_invalidate("leaderboard:")
    return {"ok": True}


@app.get("/api/admin/audit-log")
def admin_audit_log(user=Depends(require_admin), limit: int = 100):
    with get_db() as db:
        rows = db.execute(
            """SELECT a.*, u.username, u.email
               FROM audit_log a
               LEFT JOIN users u ON u.id = a.user_id
               ORDER BY a.created_at DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


# =====================================================
# GROUPES — création, gestion, invitation, kick
# - solo : pas de groupe
# - leader : crée + gère son groupe
# - admin : voit/gère tous les groupes
# - membre (rôle 'solo' avec group_id != NULL) : à vie dans le groupe
# =====================================================
import re as _re_groups


def slugify(text: str) -> str:
    """Convertit 'Mon Super Groupe!' en 'mon-super-groupe'."""
    s = text.lower().strip()
    s = _re_groups.sub(r'[^a-z0-9]+', '-', s)
    s = _re_groups.sub(r'-+', '-', s).strip('-')
    return s[:60] or "groupe"


def generate_invite_code() -> str:
    """Code court alphanumérique majuscule, 8 caractères."""
    import string
    alphabet = string.ascii_uppercase + string.digits
    # Évite les caractères ambigus (0, O, 1, I, L)
    alphabet = ''.join(c for c in alphabet if c not in '0OI1L')
    return ''.join(secrets.choice(alphabet) for _ in range(8))


class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: Optional[str] = Field(None, max_length=500)
    logo_data: Optional[str] = Field(None, max_length=800_000)  # base64 ~500KB max


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=80)
    description: Optional[str] = Field(None, max_length=500)
    logo_data: Optional[str] = Field(None, max_length=800_000)


def serialize_group(row: sqlite3.Row, db) -> dict:
    """Retourne un groupe avec infos enrichies (leader, nb membres)."""
    g = dict(row)
    leader = db.execute("SELECT id, username, email FROM users WHERE id=?", (g["leader_id"],)).fetchone()
    g["leader"] = dict(leader) if leader else None
    g["member_count"] = db.execute("SELECT COUNT(*) FROM users WHERE group_id=?", (g["id"],)).fetchone()[0]
    return g


@app.post("/api/me/upgrade-to-leader")
def upgrade_to_leader(user=Depends(require_user)):
    """Permet à un utilisateur 'solo' SANS groupe de devenir 'leader' pour créer son propre groupe.
    Règles :
      - Le rôle actuel doit être 'solo' (pas déjà leader, pas admin)
      - L'utilisateur ne doit pas être membre d'un groupe existant
        (sinon il faut quitter le groupe d'abord — non implémenté car les groupes
        sont définitifs durant la compétition pour l'équité du classement)
    Après upgrade, l'utilisateur pourra appeler POST /api/groups pour créer son groupe.
    """
    if user["role"] == "leader":
        raise HTTPException(400, "Tu es déjà leader")
    if user["role"] == "admin":
        raise HTTPException(400, "Un admin ne peut pas être leader d'un groupe public")
    if user.get("group_id"):
        # Cas où le user est membre d'un autre groupe : on refuse car les groupes
        # sont verrouillés pendant la compétition (cf. règle d'équité du classement).
        raise HTTPException(
            400,
            "Tu fais déjà partie d'un groupe. Tu ne peux pas le quitter pendant la compétition. "
            "Contacte l'admin si tu as une situation particulière."
        )
    if user["role"] != "solo":
        raise HTTPException(400, "Seul un compte solo peut devenir leader")

    with get_db() as db:
        db.execute("UPDATE users SET role='leader' WHERE id=?", (user["id"],))
        log_action(user["id"], "role_upgrade", "solo -> leader", db=db)

    return {"ok": True, "new_role": "leader"}


@app.post("/api/groups")
def create_group(data: GroupCreate, user=Depends(require_user)):
    """Crée un groupe. L'utilisateur doit être 'leader' (pas solo, pas membre d'un autre groupe)."""
    if user["role"] != "leader":
        raise HTTPException(403, "Seul un compte leader peut créer un groupe")
    with get_db() as db:
        # Vérifier qu'il n'a pas déjà un groupe
        existing = db.execute("SELECT id FROM groups WHERE leader_id=?", (user["id"],)).fetchone()
        if existing:
            raise HTTPException(400, "Tu as déjà un groupe")

        # Générer slug unique
        base_slug = slugify(data.name)
        slug = base_slug
        i = 2
        while db.execute("SELECT 1 FROM groups WHERE slug=?", (slug,)).fetchone():
            slug = f"{base_slug}-{i}"
            i += 1

        # Générer invite code unique
        for _ in range(10):
            code = generate_invite_code()
            if not db.execute("SELECT 1 FROM groups WHERE invite_code=?", (code,)).fetchone():
                break
        else:
            raise HTTPException(500, "Erreur génération code")

        cur = db.execute(
            """INSERT INTO groups (name, slug, description, logo_data, invite_code, leader_id)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (data.name, slug, data.description or "", data.logo_data, code, user["id"]),
        )
        group_id = cur.lastrowid
        # Le leader rejoint son propre groupe
        db.execute("UPDATE users SET group_id=? WHERE id=?", (group_id, user["id"]))
        log_action(user["id"], "group_create", f"id={group_id} name={data.name}", db=db)

        row = db.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
        return serialize_group(row, db)


@app.get("/api/groups/me")
def my_group(user=Depends(require_user)):
    """Retourne le groupe de l'utilisateur connecté (s'il en a un)."""
    with get_db() as db:
        if user["role"] == "leader":
            row = db.execute("SELECT * FROM groups WHERE leader_id=?", (user["id"],)).fetchone()
        elif user.get("group_id"):
            row = db.execute("SELECT * FROM groups WHERE id=?", (user["group_id"],)).fetchone()
        else:
            return None
        if not row:
            return None
        return serialize_group(row, db)


@app.get("/api/groups/{group_id}/members")
def list_group_members(group_id: int, user=Depends(require_user)):
    """Liste les membres d'un groupe avec leur classement (points + pronos).
    Accessible à tout membre du groupe (pour voir le classement interne),
    au leader du groupe, et aux admins.
    """
    with get_db() as db:
        group = db.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
        if not group:
            raise HTTPException(404, "Groupe introuvable")

        # Vérifier les droits : leader, admin, OU membre du groupe
        is_leader = user["role"] == "leader" and group["leader_id"] == user["id"]
        is_admin = user["role"] == "admin"
        is_member = user.get("group_id") == group_id
        if not (is_leader or is_admin or is_member):
            raise HTTPException(403, "Accès refusé : tu dois être membre du groupe")

        # Identifier le leader pour le badge frontend
        leader_id = group["leader_id"]

        rows = db.execute(
            """SELECT u.id, u.username, u.role, u.created_at, u.avatar_data,
                      COALESCE((SELECT SUM(p.points) FROM predictions p WHERE p.user_id=u.id), 0) AS points,
                      (SELECT COUNT(p.id) FROM predictions p WHERE p.user_id=u.id) AS predictions_count
               FROM users u WHERE u.group_id=?
               ORDER BY points DESC, predictions_count DESC, u.username""",
            (group_id,),
        ).fetchall()

        # Inclure l'email uniquement pour le leader/admin (RGPD : confidentialité)
        result = []
        for r in rows:
            d = dict(r)
            d["is_leader"] = (d["id"] == leader_id)
            if is_leader or is_admin:
                # Le leader et l'admin voient l'email
                email_row = db.execute("SELECT email FROM users WHERE id=?", (d["id"],)).fetchone()
                d["email"] = email_row["email"] if email_row else None
            else:
                # Les autres membres NE voient PAS l'email des autres (RGPD)
                d["email"] = None
            result.append(d)

        return result


@app.put("/api/groups/{group_id}")
def update_group(group_id: int, data: GroupUpdate, user=Depends(require_user)):
    """Met à jour un groupe (nom, description, logo). Leader du groupe ou admin."""
    with get_db() as db:
        group = db.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
        if not group:
            raise HTTPException(404, "Groupe introuvable")
        is_leader = user["role"] == "leader" and group["leader_id"] == user["id"]
        is_admin = user["role"] == "admin"
        if not (is_leader or is_admin):
            raise HTTPException(403, "Accès refusé")

        updates = []
        params = []
        if data.name is not None:
            updates.append("name=?"); params.append(data.name)
            new_slug = slugify(data.name)
            # éviter collision si on change le nom
            if not db.execute("SELECT 1 FROM groups WHERE slug=? AND id!=?", (new_slug, group_id)).fetchone():
                updates.append("slug=?"); params.append(new_slug)
        if data.description is not None:
            updates.append("description=?"); params.append(data.description)
        if data.logo_data is not None:
            updates.append("logo_data=?"); params.append(data.logo_data)

        if updates:
            params.append(group_id)
            db.execute(f"UPDATE groups SET {', '.join(updates)} WHERE id=?", params)
            log_action(user["id"], "group_update", f"id={group_id}", db=db)

        row = db.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
        return serialize_group(row, db)


@app.post("/api/groups/join/{invite_code}")
def join_group(invite_code: str, user=Depends(require_user)):
    """Rejoint un groupe via code d'invitation. UNE FOIS rejoint, on est verrouillé."""
    invite_code = invite_code.upper().strip()
    with get_db() as db:
        group = db.execute("SELECT * FROM groups WHERE invite_code=?", (invite_code,)).fetchone()
        if not group:
            raise HTTPException(404, "Code d'invitation invalide")

        # Si déjà dans un groupe, refuser (verrouillé à vie)
        if user.get("group_id"):
            if user["group_id"] == group["id"]:
                raise HTTPException(400, "Tu fais déjà partie de ce groupe")
            raise HTTPException(403, "Tu es déjà membre d'un autre groupe — contacte l'administrateur pour changer")

        # Le leader d'un autre groupe ne peut pas rejoindre un autre groupe
        if user["role"] == "leader":
            existing_group = db.execute("SELECT id FROM groups WHERE leader_id=?", (user["id"],)).fetchone()
            if existing_group:
                raise HTTPException(403, "En tant que leader d'un autre groupe, tu ne peux pas rejoindre celui-ci")

        # L'admin ne rejoint pas de groupe
        if user["role"] == "admin":
            raise HTTPException(403, "Un administrateur ne rejoint pas de groupe")

        db.execute("UPDATE users SET group_id=? WHERE id=?", (group["id"], user["id"]))
        log_action(user["id"], "group_join", f"group_id={group['id']}", db=db)
        return serialize_group(group, db)


@app.get("/api/groups/preview/{invite_code}")
def preview_group(invite_code: str):
    """Pré-visualise un groupe avant de le rejoindre (page d'invitation publique)."""
    invite_code = invite_code.upper().strip()
    with get_db() as db:
        group = db.execute("SELECT * FROM groups WHERE invite_code=?", (invite_code,)).fetchone()
        if not group:
            raise HTTPException(404, "Code d'invitation invalide")
        g = serialize_group(group, db)
        # On n'expose pas les infos sensibles
        return {
            "name": g["name"],
            "description": g["description"],
            "logo_data": g["logo_data"],
            "member_count": g["member_count"],
            "leader_username": g["leader"]["username"] if g["leader"] else None,
        }


# === ADMIN ENDPOINTS POUR LES GROUPES ===

@app.get("/api/admin/groups")
def admin_list_groups(user=Depends(require_admin)):
    """Liste tous les groupes (admin only)."""
    with get_db() as db:
        rows = db.execute("SELECT * FROM groups ORDER BY created_at DESC").fetchall()
        return [serialize_group(r, db) for r in rows]


@app.delete("/api/admin/groups/{group_id}")
def admin_delete_group(group_id: int, user=Depends(require_admin)):
    """Supprime un groupe (admin only). Les membres redeviennent solo."""
    with get_db() as db:
        group = db.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
        if not group:
            raise HTTPException(404, "Groupe introuvable")
        # Détacher les membres → solo
        db.execute("UPDATE users SET group_id=NULL WHERE group_id=?", (group_id,))
        # Le leader redevient solo aussi
        db.execute("UPDATE users SET role='solo' WHERE id=?", (group["leader_id"],))
        # Supprimer le groupe
        db.execute("DELETE FROM groups WHERE id=?", (group_id,))
        log_action(user["id"], "admin_delete_group", f"id={group_id}", db=db)
        return {"ok": True}


@app.delete("/api/admin/groups/{group_id}/members/{user_id}")
def admin_remove_member(group_id: int, user_id: int, user=Depends(require_admin)):
    """Retire un membre d'un groupe (admin only). Le membre redevient solo."""
    with get_db() as db:
        member = db.execute("SELECT * FROM users WHERE id=? AND group_id=?", (user_id, group_id)).fetchone()
        if not member:
            raise HTTPException(404, "Membre introuvable dans ce groupe")
        # Refuser de retirer le leader (faut supprimer le groupe à la place)
        group = db.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
        if group and group["leader_id"] == user_id:
            raise HTTPException(400, "Impossible de retirer le leader. Supprime le groupe à la place.")
        db.execute("UPDATE users SET group_id=NULL WHERE id=?", (user_id,))
        log_action(user["id"], "admin_remove_member", f"user={user_id} group={group_id}", db=db)
        return {"ok": True}


@app.delete("/api/groups/{group_id}/members/{user_id}")
def leader_remove_member(group_id: int, user_id: int, user=Depends(get_current_user)):
    """Retire un membre d'un groupe par le LEADER du groupe.

    Règles :
    - Seul le leader du groupe peut retirer un membre (ou un admin via l'autre endpoint)
    - Le leader ne peut pas se retirer lui-même (il doit supprimer le groupe à la place)
    - Le membre retiré redevient solo (group_id = NULL) MAIS conserve ses pronos
      et points (pas de suppression de données)
    - Action loggée pour audit (le membre peut être averti par l'admin si besoin)
    """
    with get_db() as db:
        group = db.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
        if not group:
            raise HTTPException(404, "Groupe introuvable")

        # Vérification : l'utilisateur courant est-il le leader de ce groupe ?
        # (un admin doit passer par /api/admin/groups/{group_id}/members/{user_id})
        is_leader = (group["leader_id"] == user["id"])
        if not is_leader:
            raise HTTPException(403, "Seul le leader du groupe peut retirer un membre")

        # Empêcher le leader de se retirer lui-même
        if user_id == user["id"]:
            raise HTTPException(
                400,
                "Tu ne peux pas te retirer de ton propre groupe. Pour quitter, "
                "il faut soit transférer le leadership (via l'admin), soit supprimer le groupe."
            )

        # Vérifier que la personne est bien dans CE groupe
        member = db.execute(
            "SELECT id, username FROM users WHERE id=? AND group_id=?",
            (user_id, group_id)
        ).fetchone()
        if not member:
            raise HTTPException(404, "Cette personne n'est pas dans ton groupe")

        # Retire le membre (passe en solo) : ses pronos et points sont conservés
        db.execute("UPDATE users SET group_id=NULL WHERE id=?", (user_id,))
        log_action(
            user["id"],
            "leader_remove_member",
            f"removed_user={user_id} ({member['username']}) from group={group_id}",
            db=db,
        )

        # Invalide le cache : le classement des groupes va changer
        cache_invalidate("leaderboard:")

        return {"ok": True, "removed_username": member["username"]}


@app.post("/api/admin/groups/{group_id}/regenerate-code")
def admin_regenerate_code(group_id: int, user=Depends(require_admin)):
    """Régénère le code d'invitation d'un groupe (admin only)."""
    with get_db() as db:
        group = db.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
        if not group:
            raise HTTPException(404, "Groupe introuvable")
        for _ in range(10):
            new_code = generate_invite_code()
            if not db.execute("SELECT 1 FROM groups WHERE invite_code=?", (new_code,)).fetchone():
                break
        else:
            raise HTTPException(500, "Erreur génération code")
        db.execute("UPDATE groups SET invite_code=? WHERE id=?", (new_code, group_id))
        log_action(user["id"], "regenerate_invite", f"group={group_id}", db=db)
        return {"invite_code": new_code}


# =====================================================
# PROFIL utilisateur — username, avatar, bio, langue, thème, mot de passe
# =====================================================

class ProfileUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=2, max_length=40)
    bio: Optional[str] = Field(None, max_length=140)
    avatar_data: Optional[str] = Field(None, max_length=800_000)  # ~500 KB base64
    lang: Optional[str] = Field(None, pattern="^(fr|en|es)$")
    theme: Optional[str] = Field(None, pattern="^(light|dark)$")


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=100)


@app.get("/api/profile")
def get_profile(user=Depends(require_user)):
    """Retourne le profil complet de l'utilisateur connecté."""
    with get_db() as db:
        row = db.execute(
            """SELECT id, email, username, role, group_id,
                      avatar_data, bio, lang, theme, created_at
               FROM users WHERE id=?""",
            (user["id"],)
        ).fetchone()
        return dict(row) if row else None


@app.put("/api/profile")
def update_profile(data: ProfileUpdate, user=Depends(require_user)):
    """Met à jour le profil (username, bio, avatar, lang, theme)."""
    with get_db() as db:
        updates = []
        params = []
        if data.username is not None:
            updates.append("username=?"); params.append(data.username)
        if data.bio is not None:
            updates.append("bio=?"); params.append(data.bio)
        if data.avatar_data is not None:
            # Si chaîne vide → on retire l'avatar
            updates.append("avatar_data=?"); params.append(data.avatar_data if data.avatar_data else None)
        if data.lang is not None:
            updates.append("lang=?"); params.append(data.lang)
        if data.theme is not None:
            updates.append("theme=?"); params.append(data.theme)

        if not updates:
            raise HTTPException(400, "Rien à mettre à jour")

        params.append(user["id"])
        db.execute(f"UPDATE users SET {', '.join(updates)} WHERE id=?", params)
        log_action(user["id"], "profile_update", ",".join([u.split("=")[0] for u in updates]), db=db)

        # Retourne le profil mis à jour
        row = db.execute(
            """SELECT id, email, username, role, group_id,
                      avatar_data, bio, lang, theme FROM users WHERE id=?""",
            (user["id"],)
        ).fetchone()
        return dict(row)


@app.put("/api/profile/password")
def change_password(data: PasswordChange, user=Depends(require_user)):
    """Change le mot de passe (l'ancien doit être fourni en sécurité)."""
    with get_db() as db:
        row = db.execute("SELECT password_hash FROM users WHERE id=?", (user["id"],)).fetchone()
        if not row or not pwd_context.verify(data.current_password, row["password_hash"]):
            log_action(user["id"], "password_change_failed", "wrong_old_pwd", db=db)
            raise HTTPException(401, "Ancien mot de passe incorrect")
        new_hash = pwd_context.hash(data.new_password)
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (new_hash, user["id"]))
        log_action(user["id"], "password_change", "ok", db=db)
        return {"ok": True}


# =====================================================
# RESULTS — Récupération automatique des scores via Football-Data.org
# =====================================================
# API gratuite : 10 requêtes/min, accès libre à la World Cup (code "WC")
# Inscription : https://www.football-data.org/client/register
# Doc : https://docs.football-data.org/general/v4/match.html
# Format : GET https://api.football-data.org/v4/competitions/WC/matches
# Header : X-Auth-Token: <token>
# =====================================================

# Mapping nom équipe Football-Data.org → nom équipe dans notre BDD
# Si l'API renvoie "Mexico" (homeTeam.name="Mexico") on l'associe à "Mexique"
# Cette table est essentielle car les noms diffèrent entre l'API et notre BDD FR.
TEAM_NAME_MAPPING = {
    # Hôtes
    "Mexico": ["Mexique", "Mexico", "México"],
    "Canada": ["Canada"],
    "United States": ["États-Unis", "USA", "United States", "Estados Unidos"],
    # Europe
    "France": ["France", "Francia"],
    "Germany": ["Allemagne", "Germany", "Alemania"],
    "Spain": ["Espagne", "Spain", "España"],
    "England": ["Angleterre", "England", "Inglaterra"],
    "Italy": ["Italie", "Italy", "Italia"],
    "Portugal": ["Portugal"],
    "Netherlands": ["Pays-Bas", "Netherlands", "Países Bajos", "Holanda"],
    "Belgium": ["Belgique", "Belgium", "Bélgica"],
    "Croatia": ["Croatie", "Croatia", "Croacia"],
    "Switzerland": ["Suisse", "Switzerland", "Suiza"],
    "Czech Republic": ["Tchéquie", "Czech Republic", "Czechia", "Chequia", "République tchèque"],
    "Slovenia": ["Slovénie", "Slovenia", "Eslovenia"],
    "Scotland": ["Écosse", "Scotland", "Escocia"],
    "Norway": ["Norvège", "Norway", "Noruega"],
    # Amérique du Sud
    "Brazil": ["Brésil", "Brazil", "Brasil"],
    "Argentina": ["Argentine", "Argentina"],
    "Uruguay": ["Uruguay"],
    "Colombia": ["Colombie", "Colombia"],
    "Ecuador": ["Équateur", "Ecuador"],
    "Paraguay": ["Paraguay"],
    # Afrique
    "Morocco": ["Maroc", "Morocco", "Marruecos"],
    "Senegal": ["Sénégal", "Senegal"],
    "Cote d'Ivoire": ["Côte d'Ivoire", "Ivory Coast", "Costa de Marfil", "Cote d'Ivoire"],
    "Cameroon": ["Cameroun", "Cameroon", "Camerún"],
    "South Africa": ["Afrique du Sud", "South Africa", "Sudáfrica"],
    "Egypt": ["Égypte", "Egypt", "Egipto"],
    "Algeria": ["Algérie", "Algeria", "Argelia"],
    "Ghana": ["Ghana"],
    "DR Congo": ["RD Congo", "DR Congo", "DRC"],
    "Cape Verde": ["Cap-Vert", "Cape Verde", "Cabo Verde"],
    # Asie
    "Japan": ["Japon", "Japan", "Japón"],
    "South Korea": ["Corée du Sud", "South Korea", "Korea Republic", "Corea del Sur"],
    "Iran": ["Iran", "Irán", "IR Iran"],
    "Saudi Arabia": ["Arabie saoudite", "Saudi Arabia", "Arabia Saudita", "Arabia Saudí"],
    "Australia": ["Australie", "Australia"],
    "Qatar": ["Qatar"],
    "Uzbekistan": ["Ouzbékistan", "Uzbekistan"],
    "Jordan": ["Jordanie", "Jordan", "Jordania"],
    # CONCACAF
    "Curaçao": ["Curaçao", "Curacao", "Curazao"],
    "Haiti": ["Haïti", "Haiti"],
    "Costa Rica": ["Costa Rica"],
    # Océanie
    "New Zealand": ["Nouvelle-Zélande", "New Zealand", "Nueva Zelanda"],
}


def normalize_team_name(name: str) -> str:
    """Normalise un nom d'équipe pour la comparaison : lowercase + sans accents + sans espaces."""
    if not name:
        return ""
    import unicodedata
    nfkd = unicodedata.normalize('NFKD', name)
    no_accents = ''.join(c for c in nfkd if not unicodedata.combining(c))
    return no_accents.lower().strip().replace(' ', '').replace('-', '').replace("'", '')


def find_match_in_db(home_team_api: str, away_team_api: str, db) -> Optional[dict]:
    """Trouve un match dans notre BDD à partir des noms renvoyés par l'API Football-Data.org.
    Compare avec un mapping élargi + comparaison normalisée (sans accents/casse)."""
    # Récupérer toutes les variantes possibles pour chaque équipe
    home_variants = TEAM_NAME_MAPPING.get(home_team_api, [home_team_api])
    away_variants = TEAM_NAME_MAPPING.get(away_team_api, [away_team_api])

    home_norms = [normalize_team_name(v) for v in home_variants] + [normalize_team_name(home_team_api)]
    away_norms = [normalize_team_name(v) for v in away_variants] + [normalize_team_name(away_team_api)]

    rows = db.execute("SELECT id, home_team, away_team FROM matches").fetchall()
    for r in rows:
        h_norm = normalize_team_name(r["home_team"])
        a_norm = normalize_team_name(r["away_team"])
        # Match exact dans le bon sens
        if h_norm in home_norms and a_norm in away_norms:
            return dict(r)
        # Match dans l'autre sens (au cas où l'API et la BDD aient inversé)
        if h_norm in away_norms and a_norm in home_norms:
            # On garde l'ordre BDD ; on signalera l'inversion si besoin
            return dict(r)
    return None


def fetch_match_results() -> dict:
    """Appelle l'API Football-Data.org pour la World Cup et met à jour les scores
    des matchs terminés dans notre BDD. Recalcule automatiquement les points.
    Retourne un dict avec les statistiques (matches_updated, errors, ...)."""
    api_key = os.environ.get("FOOTBALL_DATA_API_KEY")
    if not api_key:
        return {"ok": False, "error": "FOOTBALL_DATA_API_KEY non défini"}

    stats = {"checked": 0, "updated": 0, "skipped": 0, "errors": 0, "details": []}
    try:
        req = urllib.request.Request(
            "https://api.football-data.org/v4/competitions/WC/matches",
            headers={
                "X-Auth-Token": api_key,
                "User-Agent": "PRONO2026/1.0",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json_lib.loads(resp.read().decode('utf-8'))
            api_matches = data.get("matches", [])
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"HTTP {e.code}: {e.reason}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

    with get_db() as db:
        for m in api_matches:
            stats["checked"] += 1
            status = m.get("status")
            # On ne traite que les matchs FINISHED ou IN_PLAY/PAUSED (pour scores live)
            if status not in ("FINISHED", "IN_PLAY", "PAUSED", "AWARDED"):
                continue

            home_name = m.get("homeTeam", {}).get("name") or ""
            away_name = m.get("awayTeam", {}).get("name") or ""
            score = m.get("score", {})
            full_time = score.get("fullTime", {})
            home_score = full_time.get("home")
            away_score = full_time.get("away")

            # Si pas encore de score, ignore
            if home_score is None or away_score is None:
                continue

            db_match = find_match_in_db(home_name, away_name, db)
            if not db_match:
                stats["errors"] += 1
                stats["details"].append(f"⚠ Match introuvable en BDD : {home_name} vs {away_name}")
                continue

            # Vérifier si on doit vraiment update (score différent ou pas encore terminé)
            current = db.execute(
                "SELECT home_score, away_score, status FROM matches WHERE id=?",
                (db_match["id"],),
            ).fetchone()

            new_status = "finished" if status in ("FINISHED", "AWARDED") else "live"

            # Sécurité : ne pas écraser un match qui était déjà marqué FINISHED en BDD
            # avec un nouveau statut "live" (l'API peut être en retard)
            if current["status"] == "finished" and new_status == "live":
                stats["skipped"] += 1
                continue

            need_update = (
                current["home_score"] != home_score
                or current["away_score"] != away_score
                or current["status"] != new_status
            )

            if not need_update:
                stats["skipped"] += 1
                continue

            db.execute(
                "UPDATE matches SET home_score=?, away_score=?, status=? WHERE id=?",
                (home_score, away_score, new_status, db_match["id"]),
            )
            stats["updated"] += 1
            stats["details"].append(
                f"✓ {home_name} {home_score}-{away_score} {away_name} ({new_status})"
            )

        # Recalculer les points pour les matchs FINISHED qui ont été mis à jour
        # (le recalc s'occupe de mettre points=0 si le match est en cours)
        for m in api_matches:
            if m.get("status") in ("FINISHED", "AWARDED"):
                full_time = m.get("score", {}).get("fullTime", {})
                if full_time.get("home") is None or full_time.get("away") is None:
                    continue
                home_name = m.get("homeTeam", {}).get("name") or ""
                away_name = m.get("awayTeam", {}).get("name") or ""
                db_match = find_match_in_db(home_name, away_name, db)
                if db_match:
                    try:
                        recalc_match_points(db_match["id"])
                    except Exception as e:
                        print(f"[RESULTS] recalc erreur match {db_match['id']}: {e}")

    return {"ok": True, **stats}


# Worker en arrière-plan : scan toutes les 5 minutes pendant les jours de match
def results_worker():
    """Tourne en boucle : scanne les résultats toutes les 5 min si la clé API est définie."""
    if not os.environ.get("FOOTBALL_DATA_API_KEY"):
        print("[RESULTS] Worker désactivé (FOOTBALL_DATA_API_KEY non défini)")
        return
    print("[RESULTS] Worker démarré — fetch toutes les 5 min")
    while True:
        try:
            r = fetch_match_results()
            if r.get("ok"):
                if r.get("updated", 0) > 0:
                    print(f"[RESULTS] {r['updated']} match(s) mis à jour, {r['skipped']} déjà à jour")
            else:
                print(f"[RESULTS] erreur: {r.get('error')}")
        except Exception as e:
            print(f"[RESULTS] worker erreur : {e}")
        time.sleep(300)  # 5 minutes


@app.post("/api/admin/results/fetch")
def admin_fetch_results(user=Depends(require_admin)):
    """Force la récupération des résultats depuis Football-Data.org.
    Utile pour rafraîchir manuellement. Renvoie les stats du fetch."""
    result = fetch_match_results()
    log_action(user["id"], "fetch_results", str(result.get("updated", 0)))
    return result


# =====================================================
# CONTACT — formulaire + envoi email + stockage BDD
# Sécurité multi-couches anti-spam :
# 1. Honeypot (champ caché)
# 2. Time trap (formulaire trop rapide = bot)
# 3. Rate limit IP (3/heure)
# 4. Rate limit email (2/jour)
# 5. Détection mots-clés spam
# 6. Détection liens excessifs
# 7. Filtrage emails jetables
# 8. Blacklist IP persistante
# 9. Cloudflare Turnstile (optionnel)
# =====================================================

class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    subject: Optional[str] = Field(None, max_length=120)
    message: str = Field(min_length=10, max_length=2000)
    # Honeypot anti-bot : doit rester vide
    website: Optional[str] = Field(None, max_length=200)
    # Timestamp d'ouverture du formulaire (pour détecter remplissage trop rapide)
    form_loaded_at: Optional[int] = None
    # Token Cloudflare Turnstile (optionnel)
    turnstile_token: Optional[str] = None


# Mots-clés typiques du spam
SPAM_KEYWORDS = [
    # Crypto / arnaques
    "bitcoin", "btc", "crypto investment", "forex", "trading signals",
    "earn $", "earn money", "make $", "passive income", "work from home",
    "binary option", "investment opportunity", "wealth", "millionaire",
    # Pharmacie / casino
    "viagra", "cialis", "casino", "poker online", "betting tips",
    "bet365", "1xbet", "online casino",
    # SEO / backlinks
    "seo service", "backlink", "guest post", "link building",
    "buy followers", "instagram followers", "youtube subscribers",
    "rank #1", "first page google", "domain authority",
    # Phishing / scams
    "verify your account", "suspended account", "click here urgently",
    "congratulations you won", "lottery winner", "inheritance",
    "nigerian prince", "western union", "money transfer",
    # SMS / notifications spam
    "telegram channel", "whatsapp +",
    # Russe / chinois fréquents en spam
    "купить", "продажа", "服务", "代理", "投资",
]

# Domaines d'emails jetables (top 50)
DISPOSABLE_EMAIL_DOMAINS = {
    "10minutemail.com", "tempmail.com", "guerrillamail.com", "mailinator.com",
    "throwaway.email", "yopmail.com", "trashmail.com", "fakeinbox.com",
    "tempinbox.com", "dispostable.com", "maildrop.cc", "mintemail.com",
    "mohmal.com", "sharklasers.com", "spam4.me", "tempr.email",
    "throwawaymail.com", "tempmail.io", "mailcatch.com", "mytemp.email",
    "spamgourmet.com", "tempmailaddress.com", "emailondeck.com", "burnermail.io",
    "mail-temporaire.fr", "jetable.org", "yopmail.fr", "tempemail.com",
    "trashmail.de", "wegwerfemail.de", "10minutemail.net", "20minutemail.com",
    "33mail.com", "fakemail.net", "fakeemail.com", "mailtemp.info",
    "tempmail.org", "tempmailo.com", "tempmail.us.com", "harakirimail.com",
    "getairmail.com", "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de",
    "spambox.us", "incognitomail.org", "anonbox.net", "trbvm.com",
}


# Blacklist IP en mémoire (auto-promue après abus)
_ip_blacklist = set()
# Rate limit IP : {ip: [timestamp1, ...]}
_contact_rate_ip = {}
# Rate limit email : {email: [timestamp1, ...]}
_contact_rate_email = {}
# Compteur d'abus par IP : {ip: count}
_abuse_count = {}


def detect_spam(name: str, email: str, subject: str, message: str) -> Optional[str]:
    """Retourne une raison si c'est du spam, None sinon."""
    full_text = f"{name} {subject} {message}".lower()

    # 1. Email jetable
    domain = email.split("@")[-1].lower() if "@" in email else ""
    if domain in DISPOSABLE_EMAIL_DOMAINS:
        return "disposable_email"

    # 2. Mots-clés spam
    spam_hits = [kw for kw in SPAM_KEYWORDS if kw in full_text]
    if len(spam_hits) >= 1:
        return f"spam_keywords:{spam_hits[0]}"

    # 3. Trop de liens (>2 URLs dans le message = SEO spam)
    import re
    urls = re.findall(r'https?://\S+|www\.\S+', message)
    if len(urls) > 2:
        return "too_many_links"

    # 4. Détection de "TOUTES MAJUSCULES" sur >40% du message
    if len(message) > 30:
        upper_count = sum(1 for c in message if c.isupper())
        letter_count = sum(1 for c in message if c.isalpha())
        if letter_count > 0 and upper_count / letter_count > 0.6:
            return "excessive_caps"

    # 5. Répétition de caractères (ex: "aaaaaaaaa", "!!!!!!!!!!!")
    if re.search(r'(.)\1{8,}', message):
        return "char_repetition"

    # 6. Nom suspect (uniquement chiffres ou caractères bizarres)
    if re.match(r'^[\d\W_]+$', name) or len(name.split()) > 6:
        return "suspicious_name"

    # 7. Email et nom identiques (signe d'auto-génération)
    if name.lower() == email.lower().split("@")[0]:
        # OK pour des humains aussi ("john.smith"), donc on ne bloque pas, juste warning
        pass

    # 8. Message contient le sujet répété (bot lazy)
    if subject and len(subject) > 20 and message.count(subject) > 1:
        return "subject_repetition"

    return None


def can_send_by_ip(ip: str) -> tuple[bool, str]:
    """Vérifie le rate limit par IP. Retourne (autorisé, raison)."""
    if ip in _ip_blacklist:
        return False, "ip_blacklisted"
    now = time.time()
    one_hour_ago = now - 3600
    if ip not in _contact_rate_ip:
        _contact_rate_ip[ip] = []
    _contact_rate_ip[ip] = [t for t in _contact_rate_ip[ip] if t > one_hour_ago]
    if len(_contact_rate_ip[ip]) >= 3:
        return False, "rate_limit_ip"
    _contact_rate_ip[ip].append(now)
    return True, ""


def can_send_by_email(email: str) -> tuple[bool, str]:
    """Vérifie le rate limit par email (max 2/jour)."""
    now = time.time()
    one_day_ago = now - 86400
    email = email.lower()
    if email not in _contact_rate_email:
        _contact_rate_email[email] = []
    _contact_rate_email[email] = [t for t in _contact_rate_email[email] if t > one_day_ago]
    if len(_contact_rate_email[email]) >= 2:
        return False, "rate_limit_email"
    _contact_rate_email[email].append(now)
    return True, ""


def record_abuse(ip: str):
    """Incrémente le compteur d'abus, blacklist après 5 tentatives."""
    _abuse_count[ip] = _abuse_count.get(ip, 0) + 1
    if _abuse_count[ip] >= 5:
        _ip_blacklist.add(ip)
        print(f"[CONTACT] IP blacklistée : {ip}")


def verify_turnstile(token: Optional[str], ip: str) -> bool:
    """Vérifie un token Cloudflare Turnstile (optionnel).
    Retourne True si OK ou si Turnstile n'est pas configuré."""
    secret = os.environ.get("TURNSTILE_SECRET")
    if not secret:
        return True  # Turnstile désactivé → on accepte
    if not token:
        return False
    try:
        data = urllib.parse.urlencode({
            'secret': secret,
            'response': token,
            'remoteip': ip,
        }).encode()
        req = urllib.request.Request(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            data=data,
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json_lib.loads(resp.read().decode())
            return bool(result.get('success'))
    except Exception as e:
        print(f"[TURNSTILE] erreur : {e}")
        return False


def send_admin_reply(to_email: str, to_name: str, original_subject: str, reply_body: str,
                     attachments: list = None) -> bool:
    """Envoie une réponse de l'admin à un utilisateur, depuis contact@unitedpronos.com.
    Préserve l'anonymat de l'admin (son mail perso n'est jamais exposé).

    attachments : liste de dicts {"filename": str, "data": str (base64 data URL), "mime": str}
                  Format attendu pour data : "data:image/png;base64,iVBORw0KGgo..."
                  ou base64 brut (sans le préfixe data:...)

    Retourne True si envoyé, False si SMTP non configuré ou erreur."""
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASSWORD")
    # On utilise SMTP_FROM (= contact@unitedpronos.com par défaut)
    smtp_from = os.environ.get("SMTP_FROM", smtp_user)
    reply_to = os.environ.get("CONTACT_EMAIL", smtp_from)

    if not all([smtp_host, smtp_user, smtp_pass, to_email]):
        print("[ADMIN_REPLY] SMTP non configuré")
        return False

    try:
        # Structure MIME correcte pour éviter la duplication texte/HTML :
        # - multipart/mixed = container global (texte/HTML + pièces jointes)
        # - multipart/alternative = "voici 2 versions du MÊME message" → client choisit une seule
        msg = MIMEMultipart("mixed")
        msg["From"] = f"United Pronos <{smtp_from}>"
        msg["To"] = to_email
        msg["Reply-To"] = reply_to
        clean_subject = (original_subject or "ta demande").strip()
        if not clean_subject.lower().startswith("re:"):
            clean_subject = f"Re: {clean_subject}"
        msg["Subject"] = clean_subject

        hello = f"Bonjour {to_name}," if to_name else "Bonjour,"

        body = f"""{hello}

{reply_body}

—
L'équipe United Pronos
https://unitedpronos.com

Tu peux répondre directement à ce mail, ton message nous parviendra.
"""

        html_body = f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>{hello}</p>
  <div style="white-space: pre-wrap; padding: 16px 0;">{reply_body}</div>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="font-size: 14px; color: #666;">
    L'équipe <strong style="color: #f97316;">United Pronos</strong><br>
    <a href="https://unitedpronos.com" style="color: #f97316;">unitedpronos.com</a>
  </p>
  <p style="font-size: 12px; color: #999; margin-top: 16px;">
    Tu peux répondre directement à ce mail, ton message nous parviendra.
  </p>
</body>
</html>"""

        # Sous-container "alternative" qui contient les 2 versions du MÊME message.
        # Le client mail choisit UNE SEULE des deux (HTML si supporté, texte sinon).
        alt_part = MIMEMultipart("alternative")
        alt_part.attach(MIMEText(body, "plain", "utf-8"))
        alt_part.attach(MIMEText(html_body, "html", "utf-8"))
        msg.attach(alt_part)

        # Pièces jointes (images)
        if attachments:
            import base64
            for att in attachments:
                try:
                    filename = att.get("filename", "image.png")
                    mime = att.get("mime", "image/png")
                    data = att.get("data", "")
                    # Si format data URL, on retire le préfixe
                    if data.startswith("data:"):
                        data = data.split(",", 1)[1] if "," in data else ""
                    if not data:
                        continue
                    binary = base64.b64decode(data)
                    # Si c'est une image, on utilise MIMEImage
                    if mime.startswith("image/"):
                        img_subtype = mime.split("/", 1)[1] if "/" in mime else "png"
                        img = MIMEImage(binary, _subtype=img_subtype)
                        img.add_header("Content-Disposition", "attachment", filename=filename)
                        msg.attach(img)
                    else:
                        # Autres types (PDF, etc.)
                        part = MIMEBase("application", "octet-stream")
                        part.set_payload(binary)
                        encoders.encode_base64(part)
                        part.add_header("Content-Disposition", "attachment", filename=filename)
                        msg.attach(part)
                except Exception as e:
                    print(f"[ADMIN_REPLY] Erreur PJ {att.get('filename')}: {e}")
                    continue

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)

        print(f"[ADMIN_REPLY] Réponse envoyée à {to_email} ({len(attachments) if attachments else 0} PJ)")
        return True
    except Exception as e:
        print(f"[ADMIN_REPLY] Erreur SMTP : {e}")
        return False


def _send_email_html(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """Helper interne pour envoyer un mail multipart/alternative (texte + HTML).
    Réutilisable par les fonctions email transactionnelles (bienvenue, reset, etc.)."""
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASSWORD")
    smtp_from = os.environ.get("SMTP_FROM", smtp_user)
    reply_to = os.environ.get("CONTACT_EMAIL", smtp_from)

    if not all([smtp_host, smtp_user, smtp_pass, to_email]):
        print(f"[EMAIL] SMTP non configuré, mail non envoyé à {to_email}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"United Pronos <{smtp_from}>"
        msg["To"] = to_email
        msg["Reply-To"] = reply_to
        msg["Subject"] = subject
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)

        print(f"[EMAIL] Envoyé : '{subject}' à {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL] Erreur envoi à {to_email} : {e}")
        return False


def send_welcome_email(email: str, username: str) -> bool:
    """Envoie un email de bienvenue après inscription.
    NE CONTIENT PAS le mot de passe (sécurité).
    Rappelle l'email de connexion + lien direct + guide rapide."""
    site_url = os.environ.get("SITE_URL", "https://unitedpronos.com")

    text_body = f"""Bonjour {username},

Bienvenue sur United Pronos ! 🎉

Ton compte a été créé avec succès. Voici tes infos de connexion :

   📧 Email : {email}
   🔑 Mot de passe : celui que tu viens de définir

Pour te connecter, va sur : {site_url}

🎯 PREMIERS PAS
- Découvre les 104 matchs de la Coupe du Monde 2026
- Fais tes pronostics avant le coup d'envoi
- Rejoins ou crée un groupe avec tes amis/collègues
- Consulte les actualités foot en français

🆘 BESOIN D'AIDE ?
Une fois connecté, utilise la chat-box 💬 en bas à droite pour nous contacter directement.

🔐 MOT DE PASSE OUBLIÉ ?
Pas de panique ! Tu peux le réinitialiser à tout moment depuis la page de connexion via le lien "Mot de passe oublié ?".

Bonne compétition !
L'équipe United Pronos
{site_url}
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ec4899 100%); padding: 32px 20px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🏆 Bienvenue sur United Pronos !</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">Coupe du Monde 2026</p>
  </div>

  <div style="background: white; padding: 32px 24px;">
    <p style="font-size: 16px;">Bonjour <strong>{username}</strong>,</p>
    <p>Ton compte a été créé avec succès ! 🎉 Tu es prêt à pronostiquer sur les 104 matchs du Mondial.</p>

    <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #666;"><strong>📧 Tes infos de connexion :</strong></p>
      <p style="margin: 8px 0 0 0; font-size: 15px;">
        <strong>Email :</strong> {email}<br>
        <strong>Mot de passe :</strong> celui que tu viens de définir
      </p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="{site_url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f97316, #ec4899); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
        🚀 Se connecter au site
      </a>
    </div>

    <h2 style="color: #f97316; font-size: 18px; margin-top: 32px;">🎯 Premiers pas</h2>
    <ul style="padding-left: 20px; color: #555;">
      <li>Découvre les <strong>104 matchs</strong> de la Coupe du Monde 2026</li>
      <li>Fais tes pronostics <strong>avant le coup d'envoi</strong></li>
      <li>Rejoins ou crée un <strong>groupe</strong> avec tes amis/collègues</li>
      <li>Suis l'actualité foot <strong>en français, anglais et espagnol</strong></li>
    </ul>

    <h2 style="color: #f97316; font-size: 18px; margin-top: 24px;">🆘 Besoin d'aide ?</h2>
    <p>Une fois connecté, utilise la <strong>chat-box 💬</strong> en bas à droite pour nous contacter directement. Réponses rapides garanties !</p>

    <h2 style="color: #f97316; font-size: 18px; margin-top: 24px;">🔐 Mot de passe oublié ?</h2>
    <p>Pas de panique ! Tu peux le réinitialiser à tout moment depuis la page de connexion via le lien <strong>"Mot de passe oublié ?"</strong>.</p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
    <p style="font-size: 14px; color: #666; text-align: center;">
      Bonne compétition ! ⚽<br>
      <strong style="color: #f97316;">L'équipe United Pronos</strong>
    </p>
  </div>

  <div style="background: #f5f5f5; padding: 16px; text-align: center; font-size: 12px; color: #999;">
    <a href="{site_url}" style="color: #f97316; text-decoration: none;">{site_url}</a>
  </div>
</body>
</html>"""

    return _send_email_html(
        to_email=email,
        subject=f"🏆 Bienvenue sur United Pronos, {username} !",
        html_body=html_body,
        text_body=text_body,
    )


def send_password_reset_email(email: str, username: str, reset_token: str) -> bool:
    """Envoie un email avec un lien de réinitialisation de mot de passe.
    Le lien expire dans 1h pour la sécurité."""
    site_url = os.environ.get("SITE_URL", "https://unitedpronos.com")
    reset_url = f"{site_url}/?reset_token={reset_token}"

    text_body = f"""Bonjour {username},

Tu as demandé à réinitialiser ton mot de passe sur United Pronos.

Clique sur ce lien pour définir un nouveau mot de passe :
{reset_url}

⚠️ Ce lien est valable 1 heure seulement.

Si tu n'as pas demandé cette réinitialisation, ignore simplement cet email.
Ton mot de passe ne sera pas modifié.

🔐 SÉCURITÉ
Ne partage jamais ce lien avec personne. L'équipe United Pronos
ne te demandera jamais ton mot de passe par email.

L'équipe United Pronos
{site_url}
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ec4899 100%); padding: 32px 20px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 26px;">🔐 Réinitialisation du mot de passe</h1>
  </div>

  <div style="background: white; padding: 32px 24px;">
    <p style="font-size: 16px;">Bonjour <strong>{username}</strong>,</p>
    <p>Tu as demandé à réinitialiser ton mot de passe sur United Pronos.</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="{reset_url}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f97316, #ec4899); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
        🔑 Définir un nouveau mot de passe
      </a>
    </div>

    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px;">
        ⏱️ <strong>Ce lien expire dans 1 heure.</strong>
      </p>
    </div>

    <p style="color: #666; font-size: 14px;">
      Tu peux aussi copier-coller cette URL dans ton navigateur :<br>
      <span style="word-break: break-all; color: #f97316; font-family: monospace; font-size: 12px;">{reset_url}</span>
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

    <p style="color: #666; font-size: 14px;">
      <strong>Tu n'as pas demandé cette réinitialisation ?</strong><br>
      Ignore simplement cet email. Ton mot de passe ne sera pas modifié.
    </p>

    <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 16px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #991b1b;">
        🔐 <strong>Sécurité</strong> : Ne partage jamais ce lien. L'équipe United Pronos
        ne te demandera jamais ton mot de passe par email.
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
    <p style="font-size: 14px; color: #666; text-align: center;">
      <strong style="color: #f97316;">L'équipe United Pronos</strong><br>
      <a href="{site_url}" style="color: #f97316; text-decoration: none;">{site_url}</a>
    </p>
  </div>
</body>
</html>"""

    return _send_email_html(
        to_email=email,
        subject="🔐 Réinitialise ton mot de passe sur United Pronos",
        html_body=html_body,
        text_body=text_body,
    )


def send_account_deletion_email(email: str, username: str, reason: str = "") -> bool:
    """Envoie un email de confirmation de suppression de compte (conforme RGPD Article 17).

    À envoyer AVANT la suppression effective en BDD, sinon on perd l'adresse email.
    L'email confirme à l'utilisateur :
    - Que son compte a bien été supprimé
    - Que ses données personnelles ont été effacées
    - Les données conservées (le cas échéant) et leur base légale
    - Comment exercer ses autres droits RGPD
    """
    site_url = os.environ.get("SITE_URL", "https://unitedpronos.com")
    contact_email = os.environ.get("CONTACT_EMAIL", "contact@unitedpronos.com")
    deletion_date = datetime.now(timezone.utc).strftime("%d/%m/%Y à %H:%M UTC")

    # Texte adapté si suppression sur demande de l'utilisateur ou décision admin
    reason_text = f"\n\nMotif communiqué : {reason}" if reason else ""

    text_body = f"""Bonjour {username},

Conformément à ta demande et à l'Article 17 du RGPD ("Droit à l'effacement"),
nous t'informons que ton compte United Pronos a été supprimé.

📅 Date de suppression : {deletion_date}
📧 Compte concerné : {email}{reason_text}

DONNÉES EFFACÉES
Toutes tes données personnelles ont été supprimées de nos systèmes :
- Identifiant, email, mot de passe (hashé)
- Avatar et biographie
- Pronostics et historique de jeu
- Appartenance aux groupes
- Conversations dans le chat interne
- Préférences (langue, thème)

DONNÉES CONSERVÉES (obligation légale uniquement)
Pour des raisons légales et de sécurité, certaines traces techniques peuvent être
conservées 1 an dans nos logs d'audit (anonymisées) : c'est requis par la
législation française et européenne en cas de litige ou de procédure judiciaire.

TES AUTRES DROITS RGPD
Tu peux à tout moment exercer tes droits :
- Droit d'accès aux données restantes
- Droit de rectification
- Droit à la portabilité
- Droit d'opposition

Pour toute question : {contact_email}

CRÉER UN NOUVEAU COMPTE
Tu es libre de revenir quand tu veux ! Tu peux créer un nouveau compte
à tout moment sur {site_url} (avec le même email ou un autre).

Merci d'avoir fait partie de la communauté United Pronos !

L'équipe United Pronos
{site_url}

---
Cet email est envoyé automatiquement après la suppression effective de ton compte.
Aucune action n'est requise de ta part. Si tu n'as PAS demandé cette suppression,
contacte-nous immédiatement à {contact_email}.
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; background: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 32px 20px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">✅ Suppression de compte confirmée</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Conforme RGPD — Article 17</p>
  </div>

  <div style="background: white; padding: 32px 24px;">
    <p style="font-size: 16px;">Bonjour <strong>{username}</strong>,</p>

    <p>Conformément à ta demande et à l'<strong>Article 17 du RGPD</strong> ("Droit à l'effacement"),
    nous t'informons que ton compte United Pronos a été supprimé avec succès.</p>

    <div style="background: #f3f4f6; border-left: 4px solid #6b7280; padding: 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px;">
        <strong>📅 Date de suppression :</strong> {deletion_date}<br>
        <strong>📧 Compte concerné :</strong> {email}{('<br><strong>📝 Motif :</strong> ' + reason) if reason else ''}
      </p>
    </div>

    <h2 style="color: #16a34a; font-size: 18px; margin-top: 32px;">✅ Données effacées</h2>
    <p style="color: #555; margin-bottom: 8px;">Toutes tes données personnelles ont été supprimées de nos systèmes :</p>
    <ul style="padding-left: 20px; color: #555;">
      <li>Identifiant, email, mot de passe (hashé)</li>
      <li>Avatar et biographie</li>
      <li>Pronostics et historique de jeu</li>
      <li>Appartenance aux groupes</li>
      <li>Conversations dans le chat interne</li>
      <li>Préférences (langue, thème)</li>
    </ul>

    <h2 style="color: #f59e0b; font-size: 18px; margin-top: 24px;">ℹ️ Données conservées (obligation légale)</h2>
    <p style="color: #555;">
      Pour des raisons légales et de sécurité, certaines traces techniques peuvent être
      conservées <strong>1 an dans nos logs d'audit</strong> (anonymisées) : c'est requis par
      la législation française et européenne en cas de litige ou de procédure judiciaire.
    </p>

    <h2 style="color: #3b82f6; font-size: 18px; margin-top: 24px;">🔐 Tes autres droits RGPD</h2>
    <p style="color: #555; margin-bottom: 8px;">Tu peux à tout moment exercer tes droits :</p>
    <ul style="padding-left: 20px; color: #555;">
      <li>Droit d'accès aux données restantes</li>
      <li>Droit de rectification</li>
      <li>Droit à la portabilité</li>
      <li>Droit d'opposition</li>
    </ul>
    <p style="color: #555;">Pour toute question : <a href="mailto:{contact_email}" style="color: #f97316;">{contact_email}</a></p>

    <div style="text-align: center; margin: 40px 0 24px 0; padding: 24px; background: #fff7ed; border-radius: 8px;">
      <p style="margin: 0 0 12px 0; color: #9a3412; font-weight: bold;">Tu peux revenir quand tu veux ! 👋</p>
      <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
        Crée un nouveau compte à tout moment, avec le même email ou un autre.
      </p>
      <a href="{site_url}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #f97316, #ec4899); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
        🏆 Retourner sur United Pronos
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

    <p style="font-size: 14px; color: #666; text-align: center;">
      Merci d'avoir fait partie de la communauté ! ⚽<br>
      <strong style="color: #f97316;">L'équipe United Pronos</strong>
    </p>

    <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 24px 0 0 0; border-radius: 4px; font-size: 13px;">
      <strong style="color: #991b1b;">⚠️ Tu n'as PAS demandé cette suppression ?</strong><br>
      <span style="color: #7f1d1d;">Contacte-nous immédiatement à <a href="mailto:{contact_email}" style="color: #991b1b;">{contact_email}</a>.</span>
    </div>
  </div>

  <div style="background: #f5f5f5; padding: 16px; text-align: center; font-size: 11px; color: #999;">
    Email automatique de confirmation de suppression de compte<br>
    <a href="{site_url}" style="color: #f97316; text-decoration: none;">{site_url}</a>
  </div>
</body>
</html>"""

    return _send_email_html(
        to_email=email,
        subject="✅ Suppression de ton compte United Pronos confirmée — RGPD",
        html_body=html_body,
        text_body=text_body,
    )


def send_contact_email(name: str, email: str, subject: str, message: str) -> bool:
    """Envoie le message de contact à l'admin via SMTP.
    Retourne True si envoyé, False si SMTP non configuré ou erreur."""
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASSWORD")
    smtp_to = os.environ.get("CONTACT_EMAIL")
    smtp_from = os.environ.get("SMTP_FROM", smtp_user)

    if not all([smtp_host, smtp_user, smtp_pass, smtp_to]):
        print("[CONTACT] SMTP non configuré — message stocké en BDD uniquement")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = smtp_from
        msg["To"] = smtp_to
        msg["Reply-To"] = email
        msg["Subject"] = f"[United Pronos] {subject or 'Nouveau message'} — de {name}"

        body = f"""Nouveau message de contact United Pronos

De     : {name} <{email}>
Sujet  : {subject or '(sans sujet)'}

Message :
{message}

---
Pour répondre, utilise le bouton "Répondre" de ton mail
(le Reply-To pointe sur l'expéditeur).
"""
        msg.attach(MIMEText(body, "plain", "utf-8"))

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)

        print(f"[CONTACT] Email envoyé à {smtp_to}")
        return True
    except Exception as e:
        print(f"[CONTACT] Erreur SMTP : {e}")
        return False


# =====================================================
# KOP UNITED — Chat communautaire global
# =====================================================
# Tous les inscrits peuvent y discuter. Modération automatique par filtre
# de mots interdits avant insertion. Anti-flood par utilisateur.

# Liste des mots interdits (insultes, racisme, sexisme, homophobie, etc.)
# FR + EN + ES. Le filtre est insensible à la casse et gère les contournements
# basiques (caractères spéciaux entre les lettres, leetspeak simple).
#
# Note : on inclut les variantes courantes mais on évite l'overfitting
# (ex: "merde" est toléré comme expression de frustration, "putain" idem).
# Le but est de bloquer les attaques verbales nominales et les discriminations.
BANNED_WORDS = {
    # === Discrimination raciale (FR/EN/ES) ===
    "negre", "nègre", "negro", "nigger", "nigga", "nig", "bougnoul", "bougnoule",
    "rebeu", "youpin", "chinetoque", "bridé", "chink",
    # === Insultes graves (FR) ===
    "enculé", "encule", "enculer", "encules", "enculés", "enculée",
    "fdp", "filsdepute", "filsdepu", "filsdeputain",
    "ntm", "nique ta mere", "niktamere", "niquetamere", "ta mère la pute",
    "pd", "pédé", "pede", "pedé", "tapette", "tafiole", "gouine",
    "salope", "salopes", "pute", "putes", "putain de salope",
    "connard", "connards", "connasse", "connasses",
    # === Insultes graves (EN) ===
    "faggot", "fag", "dyke", "tranny",
    "motherfucker", "cocksucker", "cunt", "twat",
    "retard", "retarded", "spastic",
    # === Insultes graves (ES) ===
    "maricón", "maricon", "marica", "puto", "putos", "puta de mierda",
    "cabrón", "cabron", "gilipollas", "hijoputa", "hijo de puta",
    # === Pédophilie / contenu sexuel envers mineurs (catégorie zero tolérance) ===
    "pedo", "pédo", "pédophile", "pedophile", "pedophilia",
    # === Spam / arnaques courants ===
    "telegram me", "send me btc", "free money", "click here win",
}

# Caractères de "bruit" utilisés pour contourner les filtres (à supprimer avant comparaison)
LEET_REPLACEMENTS = {
    "@": "a", "4": "a", "3": "e", "1": "i", "!": "i", "0": "o", "5": "s", "$": "s",
    "7": "t", "+": "t", ".": "", "-": "", "_": "", " ": "",
}

def _normalize_for_filter(text: str) -> str:
    """Normalise un texte pour comparaison avec la liste de mots interdits.
    - lowercase
    - retire accents (NFKD)
    - remplace leetspeak simple (a@4, e3, etc.)
    - retire ponctuation et espaces internes
    """
    import unicodedata
    text = text.lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    for src, dst in LEET_REPLACEMENTS.items():
        text = text.replace(src, dst)
    return text


def contains_banned_word(text: str) -> Optional[str]:
    """Vérifie si le texte contient un mot interdit. Retourne le mot trouvé (pour logging)
    ou None si OK."""
    normalized = _normalize_for_filter(text)
    for banned in BANNED_WORDS:
        # On normalise AUSSI les mots interdits pour la comparaison
        # (ex: "négre" et "negre" matchent tous les deux)
        banned_norm = _normalize_for_filter(banned)
        if banned_norm and banned_norm in normalized:
            return banned
    return None


class KopMessageIn(BaseModel):
    content: str


@app.get("/api/kop/messages")
def kop_list_messages(response: Response, before_id: Optional[int] = None, limit: int = 50):
    """Liste paginée des messages du chat Kop United (du plus récent au plus ancien).
    - before_id : pour pagination "charger plus ancien" (cursor-based)
    - limit : 50 max par défaut, plafonné à 100
    """
    limit = min(max(1, limit), 100)
    # Cache HTTP très court (3s) : les messages changent vite, mais on évite
    # quand même de marteler la BDD si plusieurs utilisateurs polent en même temps.
    response.headers["Cache-Control"] = "public, max-age=3"

    with get_db() as db:
        if before_id:
            rows = db.execute("""
                SELECT m.id, m.user_id, m.content, m.created_at, m.is_deleted,
                       u.username, u.avatar_data, u.role,
                       EXISTS(SELECT 1 FROM donations d WHERE d.user_id = u.id AND d.verified = 1) AS is_supporter
                FROM kop_messages m
                JOIN users u ON u.id = m.user_id
                WHERE m.id < ? AND m.is_deleted = 0
                ORDER BY m.id DESC
                LIMIT ?
            """, (before_id, limit)).fetchall()
        else:
            rows = db.execute("""
                SELECT m.id, m.user_id, m.content, m.created_at, m.is_deleted,
                       u.username, u.avatar_data, u.role,
                       EXISTS(SELECT 1 FROM donations d WHERE d.user_id = u.id AND d.verified = 1) AS is_supporter
                FROM kop_messages m
                JOIN users u ON u.id = m.user_id
                WHERE m.is_deleted = 0
                ORDER BY m.id DESC
                LIMIT ?
            """, (limit,)).fetchall()

    # Renvoie dans l'ordre chronologique (plus ancien en haut) pour le rendu côté front
    messages = [dict(r) for r in rows]
    messages.reverse()
    return {"messages": messages, "has_more": len(rows) == limit}


@app.post("/api/kop/messages")
def kop_post_message(data: KopMessageIn, user=Depends(get_current_user)):
    """Publie un message dans Kop United.
    Vérifications :
    - longueur (1 à 280 caractères)
    - anti-flood : max 10 messages dans les dernières 60 secondes par utilisateur
    - filtre de mots interdits
    """
    content = (data.content or "").strip()

    # Validation de base
    if not content:
        raise HTTPException(400, "Le message ne peut pas être vide")
    if len(content) > 280:
        raise HTTPException(400, "Message trop long (max 280 caractères)")

    # Filtre de mots interdits
    banned = contains_banned_word(content)
    if banned:
        # On log la tentative pour le suivi admin, mais on ne révèle pas le mot
        # dans le message d'erreur pour éviter le contournement par essai
        log_action(user["id"], "kop_blocked", f"contained='{banned[:30]}'")
        raise HTTPException(400, "Ton message contient des termes inappropriés. Merci de reformuler.")

    # Anti-flood : compte les messages du user dans les 60 dernières secondes
    with get_db() as db:
        recent_count = db.execute("""
            SELECT COUNT(*) AS n FROM kop_messages
            WHERE user_id = ? AND created_at > datetime('now', '-60 seconds')
        """, (user["id"],)).fetchone()["n"]
        if recent_count >= 10:
            raise HTTPException(429, "Tu envoies trop de messages. Attends quelques secondes avant de réessayer.")

        # Insertion
        cur = db.execute("""
            INSERT INTO kop_messages (user_id, content) VALUES (?, ?)
        """, (user["id"], content))
        msg_id = cur.lastrowid

        # Récupère le message complet pour réponse immédiate côté frontend
        row = db.execute("""
            SELECT m.id, m.user_id, m.content, m.created_at, m.is_deleted,
                   u.username, u.avatar_data, u.role,
                   EXISTS(SELECT 1 FROM donations d WHERE d.user_id = u.id AND d.verified = 1) AS is_supporter
            FROM kop_messages m
            JOIN users u ON u.id = m.user_id
            WHERE m.id = ?
        """, (msg_id,)).fetchone()

    return dict(row)


@app.delete("/api/kop/messages/{msg_id}")
def kop_delete_message(msg_id: int, user=Depends(get_current_user)):
    """Suppression d'un message :
    - L'auteur peut supprimer son propre message
    - Un admin peut supprimer n'importe quel message
    On utilise un soft-delete (is_deleted=1) pour conserver l'historique
    en cas de besoin d'audit.
    """
    with get_db() as db:
        msg = db.execute(
            "SELECT user_id, is_deleted FROM kop_messages WHERE id = ?",
            (msg_id,)
        ).fetchone()
        if not msg:
            raise HTTPException(404, "Message introuvable")
        if msg["is_deleted"]:
            raise HTTPException(404, "Message déjà supprimé")

        is_admin = user["role"] == "admin"
        is_author = msg["user_id"] == user["id"]
        if not (is_admin or is_author):
            raise HTTPException(403, "Tu ne peux pas supprimer ce message")

        reason = "admin_moderation" if is_admin and not is_author else "self_delete"
        db.execute("""
            UPDATE kop_messages
            SET is_deleted = 1, deleted_by = ?, deleted_reason = ?
            WHERE id = ?
        """, (user["id"], reason, msg_id))
        log_action(user["id"], "kop_delete", f"msg={msg_id} reason={reason}", db=db)

    return {"ok": True}


@app.post("/api/contact")
def contact(data: ContactIn, request: Request):
    """Endpoint public protégé contre le spam (9 couches de défense)."""
    client_ip = request.client.host if request.client else "unknown"

    # === COUCHE 1 : Honeypot (champ caché rempli = bot) ===
    if data.website:
        record_abuse(client_ip)
        # Faux succès pour ne pas révéler le filtre
        return {"ok": True}

    # === COUCHE 2 : Time trap (formulaire rempli en moins de 3 secondes = bot) ===
    if data.form_loaded_at:
        elapsed = (time.time() * 1000) - data.form_loaded_at
        if elapsed < 3000:  # moins de 3 secondes
            record_abuse(client_ip)
            return {"ok": True}  # faux succès silencieux
        if elapsed > 86400 * 1000:  # plus de 24h (token expiré)
            raise HTTPException(400, "Formulaire expiré, recharge la page")

    # === COUCHE 3 : Rate limit IP ===
    ok_ip, reason_ip = can_send_by_ip(client_ip)
    if not ok_ip:
        if reason_ip == "ip_blacklisted":
            return {"ok": True}  # silencieux pour les blacklistés
        raise HTTPException(429, "Trop de messages depuis ton IP — réessaie dans 1 heure")

    # === COUCHE 4 : Rate limit email ===
    ok_email, reason_email = can_send_by_email(data.email)
    if not ok_email:
        raise HTTPException(429, "Trop de messages depuis cet email — réessaie demain")

    # === COUCHE 5 : Détection spam (contenu) ===
    spam_reason = detect_spam(data.name, data.email, data.subject or "", data.message)
    if spam_reason:
        record_abuse(client_ip)
        print(f"[CONTACT] Spam détecté ({spam_reason}) depuis {client_ip}")
        # Réponse silencieuse (pour ne pas aider le spammeur à contourner)
        return {"ok": True}

    # === COUCHE 6 : Cloudflare Turnstile (si activé) ===
    if not verify_turnstile(data.turnstile_token, client_ip):
        record_abuse(client_ip)
        raise HTTPException(400, "Vérification anti-bot échouée — recharge la page")

    # === Toutes les couches passées : on enregistre et on envoie ===
    user_id = None
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            payload = decode_token(auth_header[7:])
            user_id = int(payload["sub"])
        except Exception:
            pass

    user_agent = request.headers.get("user-agent", "")[:200]

    with get_db() as db:
        db.execute(
            """INSERT INTO contact_messages
               (name, email, subject, message, user_id, ip, user_agent)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (data.name, data.email, data.subject or "", data.message, user_id, client_ip, user_agent),
        )

    sent = send_contact_email(data.name, data.email, data.subject or "", data.message)
    return {"ok": True, "email_sent": sent}


@app.get("/api/admin/contact-messages")
def admin_list_contacts(user=Depends(require_admin), status: Optional[str] = None, limit: int = 100):
    """Liste les messages de contact (admin uniquement)."""
    with get_db() as db:
        if status:
            rows = db.execute(
                "SELECT * FROM contact_messages WHERE status=? ORDER BY created_at DESC LIMIT ?",
                (status, limit),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]


@app.put("/api/admin/contact-messages/{msg_id}/status")
def admin_update_contact_status(msg_id: int, payload: dict, user=Depends(require_admin)):
    """Marque un message comme lu/répondu/archivé."""
    new_status = payload.get("status", "read")
    if new_status not in ("new", "read", "replied", "archived"):
        raise HTTPException(400, "Statut invalide")
    with get_db() as db:
        db.execute("UPDATE contact_messages SET status=? WHERE id=?", (new_status, msg_id))
        log_action(user["id"], "contact_status", f"msg={msg_id} status={new_status}", db=db)
    return {"ok": True}


@app.post("/api/admin/contact-messages/{msg_id}/reply")
def admin_reply_contact(msg_id: int, payload: dict, user=Depends(require_admin)):
    """Envoie une réponse à un message de contact depuis contact@unitedpronos.com.
    Préserve l'anonymat de l'admin et trace la réponse en BDD.

    Payload attendu :
    {
        "reply": str (texte de la réponse),
        "attachments": [
            {"filename": "screenshot.png", "data": "data:image/png;base64,xxx", "mime": "image/png"},
            ...
        ]
    }
    """
    reply_text = (payload.get("reply") or "").strip()
    if not reply_text:
        raise HTTPException(400, "La réponse ne peut pas être vide")
    if len(reply_text) > 10000:
        raise HTTPException(400, "Réponse trop longue (max 10000 caractères)")

    # Validation des pièces jointes
    attachments = payload.get("attachments") or []
    if not isinstance(attachments, list):
        raise HTTPException(400, "Format de pièces jointes invalide")
    if len(attachments) > 5:
        raise HTTPException(400, "Maximum 5 pièces jointes par réponse")

    # Vérification de chaque PJ (taille, type)
    MAX_ATTACHMENT_SIZE = 3_000_000  # 3 MB en base64 = ~2.2 MB binaire
    ALLOWED_MIMES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}
    for att in attachments:
        if not isinstance(att, dict):
            raise HTTPException(400, "Format de pièce jointe invalide")
        data = att.get("data", "")
        mime = att.get("mime", "")
        if mime not in ALLOWED_MIMES:
            raise HTTPException(400, f"Type non autorisé : {mime}. Autorisés : images PNG/JPG/WebP/GIF")
        if len(data) > MAX_ATTACHMENT_SIZE:
            raise HTTPException(400, f"Pièce jointe trop lourde (max 2 MB) : {att.get('filename', '?')}")

    with get_db() as db:
        row = db.execute("SELECT * FROM contact_messages WHERE id=?", (msg_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Message introuvable")

        # Envoie l'email depuis contact@unitedpronos.com avec les PJ
        sent = send_admin_reply(
            to_email=row["email"],
            to_name=row["name"],
            original_subject=row["subject"] or "",
            reply_body=reply_text,
            attachments=attachments,
        )

        if not sent:
            raise HTTPException(500, "Erreur lors de l'envoi du mail. Vérifie la config SMTP.")

        # Stocke la réponse en BDD + marque comme répondu
        # On stocke aussi le nombre de PJ pour info
        reply_with_meta = reply_text
        if attachments:
            reply_with_meta += f"\n\n[{len(attachments)} pièce(s) jointe(s) : {', '.join(a.get('filename', '?') for a in attachments)}]"
        db.execute(
            "UPDATE contact_messages SET admin_reply=?, replied_at=?, status='replied' WHERE id=?",
            (reply_with_meta, datetime.now(timezone.utc).isoformat(), msg_id),
        )
        log_action(user["id"], "contact_reply", f"msg={msg_id} to={row['email']} attachments={len(attachments)}", db=db)

    return {"ok": True, "sent_to": row["email"], "attachments_count": len(attachments)}


@app.delete("/api/admin/contact-messages/{msg_id}")
def admin_delete_contact(msg_id: int, user=Depends(require_admin)):
    with get_db() as db:
        db.execute("DELETE FROM contact_messages WHERE id=?", (msg_id,))
        log_action(user["id"], "contact_delete", f"msg={msg_id}", db=db)
    return {"ok": True}


# =====================================================
# CHAT-BOX : MESSAGERIE INTERNE (utilisateur ↔ admin)
# =====================================================

def _validate_attachments(attachments) -> list:
    """Valide les pièces jointes : format, type, taille. Renvoie la liste valide ou raise HTTPException."""
    if not attachments:
        return []
    if not isinstance(attachments, list):
        raise HTTPException(400, "Format de pièces jointes invalide")
    if len(attachments) > 5:
        raise HTTPException(400, "Maximum 5 pièces jointes par message")
    # Taille max du data URL base64 (donc ~25% supérieure à la taille du fichier brut).
    # 4 MB base64 = ~3 MB de fichier réel, suffisant pour des captures d'écran HD.
    MAX_SIZE_BASE64 = 4_000_000
    ALLOWED_MIMES = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}
    cleaned = []
    for att in attachments:
        if not isinstance(att, dict):
            raise HTTPException(400, "Format de pièce jointe invalide")
        mime = att.get("mime", "")
        data = att.get("data", "")
        filename = att.get("filename", "image.png")
        if mime not in ALLOWED_MIMES:
            raise HTTPException(400, f"Type non autorisé : {mime}. Autorisés : PNG/JPG/WebP/GIF")
        if not isinstance(data, str) or not data:
            raise HTTPException(400, f"Données de pièce jointe invalides : {filename}")
        # Vérifie que le data URL commence bien par "data:image/..."
        if not data.startswith("data:image/"):
            raise HTTPException(400, f"Format data URL invalide : {filename}")
        if len(data) > MAX_SIZE_BASE64:
            size_mb = len(data) / 1_000_000
            raise HTTPException(
                400,
                f"Pièce jointe trop lourde ({size_mb:.1f} MB > 4 MB) : {filename}. "
                "Compresse l'image avant de l'envoyer."
            )
        cleaned.append({
            "filename": filename[:255],  # tronque les noms trop longs
            "data": data,
            "mime": mime,
        })
    return cleaned


# ----------- ENDPOINTS UTILISATEUR -----------

@app.get("/api/me/conversations")
def my_conversations(user=Depends(get_current_user)):
    """Liste toutes mes conversations (la plus récente en premier)."""
    with get_db() as db:
        rows = db.execute("""
            SELECT id, subject, status, unread_user, unread_admin,
                   created_at, updated_at, last_message_at
            FROM conversations
            WHERE user_id = ?
            ORDER BY last_message_at DESC
        """, (user["id"],)).fetchall()
        # Pour chaque conv, on récupère le dernier message en aperçu
        conversations = []
        for r in rows:
            conv = dict(r)
            last = db.execute("""
                SELECT sender, content, created_at FROM conversation_messages
                WHERE conversation_id = ?
                ORDER BY id DESC LIMIT 1
            """, (conv["id"],)).fetchone()
            conv["last_preview"] = dict(last) if last else None
            conversations.append(conv)
        return conversations


@app.get("/api/me/conversations/unread-count")
def my_unread_count(user=Depends(get_current_user)):
    """Renvoie le nombre total de messages non lus (pour le badge).
    Endpoint léger et peu coûteux, idéal pour le polling toutes les 30s."""
    with get_db() as db:
        row = db.execute("""
            SELECT COALESCE(SUM(unread_user), 0) AS total
            FROM conversations
            WHERE user_id = ? AND status = 'open'
        """, (user["id"],)).fetchone()
        return {"unread": row["total"] or 0}


@app.get("/api/me/conversations/{conv_id}")
def get_my_conversation(conv_id: int, user=Depends(get_current_user)):
    """Récupère une conversation avec tous ses messages.
    Marque automatiquement les messages comme lus côté utilisateur."""
    with get_db() as db:
        conv = db.execute(
            "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
            (conv_id, user["id"])
        ).fetchone()
        if not conv:
            raise HTTPException(404, "Conversation introuvable")

        messages = db.execute("""
            SELECT id, sender, content, attachments, created_at
            FROM conversation_messages
            WHERE conversation_id = ?
            ORDER BY id ASC
        """, (conv_id,)).fetchall()

        # Marque comme lu côté utilisateur
        if conv["unread_user"] > 0:
            db.execute("UPDATE conversations SET unread_user = 0 WHERE id = ?", (conv_id,))

        # Parse les attachments JSON
        msgs_clean = []
        for m in messages:
            md = dict(m)
            try:
                md["attachments"] = json.loads(md["attachments"]) if md["attachments"] else []
            except Exception:
                md["attachments"] = []
            msgs_clean.append(md)

        return {
            "conversation": dict(conv),
            "messages": msgs_clean,
        }


@app.post("/api/me/conversations")
def create_my_conversation(payload: dict, user=Depends(get_current_user)):
    """Crée une nouvelle conversation avec un premier message."""
    try:
        subject = (payload.get("subject") or "").strip()
        content = (payload.get("content") or "").strip()
        attachments = _validate_attachments(payload.get("attachments"))
        if not content and not attachments:
            raise HTTPException(400, "Le message ne peut pas être vide (ajoute du texte ou une image)")
        if len(content) > 5000:
            raise HTTPException(400, "Message trop long (max 5000 caractères)")
        # Si pas de sujet : on en génère un à partir du contenu OU depuis les attachments
        if not subject:
            if content:
                subject = content[:50] + ("..." if len(content) > 50 else "")
            elif attachments:
                # Sujet par défaut pour les messages avec uniquement des images
                n = len(attachments)
                subject = f"📎 {n} image{'s' if n > 1 else ''}"
            else:
                subject = "Nouvelle conversation"

        now = datetime.now(timezone.utc).isoformat()
        with get_db() as db:
            # Crée la conversation
            cur = db.execute("""
                INSERT INTO conversations (user_id, subject, status, unread_admin, unread_user,
                                           created_at, updated_at, last_message_at)
                VALUES (?, ?, 'open', 1, 0, ?, ?, ?)
            """, (user["id"], subject, now, now, now))
            conv_id = cur.lastrowid
            # Premier message
            attachments_json = json.dumps(attachments) if attachments else ""
            db.execute("""
                INSERT INTO conversation_messages (conversation_id, sender, content, attachments, created_at)
                VALUES (?, 'user', ?, ?, ?)
            """, (conv_id, content, attachments_json, now))
            log_action(user["id"], "conversation_create",
                       f"conv={conv_id} subject={subject[:50]} attachments={len(attachments)}", db=db)
        return {"id": conv_id, "subject": subject}
    except HTTPException:
        raise  # propage les 400/etc.
    except Exception as e:
        # Log l'erreur précise et renvoie un 500 avec contexte
        import traceback
        print(f"[ERROR create_conversation] user={user.get('id')} type={type(e).__name__}: {e}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Erreur création conversation : {type(e).__name__}")


@app.post("/api/me/conversations/{conv_id}/messages")
def post_my_message(conv_id: int, payload: dict, user=Depends(get_current_user)):
    """Ajoute un message dans une conversation existante (côté utilisateur)."""
    try:
        content = (payload.get("content") or "").strip()
        attachments = _validate_attachments(payload.get("attachments"))
        if not content and not attachments:
            raise HTTPException(400, "Le message ne peut pas être vide (ajoute du texte ou une image)")
        if len(content) > 5000:
            raise HTTPException(400, "Message trop long (max 5000 caractères)")

        now = datetime.now(timezone.utc).isoformat()
        with get_db() as db:
            conv = db.execute(
                "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
                (conv_id, user["id"])
            ).fetchone()
            if not conv:
                raise HTTPException(404, "Conversation introuvable")
            if conv["status"] == "closed":
                # Rouvre la conversation si l'utilisateur répond
                db.execute("UPDATE conversations SET status = 'open' WHERE id = ?", (conv_id,))

            attachments_json = json.dumps(attachments) if attachments else ""
            db.execute("""
                INSERT INTO conversation_messages (conversation_id, sender, content, attachments, created_at)
                VALUES (?, 'user', ?, ?, ?)
            """, (conv_id, content, attachments_json, now))
            # Increment compteur admin
            db.execute("""
                UPDATE conversations
                SET unread_admin = unread_admin + 1,
                    updated_at = ?, last_message_at = ?
                WHERE id = ?
            """, (now, now, conv_id))
            log_action(user["id"], "conversation_message",
                       f"conv={conv_id} attachments={len(attachments)}", db=db)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[ERROR post_my_message] user={user.get('id')} conv={conv_id} type={type(e).__name__}: {e}")
        print(traceback.format_exc())
        raise HTTPException(500, f"Erreur envoi message : {type(e).__name__}")


# ----------- ENDPOINTS ADMIN -----------

@app.get("/api/admin/conversations")
def admin_conversations(status: Optional[str] = None, user=Depends(require_admin)):
    """Liste toutes les conversations avec infos utilisateur. Filtre optionnel par statut."""
    query = """
        SELECT c.id, c.subject, c.status, c.unread_admin, c.unread_user,
               c.created_at, c.updated_at, c.last_message_at,
               u.id AS user_id, u.username, u.email, u.role
        FROM conversations c
        JOIN users u ON u.id = c.user_id
    """
    params = ()
    if status and status != "all":
        if status not in ("open", "closed", "unread"):
            raise HTTPException(400, "Statut invalide")
        if status == "unread":
            query += " WHERE c.unread_admin > 0"
        else:
            query += " WHERE c.status = ?"
            params = (status,)
    query += " ORDER BY c.unread_admin DESC, c.last_message_at DESC"

    with get_db() as db:
        rows = db.execute(query, params).fetchall()
        conversations = []
        for r in rows:
            conv = dict(r)
            last = db.execute("""
                SELECT sender, content, created_at FROM conversation_messages
                WHERE conversation_id = ?
                ORDER BY id DESC LIMIT 1
            """, (conv["id"],)).fetchone()
            conv["last_preview"] = dict(last) if last else None
            conversations.append(conv)
        return conversations


@app.get("/api/admin/conversations/unread-count")
def admin_unread_count(user=Depends(require_admin)):
    """Compte total de conversations avec messages non lus (pour le badge admin)."""
    with get_db() as db:
        row = db.execute("""
            SELECT COUNT(*) AS total FROM conversations
            WHERE unread_admin > 0 AND status = 'open'
        """).fetchone()
        return {"unread": row["total"] or 0}


@app.get("/api/admin/conversations/{conv_id}")
def admin_get_conversation(conv_id: int, user=Depends(require_admin)):
    """Récupère une conversation. Marque comme lue côté admin."""
    with get_db() as db:
        conv = db.execute("""
            SELECT c.*, u.username, u.email, u.role
            FROM conversations c
            JOIN users u ON u.id = c.user_id
            WHERE c.id = ?
        """, (conv_id,)).fetchone()
        if not conv:
            raise HTTPException(404, "Conversation introuvable")

        messages = db.execute("""
            SELECT id, sender, content, attachments, created_at
            FROM conversation_messages
            WHERE conversation_id = ?
            ORDER BY id ASC
        """, (conv_id,)).fetchall()

        # Marque comme lu côté admin
        if conv["unread_admin"] > 0:
            db.execute("UPDATE conversations SET unread_admin = 0 WHERE id = ?", (conv_id,))

        msgs_clean = []
        for m in messages:
            md = dict(m)
            try:
                md["attachments"] = json.loads(md["attachments"]) if md["attachments"] else []
            except Exception:
                md["attachments"] = []
            msgs_clean.append(md)

        return {
            "conversation": dict(conv),
            "messages": msgs_clean,
        }


@app.post("/api/admin/conversations/new-to-user")
def admin_new_conversation_to_user(payload: dict, user=Depends(require_admin)):
    """L'admin démarre une conversation avec un utilisateur (message proactif).
    Crée une conversation au nom de l'utilisateur cible avec un premier message admin.
    L'utilisateur verra le badge rouge sur sa chat-box dès le prochain polling."""
    target_user_id = payload.get("user_id")
    if not target_user_id:
        raise HTTPException(400, "user_id requis")
    try:
        target_user_id = int(target_user_id)
    except (ValueError, TypeError):
        raise HTTPException(400, "user_id invalide")

    content = (payload.get("content") or "").strip()
    subject = (payload.get("subject") or "").strip()
    attachments = _validate_attachments(payload.get("attachments"))
    if not content and not attachments:
        raise HTTPException(400, "Le message ne peut pas être vide (ajoute du texte ou une image)")
    if len(content) > 10000:
        raise HTTPException(400, "Message trop long (max 10000 caractères)")
    if not subject:
        subject = content[:50] + ("..." if len(content) > 50 else "")

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        # Vérifier que l'utilisateur cible existe
        target = db.execute("SELECT id, username, email FROM users WHERE id=?", (target_user_id,)).fetchone()
        if not target:
            raise HTTPException(404, "Utilisateur introuvable")

        # Crée la conversation : unread_user=1 (l'utilisateur a un nouveau message),
        # unread_admin=0 (c'est l'admin qui écrit, donc rien à lire pour lui)
        cur = db.execute("""
            INSERT INTO conversations (user_id, subject, status, unread_user, unread_admin,
                                       created_at, updated_at, last_message_at)
            VALUES (?, ?, 'open', 1, 0, ?, ?, ?)
        """, (target_user_id, subject, now, now, now))
        conv_id = cur.lastrowid

        # Premier message envoyé par l'admin
        attachments_json = json.dumps(attachments) if attachments else ""
        db.execute("""
            INSERT INTO conversation_messages (conversation_id, sender, content, attachments, created_at)
            VALUES (?, 'admin', ?, ?, ?)
        """, (conv_id, content, attachments_json, now))
        log_action(user["id"], "admin_new_conv_to_user",
                   f"conv={conv_id} target_user={target_user_id} ({target['username']})", db=db)

    return {
        "ok": True,
        "conversation_id": conv_id,
        "target_user": {"id": target["id"], "username": target["username"], "email": target["email"]},
    }


@app.post("/api/admin/conversations/{conv_id}/reply")
def admin_reply_conversation(conv_id: int, payload: dict, user=Depends(require_admin)):
    """L'admin répond dans une conversation. Pas d'email envoyé (chat-box interne)."""
    content = (payload.get("content") or "").strip()
    attachments = _validate_attachments(payload.get("attachments"))
    if not content and not attachments:
        raise HTTPException(400, "Le message ne peut pas être vide (ajoute du texte ou une image)")
    if len(content) > 10000:
        raise HTTPException(400, "Message trop long (max 10000 caractères)")

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        conv = db.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
        if not conv:
            raise HTTPException(404, "Conversation introuvable")

        attachments_json = json.dumps(attachments) if attachments else ""
        db.execute("""
            INSERT INTO conversation_messages (conversation_id, sender, content, attachments, created_at)
            VALUES (?, 'admin', ?, ?, ?)
        """, (conv_id, content, attachments_json, now))
        # Increment compteur user + remet à ouvert
        db.execute("""
            UPDATE conversations
            SET unread_user = unread_user + 1,
                status = 'open',
                updated_at = ?, last_message_at = ?
            WHERE id = ?
        """, (now, now, conv_id))
        log_action(user["id"], "conversation_reply", f"conv={conv_id}", db=db)
    return {"ok": True}


@app.post("/api/admin/conversations/{conv_id}/close")
def admin_close_conversation(conv_id: int, user=Depends(require_admin)):
    """Ferme une conversation (l'utilisateur peut toujours répondre, ce qui la rouvre)."""
    with get_db() as db:
        conv = db.execute("SELECT id FROM conversations WHERE id = ?", (conv_id,)).fetchone()
        if not conv:
            raise HTTPException(404, "Conversation introuvable")
        db.execute("UPDATE conversations SET status = 'closed' WHERE id = ?", (conv_id,))
        log_action(user["id"], "conversation_close", f"conv={conv_id}", db=db)
    return {"ok": True}


@app.delete("/api/admin/conversations/{conv_id}")
def admin_delete_conversation(conv_id: int, user=Depends(require_admin)):
    """Supprime définitivement une conversation et tous ses messages."""
    with get_db() as db:
        # CASCADE supprime les messages automatiquement
        db.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
        log_action(user["id"], "conversation_delete", f"conv={conv_id}", db=db)
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


# =====================================================
# DONATIONS — Système de reconnaissance des supporters
# =====================================================
# Le site est gratuit et sans pub. Le financement repose sur les dons volontaires.
# Pour reconnaître les contributeurs sans tracking publicitaire, on permet aux
# utilisateurs de se déclarer "supporters" après un don, et on affiche :
#   - Un compteur global (nb de supporters)
#   - Un badge ❤️ sur leur pseudo
#   - Leur pseudo sur la page Crédits (avec leur consentement implicite)

@app.get("/api/donations/stats")
def donations_stats():
    """Stats publiques pour la page de transparence + page crédits.
    PAS de montants individuels exposés (RGPD + souhait utilisateur).
    Renvoie seulement le COUNT de supporters distincts validés.
    """
    with get_db() as db:
        # Compte les utilisateurs DISTINCTS qui ont fait au moins 1 don validé
        count_row = db.execute("""
            SELECT COUNT(DISTINCT user_id) AS n
            FROM donations
            WHERE verified = 1
        """).fetchone()
        supporter_count = count_row["n"] if count_row else 0

        # Liste publique : pseudos des supporters (ordre antichronologique de leur 1er don)
        supporters = db.execute("""
            SELECT u.username, MIN(d.declared_at) AS first_donation_at
            FROM donations d
            JOIN users u ON u.id = d.user_id
            WHERE d.verified = 1
            GROUP BY u.id, u.username
            ORDER BY first_donation_at DESC
            LIMIT 200
        """).fetchall()

        return {
            "supporter_count": supporter_count,
            "supporters": [dict(s) for s in supporters],
        }


@app.post("/api/donations/declare")
def declare_donation(user=Depends(require_user)):
    """L'utilisateur se déclare supporter après avoir fait un don sur Ko-fi/Stripe.
    Aucune vérification automatique (les webhooks Ko-fi/Stripe ne sont pas configurés).
    Un admin peut invalider une fausse déclaration si abus.

    Note : ce n'est PAS une fraude possible — c'est juste un badge symbolique.
    Si quelqu'un se déclare faussement supporter sans avoir donné, il ne gagne rien
    de monétisable (pas de fonctionnalité premium, juste un badge ❤️).
    """
    with get_db() as db:
        # Évite les doublons : un seul enregistrement par utilisateur
        existing = db.execute(
            "SELECT id FROM donations WHERE user_id = ? AND verified = 1",
            (user["id"],)
        ).fetchone()

        if existing:
            return {"ok": True, "already_supporter": True}

        db.execute(
            "INSERT INTO donations (user_id, verified) VALUES (?, 1)",
            (user["id"],)
        )
        log_action(user["id"], "declared_supporter", "", db=db)
        return {"ok": True, "already_supporter": False}


@app.get("/api/me/is-supporter")
def me_is_supporter(user=Depends(require_user)):
    """Indique si l'utilisateur courant est un supporter (pour afficher son badge)."""
    with get_db() as db:
        row = db.execute(
            "SELECT 1 FROM donations WHERE user_id = ? AND verified = 1 LIMIT 1",
            (user["id"],)
        ).fetchone()
        return {"is_supporter": bool(row)}


@app.delete("/api/admin/donations/{user_id}")
def admin_invalidate_supporter(user_id: int, admin=Depends(require_admin)):
    """Permet à un admin d'invalider un statut de supporter (fausse déclaration, abus, etc.)."""
    with get_db() as db:
        db.execute(
            "UPDATE donations SET verified = 0 WHERE user_id = ?",
            (user_id,)
        )
        log_action(admin["id"], "invalidate_supporter", str(user_id), db=db)
        return {"ok": True}


@app.get("/api/config")
def public_config():
    """Configuration publique exposée au frontend (liens de dons, features, analytics)."""
    return {
        "donations": {
            "stripe": os.environ.get("DONATION_STRIPE_LINK", ""),
            "kofi": os.environ.get("DONATION_KOFI_LINK", ""),
            "enabled": any([
                os.environ.get("DONATION_STRIPE_LINK"),
                os.environ.get("DONATION_KOFI_LINK"),
            ]),
        },
        "turnstile": {
            "site_key": os.environ.get("TURNSTILE_SITE_KEY", ""),
            "enabled": bool(os.environ.get("TURNSTILE_SITE_KEY") and os.environ.get("TURNSTILE_SECRET")),
        },
        "analytics": {
            "ga_measurement_id": os.environ.get("GA_MEASUREMENT_ID", ""),
            "enabled": bool(os.environ.get("GA_MEASUREMENT_ID")),
        },
        "features": {
            "translation": True,
            "news_aggregator": True,
        },
    }
