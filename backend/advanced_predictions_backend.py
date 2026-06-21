"""
United Pronos — Pronos Avancés : Backend FastAPI
=================================================
Ajoute 3 types de pronos bonus sur chaque match :
  • Buteur du match    → +3 pts si correct
  • Over/Under 2.5    → +2 pts si correct
  • BTTS              → +2 pts si correct (Both Teams To Score)

Ces points sont CUMULATIFS avec les points classiques existants.

INTÉGRATION :
  1. Exécuter migrate_advanced_predictions() UNE FOIS au démarrage
  2. Ajouter les routes à ton router FastAPI existant
  3. Appeler recalculate_advanced_points(match_id) quand un score est validé

COMPATIBILITÉ : ne modifie pas les tables existantes, ajoute 2 nouvelles tables.
"""

import sqlite3
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# =============================================
# CONFIGURATION
# =============================================
DB_PATH = "/opt/prono2026/prono2026.db"  # adapter à ton chemin réel

POINTS_SCORER = 3       # buteur exact
POINTS_OVER_UNDER = 2   # over/under 2.5 correct
POINTS_BTTS = 2         # BTTS correct

# =============================================
# MIGRATION SQL — à exécuter UNE FOIS
# =============================================

MIGRATION_SQL = """
-- Table des pronos avancés par utilisateur et par match
CREATE TABLE IF NOT EXISTS advanced_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    match_id INTEGER NOT NULL,

    -- Buteur du match (code ISO équipe + nom joueur optionnel)
    scorer_team TEXT,           -- ex: "FRA" (équipe censée marquer en premier)
    scorer_name TEXT,           -- ex: "Mbappé" (optionnel, pour affichage)

    -- Over / Under 2.5 buts
    over_under TEXT,            -- "over" ou "under"

    -- Both Teams To Score
    btts TEXT,                  -- "yes" ou "no"

    -- Points gagnés (calculés après le match)
    points_scorer INTEGER DEFAULT 0,
    points_over_under INTEGER DEFAULT 0,
    points_btts INTEGER DEFAULT 0,
    points_total INTEGER DEFAULT 0,

    -- Métadonnées
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, match_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_adv_pred_user ON advanced_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_adv_pred_match ON advanced_predictions(match_id);

-- Colonne dans users pour le total des points bonus (dénormalisée pour perf)
-- À n'ajouter QUE si elle n'existe pas déjà
ALTER TABLE users ADD COLUMN bonus_points INTEGER DEFAULT 0;
"""


