"""
PRONO 2026 — Backend FastAPI complet
Auth JWT + SQLite + agrégateur RSS + scoring temps réel
Lancement : uvicorn main:app --reload --port 8000
"""
import os
import sqlite3
import secrets
import threading
import time
import json as json_lib
import urllib.request
import urllib.parse
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import feedparser
from fastapi import FastAPI, HTTPException, Depends, status, Request
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
# DATABASE
# =====================================================
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
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
        CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_id);
        CREATE INDEX IF NOT EXISTS idx_groups_invite ON groups(invite_code);
        CREATE INDEX IF NOT EXISTS idx_groups_leader ON groups(leader_id);
        """)

    # === MIGRATION : ajouter group_id à la table users si la colonne n'existe pas ===
    with get_db() as db:
        cols = [r["name"] for r in db.execute("PRAGMA table_info(users)").fetchall()]
        if "group_id" not in cols:
            print("[MIGRATION] Ajout de group_id à users")
            db.execute("ALTER TABLE users ADD COLUMN group_id INTEGER")
        # Migration : transformer les anciens 'user' en 'solo'
        db.execute("UPDATE users SET role='solo' WHERE role='user'")


def seed_data():
    with get_db() as db:
        if db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            users = [
                ("admin@prono26.com", "Admin", "admin123", "admin"),
                ("demo@prono26.com", "Démo", "demo123", "solo"),
                ("marc@prono26.com", "Marc", "marc123", "solo"),
                ("lea@prono26.com", "Léa", "lea123", "solo"),
            ]
            for email, name, pwd, role in users:
                db.execute(
                    "INSERT OR IGNORE INTO users (email, username, password_hash, role) VALUES (?, ?, ?, ?)",
                    (email, name, pwd_context.hash(pwd), role),
                )

        if db.execute("SELECT COUNT(*) FROM matches").fetchone()[0] == 0:
            # =====================================================
            # 104 matchs CDM 2026 (72 phase de groupes + 32 phase finale)
            # =====================================================
            # Stades par hôte
            STADIUMS = {
                'MEX_AZ': 'Estadio Azteca, Mexico',
                'MEX_GUA': 'Estadio Akron, Guadalajara',
                'MEX_MTY': 'Estadio BBVA, Monterrey',
                'CAN_TOR': 'BMO Field, Toronto',
                'CAN_VAN': 'BC Place, Vancouver',
                'USA_LA': 'SoFi Stadium, Los Angeles',
                'USA_NY': 'MetLife Stadium, New York',
                'USA_DAL': 'AT&T Stadium, Dallas',
                'USA_KC': 'Arrowhead Stadium, Kansas City',
                'USA_ATL': 'Mercedes-Benz Stadium, Atlanta',
                'USA_BOS': 'Gillette Stadium, Boston',
                'USA_HOU': 'NRG Stadium, Houston',
                'USA_MIA': 'Hard Rock Stadium, Miami',
                'USA_PHI': 'Lincoln Financial Field, Philadelphie',
                'USA_SEA': 'Lumen Field, Seattle',
                'USA_SF': 'Levi\'s Stadium, San Francisco',
            }

            # Groupes officiels (tirage du 5 décembre 2025)
            G = {
                'A': ['MEX', 'KOR', 'RSA', 'CZE'],
                'B': ['CAN', 'SUI', 'QAT', 'BIH'],
                'C': ['BRA', 'MAR', 'HAI', 'SCO'],
                'D': ['USA', 'PAR', 'AUS', 'TUR'],
                'E': ['GER', 'ECU', 'CIV', 'CUW'],
                'F': ['NED', 'JPN', 'SWE', 'TUN'],
                'G': ['BEL', 'EGY', 'IRN', 'NZL'],
                'H': ['ESP', 'URU', 'KSA', 'CPV'],
                'I': ['FRA', 'SEN', 'NOR', 'IRQ'],
                'J': ['ARG', 'AUT', 'ALG', 'JOR'],
                'K': ['POR', 'COL', 'UZB', 'COD'],
                'L': ['ENG', 'CRO', 'GHA', 'PAN'],
            }

            matches = []

            # =====================================================
            # PHASE DE GROUPES (72 matchs : 6 par groupe × 12 groupes)
            # 3 dates par groupe, format round-robin :
            # J1: 1-2, 3-4 / J2: 1-3, 2-4 / J3: 1-4, 2-3
            # =====================================================
            # Calendrier indicatif basé sur le format FIFA officiel
            group_schedule = [
                # (groupe, jour_offset_depuis_11_juin, heures_des_2_matchs, stades)
                ('A', 0, ['20:00'], ['MEX_AZ']),                         # MEX vs RSA (ouverture)
                ('A', 5, ['18:00'], ['MEX_GUA']),                        # KOR vs CZE
                ('A', 5, ['21:00'], ['MEX_AZ']),                         # MEX vs ?
                ('A', 10, ['16:00'], ['MEX_MTY']),                       # ...
            ]

            # Plus simple : on génère programmatiquement
            from datetime import datetime as dt, timedelta as td
            start = dt(2026, 6, 11, 20, 0)

            # Stades par hôte (rotation)
            HOST_STADIUMS = {
                'MEX': ['MEX_AZ', 'MEX_GUA', 'MEX_MTY'],
                'CAN': ['CAN_TOR', 'CAN_VAN'],
                'USA': ['USA_LA', 'USA_NY', 'USA_DAL', 'USA_KC', 'USA_ATL',
                        'USA_BOS', 'USA_HOU', 'USA_MIA', 'USA_PHI', 'USA_SEA', 'USA_SF'],
            }

            # Mapping groupe -> hôte (selon calendrier officiel)
            GROUP_HOST = {
                'A': 'MEX', 'B': 'CAN', 'C': 'USA', 'D': 'USA',
                'E': 'USA', 'F': 'USA', 'G': 'USA', 'H': 'USA',
                'I': 'USA', 'J': 'USA', 'K': 'USA', 'L': 'USA',
            }

            stadium_idx = {h: 0 for h in HOST_STADIUMS}

            def next_stadium(host):
                stadiums = HOST_STADIUMS[host]
                s = stadiums[stadium_idx[host] % len(stadiums)]
                stadium_idx[host] += 1
                return STADIUMS[s]

            # Génération phase de groupes
            # Chaque groupe : 3 journées, 6 matchs au total
            # Pattern de matchs : (1,2)(3,4) puis (1,3)(2,4) puis (1,4)(2,3)
            day_offset = 0
            hour_slots = ['12:00', '15:00', '18:00', '21:00']
            slot_idx = 0

            # On répartit les 72 matchs sur 14 jours (11-24 juin)
            # ~5-6 matchs par jour
            all_group_matches = []
            for letter, teams in G.items():
                t = teams
                pairings = [
                    (t[0], t[1]), (t[2], t[3]),  # J1
                    (t[0], t[2]), (t[1], t[3]),  # J2
                    (t[0], t[3]), (t[1], t[2]),  # J3
                ]
                # 3 journées séparées d'environ 5 jours
                for journee_idx in range(3):
                    for match_idx in range(2):
                        idx = journee_idx * 2 + match_idx
                        all_group_matches.append({
                            'group': letter,
                            'journee': journee_idx,
                            'home': pairings[idx][0],
                            'away': pairings[idx][1],
                            'host': GROUP_HOST[letter],
                        })

            # Tri : journée par journée, en répartissant les groupes sur les jours
            all_group_matches.sort(key=lambda m: (m['journee'], m['group']))

            # Étalement sur les jours (J1 = jours 0-4, J2 = jours 5-9, J3 = jours 10-13)
            for i, m in enumerate(all_group_matches):
                # 6 matchs par jour max (étalés sur 14 jours)
                day = m['journee'] * 5 + (i // 6) % 5
                hour = hour_slots[i % len(hour_slots)]
                match_dt = dt(2026, 6, 11) + td(days=day)
                date_str = match_dt.strftime('%Y-%m-%d') + f' {hour}'
                stadium = next_stadium(m['host'])
                matches.append((m['home'], m['away'], date_str, 'group', m['group'], stadium))

            # =====================================================
            # PHASE FINALE — 32 matchs (placeholders avec équipes 'TBD')
            # 16es de finale (Round of 32) : 16 matchs (28 juin - 3 juillet)
            # 8es de finale (Round of 16) : 8 matchs (4 - 7 juillet)
            # Quarts : 4 matchs (9 - 11 juillet)
            # Demies : 2 matchs (14, 15 juillet)
            # 3e place : 1 match (18 juillet)
            # Finale : 1 match (19 juillet)
            # =====================================================
            knockout = [
                # Round of 32 (16e de finale) - 28 juin au 3 juillet
                ('R32_1',  'R32_2',  '2026-06-28 16:00', 'r32', None, STADIUMS['USA_PHI']),
                ('R32_3',  'R32_4',  '2026-06-28 19:00', 'r32', None, STADIUMS['USA_BOS']),
                ('R32_5',  'R32_6',  '2026-06-29 12:00', 'r32', None, STADIUMS['USA_DAL']),
                ('R32_7',  'R32_8',  '2026-06-29 15:00', 'r32', None, STADIUMS['MEX_GUA']),
                ('R32_9',  'R32_10', '2026-06-29 18:00', 'r32', None, STADIUMS['USA_LA']),
                ('R32_11', 'R32_12', '2026-06-30 16:00', 'r32', None, STADIUMS['USA_KC']),
                ('R32_13', 'R32_14', '2026-06-30 19:00', 'r32', None, STADIUMS['USA_NY']),
                ('R32_15', 'R32_16', '2026-07-01 12:00', 'r32', None, STADIUMS['USA_HOU']),
                ('R32_17', 'R32_18', '2026-07-01 15:00', 'r32', None, STADIUMS['MEX_MTY']),
                ('R32_19', 'R32_20', '2026-07-01 18:00', 'r32', None, STADIUMS['CAN_TOR']),
                ('R32_21', 'R32_22', '2026-07-02 12:00', 'r32', None, STADIUMS['USA_ATL']),
                ('R32_23', 'R32_24', '2026-07-02 15:00', 'r32', None, STADIUMS['USA_MIA']),
                ('R32_25', 'R32_26', '2026-07-02 18:00', 'r32', None, STADIUMS['USA_SEA']),
                ('R32_27', 'R32_28', '2026-07-03 12:00', 'r32', None, STADIUMS['USA_SF']),
                ('R32_29', 'R32_30', '2026-07-03 15:00', 'r32', None, STADIUMS['CAN_VAN']),
                ('R32_31', 'R32_32', '2026-07-03 18:00', 'r32', None, STADIUMS['MEX_AZ']),
                # Round of 16 (8es) - 4-7 juillet
                ('R16_1', 'R16_2', '2026-07-04 12:00', 'r16', None, STADIUMS['USA_LA']),
                ('R16_3', 'R16_4', '2026-07-04 16:00', 'r16', None, STADIUMS['USA_PHI']),
                ('R16_5', 'R16_6', '2026-07-05 12:00', 'r16', None, STADIUMS['USA_NY']),
                ('R16_7', 'R16_8', '2026-07-05 16:00', 'r16', None, STADIUMS['MEX_AZ']),
                ('R16_9', 'R16_10', '2026-07-06 12:00', 'r16', None, STADIUMS['USA_BOS']),
                ('R16_11', 'R16_12', '2026-07-06 16:00', 'r16', None, STADIUMS['USA_KC']),
                ('R16_13', 'R16_14', '2026-07-07 12:00', 'r16', None, STADIUMS['USA_MIA']),
                ('R16_15', 'R16_16', '2026-07-07 16:00', 'r16', None, STADIUMS['USA_DAL']),
                # Quarts - 9-11 juillet
                ('QF_1', 'QF_2', '2026-07-09 16:00', 'qf', None, STADIUMS['USA_LA']),
                ('QF_3', 'QF_4', '2026-07-09 20:00', 'qf', None, STADIUMS['USA_BOS']),
                ('QF_5', 'QF_6', '2026-07-11 16:00', 'qf', None, STADIUMS['USA_MIA']),
                ('QF_7', 'QF_8', '2026-07-11 20:00', 'qf', None, STADIUMS['USA_KC']),
                # Demi-finales - 14-15 juillet
                ('SF_1', 'SF_2', '2026-07-14 20:00', 'sf', None, STADIUMS['USA_DAL']),
                ('SF_3', 'SF_4', '2026-07-15 20:00', 'sf', None, STADIUMS['USA_ATL']),
                # 3e place - 18 juillet
                ('TBD_3', 'TBD_4', '2026-07-18 16:00', '3rd', None, STADIUMS['USA_MIA']),
                # FINALE - 19 juillet, MetLife Stadium
                ('TBD_F1', 'TBD_F2', '2026-07-19 15:00', 'final', None, STADIUMS['USA_NY']),
            ]
            matches.extend(knockout)

            for h, a, d, s, g, st in matches:
                db.execute(
                    "INSERT INTO matches (home_team, away_team, match_date, stage, group_letter, stadium) VALUES (?,?,?,?,?,?)",
                    (h, a, d, s, g, st),
                )


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
        return dict(user)


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
        if not m or m["home_score"] is None or m["away_score"] is None:
            return
        preds = db.execute("SELECT * FROM predictions WHERE match_id=?", (match_id,)).fetchall()
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


def translate_text(text: str, source_lang: str, target_lang: str) -> str:
    """Traduit un texte via MyMemory.
    - Cache mémoire global (LRU implicite)
    - Circuit breaker : skip pendant 1h après un 429
    - Si erreur, retourne le texte d'origine."""
    global _translate_blocked_until, _translate_429_count

    if not text or source_lang == target_lang:
        return text

    # Nettoyer HTML basique
    clean = text.replace('\n', ' ').strip()
    if len(clean) > 480:
        clean = clean[:477] + "..."

    # Cache : c'est gratuit et instantané
    cache_key = f"{source_lang}->{target_lang}:{clean[:120]}"
    if cache_key in _translation_cache:
        return _translation_cache[cache_key]

    # === Circuit breaker : on ne tape pas l'API si on est rate-limité ===
    if time.time() < _translate_blocked_until:
        return clean

    try:
        params_dict = {
            'q': clean,
            'langpair': f'{source_lang}|{target_lang}',
        }
        # Si l'admin a fourni un email, on l'utilise pour 10x plus de quota
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
            translated = data.get('responseData', {}).get('translatedText', clean)

            # MyMemory peut renvoyer "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS"
            if 'MYMEMORY WARNING' in translated.upper() or 'INVALID' in translated.upper():
                # Quota dépassé via le message → on bloque pour 1 heure
                _translate_blocked_until = time.time() + 3600
                print(f"[TRANSLATE] Quota dépassé — pause 1h")
                return clean

            # Reset compteur d'erreurs
            _translate_429_count = 0
            _translation_cache[cache_key] = translated
            return translated

    except urllib.error.HTTPError as e:
        if e.code == 429:
            _translate_429_count += 1
            # Backoff exponentiel : 1ère fois 5 min, 2e fois 15 min, 3e fois 1h, ensuite 2h
            wait_seconds = min(5 * 60 * (2 ** _translate_429_count), 7200)
            _translate_blocked_until = time.time() + wait_seconds
            print(f"[TRANSLATE] 429 reçu — pause {wait_seconds // 60} min (essai #{_translate_429_count})")
        else:
            print(f"[TRANSLATE] erreur HTTP {e.code} {source_lang}->{target_lang}")
        return clean
    except Exception as e:
        print(f"[TRANSLATE] erreur {source_lang}->{target_lang}: {e}")
        return clean