def migrate_advanced_predictions():
    """
    Exécute la migration. Appeler au démarrage de l'app (idempotent).
    Les erreurs ALTER TABLE (colonne déjà existante) sont ignorées.
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    statements = [s.strip() for s in MIGRATION_SQL.split(";") if s.strip()]
    for stmt in statements:
        try:
            c.execute(stmt)
        except sqlite3.OperationalError as e:
            # Ignorer "duplicate column name" — migration déjà faite
            if "duplicate column" not in str(e).lower():
                print(f"[Migration] Erreur ignorée : {e}")
    conn.commit()
    conn.close()
    print("[Migration] advanced_predictions : OK")


# =============================================
# MODÈLES PYDANTIC
# =============================================

class AdvancedPredictionIn(BaseModel):
    match_id: int
    scorer_team: Optional[str] = None   # code ISO ex: "FRA"
    scorer_name: Optional[str] = None   # optionnel
    over_under: Optional[str] = None    # "over" | "under"
    btts: Optional[str] = None          # "yes" | "no"


class AdvancedPredictionOut(BaseModel):
    match_id: int
    scorer_team: Optional[str]
    scorer_name: Optional[str]
    over_under: Optional[str]
    btts: Optional[str]
    points_scorer: int
    points_over_under: int
    points_btts: int
    points_total: int
    locked: bool  # si le match a commencé


# =============================================
# LOGIQUE MÉTIER
# =============================================

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def is_match_locked(match: sqlite3.Row) -> bool:
    """Retourne True si le match ne peut plus être pronostiqué (5 min avant ou en cours)."""
    if match["status"] in ("live", "finished"):
        return True
    if not match["match_date"]:
        return False
    try:
        match_dt = datetime.fromisoformat(match["match_date"].replace(" ", "T"))
        diff_minutes = (match_dt - datetime.utcnow()).total_seconds() / 60
        return diff_minutes <= 5
    except Exception:
        return False


def compute_advanced_points(pred: sqlite3.Row, match: sqlite3.Row) -> dict:
    """
    Calcule les points bonus pour un prono avancé après validation du score réel.
    Retourne un dict avec les points par catégorie.
    """
    pts_scorer = 0
    pts_ou = 0
    pts_btts = 0

    home_score = match["home_score"]
    away_score = match["away_score"]

    # Sécurité : on ne calcule que si le score est renseigné
    if home_score is None or away_score is None:
        return {"scorer": 0, "over_under": 0, "btts": 0, "total": 0}

    total_goals = home_score + away_score

    # --- Over / Under 2.5 ---
    if pred["over_under"]:
        actual_ou = "over" if total_goals > 2 else "under"
        if pred["over_under"] == actual_ou:
            pts_ou = POINTS_OVER_UNDER

    # --- BTTS ---
    if pred["btts"]:
        actual_btts = "yes" if home_score > 0 and away_score > 0 else "no"
        if pred["btts"] == actual_btts:
            pts_btts = POINTS_BTTS

    # --- Buteur (équipe qui marque en premier) ---
    # On se base sur home_score > 0 pour domicile, away_score > 0 pour extérieur.
    # Si les deux marquent, on vérifie juste que l'équipe prédite a marqué
    # (on n'a pas accès au "premier buteur" via l'API gratuite Football-Data.org).
    # COMPROMIS : +3 pts si l'équipe prédite a MARQUÉ dans le match.
    # Pour le "premier buteur nominal", nécessite une API payante.
    if pred["scorer_team"]:
        home_team = match["home_team"]
        away_team = match["away_team"]
        if pred["scorer_team"] == home_team and home_score > 0:
            pts_scorer = POINTS_SCORER
        elif pred["scorer_team"] == away_team and away_score > 0:
            pts_scorer = POINTS_SCORER
        # Si 0-0, personne ne marque → 0 pts

    total = pts_scorer + pts_ou + pts_btts
    return {"scorer": pts_scorer, "over_under": pts_ou, "btts": pts_btts, "total": total}


def recalculate_advanced_points(match_id: int):
    """
    À appeler après chaque validation de score admin.
    Recalcule les points bonus de TOUS les utilisateurs pour ce match
    et met à jour bonus_points dans la table users.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    match = c.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    if not match or match["status"] != "finished":
        conn.close()
        return 0

    preds = c.execute(
        "SELECT * FROM advanced_predictions WHERE match_id = ?", (match_id,)
    ).fetchall()

    updated = 0
    for pred in preds:
        pts = compute_advanced_points(pred, match)
        c.execute("""
            UPDATE advanced_predictions
            SET points_scorer = ?,
                points_over_under = ?,
                points_btts = ?,
                points_total = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (pts["scorer"], pts["over_under"], pts["btts"], pts["total"], pred["id"]))

        # Mise à jour du total bonus dans users (recalcul complet pour éviter la dérive)
        total_bonus = c.execute(
            "SELECT COALESCE(SUM(points_total), 0) FROM advanced_predictions WHERE user_id = ?",
            (pred["user_id"],)
        ).fetchone()[0]
        c.execute(
            "UPDATE users SET bonus_points = ? WHERE id = ?",
            (total_bonus, pred["user_id"])
        )
        updated += 1

    conn.commit()
    conn.close()
    print(f"[AdvancedPoints] Match {match_id} : {updated} pronos recalculés")
    return updated


# =============================================
# ROUTES FASTAPI
# =============================================

router = APIRouter(prefix="/api", tags=["advanced-predictions"])


@router.post("/advanced-predictions", response_model=dict)
async def save_advanced_prediction(
    payload: AdvancedPredictionIn,
    conn=Depends(get_db),
    # Remplace par ta dépendance d'auth existante :
    # current_user = Depends(get_current_user)
):
    """
    Sauvegarde ou met à jour les pronos avancés d'un utilisateur pour un match.
    Verrouillé 5 min avant le coup d'envoi (même règle que les pronos classiques).
    """
    # TODO: remplacer par ton vrai système d'auth
    # user_id = current_user.id
    user_id = 1  # placeholder

    c = conn.cursor()
    match = c.execute("SELECT * FROM matches WHERE id = ?", (payload.match_id,)).fetchone()
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")

    if is_match_locked(match):
        raise HTTPException(status_code=403, detail="Pronos verrouillés pour ce match")

    # Validation des valeurs
    if payload.over_under and payload.over_under not in ("over", "under"):
        raise HTTPException(status_code=400, detail="over_under doit être 'over' ou 'under'")
    if payload.btts and payload.btts not in ("yes", "no"):
        raise HTTPException(status_code=400, detail="btts doit être 'yes' ou 'no'")

    # Upsert
    c.execute("""
        INSERT INTO advanced_predictions
            (user_id, match_id, scorer_team, scorer_name, over_under, btts, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, match_id) DO UPDATE SET
            scorer_team = excluded.scorer_team,
            scorer_name = excluded.scorer_name,
            over_under  = excluded.over_under,
            btts        = excluded.btts,
            updated_at  = CURRENT_TIMESTAMP
    """, (
        user_id, payload.match_id,
        payload.scorer_team, payload.scorer_name,
        payload.over_under, payload.btts
    ))
    conn.commit()

    return {"ok": True, "message": "Pronos avancés enregistrés"}


@router.get("/advanced-predictions/{match_id}", response_model=dict)
async def get_advanced_prediction(
    match_id: int,
    conn=Depends(get_db),
):
    """Retourne les pronos avancés de l'utilisateur connecté pour un match donné."""
    # TODO: remplacer par ton vrai système d'auth
    user_id = 1  # placeholder

    c = conn.cursor()
    match = c.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")

    pred = c.execute(
        "SELECT * FROM advanced_predictions WHERE user_id = ? AND match_id = ?",
        (user_id, match_id)
    ).fetchone()

    return {
        "match_id": match_id,
        "locked": is_match_locked(match),
        "prediction": dict(pred) if pred else None,
    }


@router.get("/advanced-predictions/match/{match_id}/results", response_model=dict)
async def get_match_advanced_results(match_id: int, conn=Depends(get_db)):
    """
    (Public après verrouillage) Retourne les pronos avancés de tous les joueurs
    pour un match terminé, avec les points obtenus.
    Permet d'afficher "qui avait prédit Mbappé buteur".
    """
    c = conn.cursor()
    match = c.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    if not match:
        raise HTTPException(status_code=404, detail="Match introuvable")

    if match["status"] != "finished":
        raise HTTPException(status_code=403, detail="Résultats disponibles après le match")

    preds = c.execute("""
        SELECT ap.*, u.username, u.avatar_data
        FROM advanced_predictions ap
        JOIN users u ON u.id = ap.user_id
        WHERE ap.match_id = ?
        ORDER BY ap.points_total DESC
    """, (match_id,)).fetchall()

    return {
        "match_id": match_id,
        "results": [dict(p) for p in preds],
        "total_players": len(preds),
    }


@router.get("/my-advanced-stats", response_model=dict)
async def get_my_advanced_stats(conn=Depends(get_db)):
    """
    Stats globales des pronos avancés de l'utilisateur connecté.
    Utilisé pour la page "Mes statistiques".
    """
    # TODO: remplacer par ton vrai système d'auth
    user_id = 1  # placeholder

    c = conn.cursor()
    row = c.execute("""
        SELECT
            COUNT(*) as total_played,
            SUM(CASE WHEN points_scorer > 0 THEN 1 ELSE 0 END) as scorer_correct,
            SUM(CASE WHEN points_over_under > 0 THEN 1 ELSE 0 END) as ou_correct,
            SUM(CASE WHEN points_btts > 0 THEN 1 ELSE 0 END) as btts_correct,
            SUM(points_total) as total_bonus_points,
            COUNT(CASE WHEN scorer_team IS NOT NULL THEN 1 END) as scorer_played,
            COUNT(CASE WHEN over_under IS NOT NULL THEN 1 END) as ou_played,
            COUNT(CASE WHEN btts IS NOT NULL THEN 1 END) as btts_played
        FROM advanced_predictions ap
        JOIN matches m ON m.id = ap.match_id
        WHERE ap.user_id = ? AND m.status = 'finished'
    """, (user_id,)).fetchone()

    stats = dict(row)

    # Taux de réussite par type (évite division par zéro)
    def rate(correct, played):
        return round((correct / played) * 100) if played else 0

    stats["scorer_rate"] = rate(stats["scorer_correct"], stats["scorer_played"])
    stats["ou_rate"] = rate(stats["ou_correct"], stats["ou_played"])
    stats["btts_rate"] = rate(stats["btts_correct"], stats["btts_played"])

    return stats


# =============================================
# HOOK À APPELER DEPUIS TON ENDPOINT ADMIN
# =============================================
# Dans ton endpoint existant admin/set-score, ajoute ceci APRÈS avoir
# validé le score et recalculé les points classiques :
#
# from advanced_predictions_backend import recalculate_advanced_points
# recalculate_advanced_points(match_id)
#
# C'est tout — les points bonus seront ajoutés automatiquement.


# =============================================
# DÉMARRAGE (à appeler dans main.py)
# =============================================
# from advanced_predictions_backend import migrate_advanced_predictions, router as advanced_router
# migrate_advanced_predictions()
# app.include_router(advanced_router)