def translate_to_all_langs(text: str, source_lang: str) -> dict:
    """Traduit un texte vers fr, en, es. La langue source est gardée telle quelle."""
    result = {'fr': '', 'en': '', 'es': ''}
    result[source_lang] = text
    for target in ['fr', 'en', 'es']:
        if target != source_lang and text:
            result[target] = translate_text(text, source_lang, target)
            # Délai plus long pour éviter le rate limit (était 0.3s, maintenant 0.6s)
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
app = FastAPI(title="PRONO 2026 API", version="1.0.0")

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
    print("=" * 60)
    print("🏆 PRONO 2026 backend démarré")
    print(f"📁 Base : {DB_PATH}")
    print("👤 Comptes : admin@prono26.com/admin123 — demo@prono26.com/demo123")
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
        token = create_token(user["id"], user["role"])
        return {
            "token": token,
            "user": {
                "id": user["id"], "email": user["email"], "username": user["username"],
                "role": user["role"], "group_id": user["group_id"],
            },
        }


@app.get("/api/me")
def me(user=Depends(get_current_user)):
    return {
        "id": user["id"], "email": user["email"], "username": user["username"],
        "role": user["role"], "group_id": user.get("group_id"),
    }


# --- Matches ---
@app.get("/api/matches")
def list_matches():
    with get_db() as db:
        rows = db.execute("SELECT * FROM matches ORDER BY match_date").fetchall()
        return [dict(r) for r in rows]


# --- Predictions ---
@app.get("/api/predictions")
def my_predictions(user=Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM predictions WHERE user_id=?", (user["id"],)).fetchall()
        return [dict(r) for r in rows]


@app.post("/api/predictions")
def save_prediction(data: PredictionIn, user=Depends(get_current_user)):
    with get_db() as db:
        m = db.execute("SELECT * FROM matches WHERE id=?", (data.match_id,)).fetchone()
        if not m:
            raise HTTPException(404, "Match introuvable")
        if m["status"] == "finished":
            raise HTTPException(400, "Match terminé, prono verrouillé")
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
        return {"ok": True}


# --- Leaderboard ---
@app.get("/api/leaderboard")
def leaderboard():
    """Classement global avec infos de groupe pour chaque joueur."""
    with get_db() as db:
        rows = db.execute("""
            SELECT u.id, u.username, u.email, u.role, u.group_id,
                   COALESCE(SUM(p.points), 0) AS total_points,
                   COUNT(p.id) AS predictions_count,
                   g.name AS group_name,
                   g.logo_data AS group_logo,
                   g.slug AS group_slug
            FROM users u
            LEFT JOIN predictions p ON p.user_id = u.id
            LEFT JOIN groups g ON g.id = u.group_id
            WHERE u.role != 'admin' OR u.id IN (SELECT user_id FROM predictions)
            GROUP BY u.id
            ORDER BY total_points DESC, predictions_count DESC
        """).fetchall()
        return [dict(r) for r in rows]


# --- News ---
@app.get("/api/news")
def list_news(team: Optional[str] = None, lang: Optional[str] = 'fr', limit: int = 50):
    """Renvoie les actus avec titre/résumé traduits dans la langue demandée.
    Le paramètre 'lang' choisit la langue d'affichage (fr/en/es), pas la source."""
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
        for r in rows:
            d = dict(r)
            # Choisit la version traduite selon la langue demandée
            translated_title = d.get(f'title_{lang}') or d['title']
            translated_summary = d.get(f'summary_{lang}') or d['summary'] or ''
            result.append({
                'id': d['id'],
                'title': translated_title,
                'summary': translated_summary,
                'link': d['link'],
                'source': d['source'],
                'team': d['team'],
                'sentiment': d['sentiment'],
                'published_at': d['published_at'],
                'fetched_at': d['fetched_at'],
                'lang': d['lang'],         # langue d'origine
                'displayed_lang': lang,     # langue affichée
                'translated': d['lang'] != lang,  # true si traduit
            })
        return result


@app.post("/api/news/refresh")
def refresh_news(user=Depends(require_admin)):
    fetch_news_once()
    return {"ok": True}


# --- Admin ---
@app.get("/api/admin/users")
def admin_users(user=Depends(require_admin)):
    with get_db() as db:
        rows = db.execute("SELECT id, email, username, role, created_at FROM users ORDER BY id").fetchall()
        return [dict(r) for r in rows]


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, user=Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(400, "Impossible de supprimer son propre compte")
    with get_db() as db:
        db.execute("DELETE FROM users WHERE id=?", (user_id,))
        log_action(user["id"], "delete_user", str(user_id), db=db)
        return {"ok": True}


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
    """Liste les membres d'un groupe. Accessible au leader ou à l'admin."""
    with get_db() as db:
        group = db.execute("SELECT * FROM groups WHERE id=?", (group_id,)).fetchone()
        if not group:
            raise HTTPException(404, "Groupe introuvable")
        # Vérifier les droits
        is_leader = user["role"] == "leader" and group["leader_id"] == user["id"]
        is_admin = user["role"] == "admin"
        if not (is_leader or is_admin):
            raise HTTPException(403, "Accès refusé")

        rows = db.execute(
            """SELECT u.id, u.email, u.username, u.role, u.created_at,
                      COALESCE((SELECT SUM(p.points) FROM predictions p WHERE p.user_id=u.id), 0) AS points
               FROM users u WHERE u.group_id=? ORDER BY points DESC, u.username""",
            (group_id,),
        ).fetchall()
        return [dict(r) for r in rows]


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
        msg["Subject"] = f"[PRONO 2026] {subject or 'Nouveau message'} — de {name}"

        body = f"""Nouveau message de contact PRONO 2026

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


@app.delete("/api/admin/contact-messages/{msg_id}")
def admin_delete_contact(msg_id: int, user=Depends(require_admin)):
    with get_db() as db:
        db.execute("DELETE FROM contact_messages WHERE id=?", (msg_id,))
        log_action(user["id"], "contact_delete", f"msg={msg_id}", db=db)
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


@app.get("/api/config")
def public_config():
    """Configuration publique exposée au frontend (liens de dons, features)."""
    return {
        "donations": {
            "stripe": os.environ.get("DONATION_STRIPE_LINK", ""),
            "paypal": os.environ.get("DONATION_PAYPAL_LINK", ""),
            "kofi": os.environ.get("DONATION_KOFI_LINK", ""),
            "enabled": any([
                os.environ.get("DONATION_STRIPE_LINK"),
                os.environ.get("DONATION_PAYPAL_LINK"),
                os.environ.get("DONATION_KOFI_LINK"),
            ]),
        },
        "turnstile": {
            "site_key": os.environ.get("TURNSTILE_SITE_KEY", ""),
            "enabled": bool(os.environ.get("TURNSTILE_SITE_KEY") and os.environ.get("TURNSTILE_SECRET")),
        },
        "features": {
            "translation": True,
            "news_aggregator": True,
        },
    }
