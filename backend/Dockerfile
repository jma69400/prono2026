# =====================================================
# United Pronos — Backend Python
# =====================================================

FROM python:3.12-slim

WORKDIR /app

# Outils de build pour argon2 (et autres natifs si besoin)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Crée l'utilisateur non-root AVANT d'installer les packages
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app

# Bascule sur appuser pour le reste (install + runtime)
USER appuser

# Ajoute le PATH local de l'utilisateur (où pip --user installe les binaires)
ENV PATH=/home/appuser/.local/bin:$PATH

# Installe les dépendances Python (en tant qu'appuser)
COPY --chown=appuser:appuser requirements.txt .
RUN pip install --user --no-cache-dir --upgrade pip && \
    pip install --user --no-cache-dir -r requirements.txt

# Code applicatif
COPY --chown=appuser:appuser main.py .
COPY --chown=appuser:appuser wc2026_schedule.py .

# Volume pour la DB et les secrets (persistance)
VOLUME ["/app/data"]
ENV DB_PATH=/app/data/prono2026.db
ENV SECRET_FILE=/app/data/.jwt_secret

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health', timeout=3)" || exit 1

# === CONFIGURATION POUR CPX42 (8 vCPU, 16 GB RAM) ===
# 2 workers : SQLite sérialise les écritures de toute façon, donc plus de workers
# n'aide pas pour les écritures. 2 workers suffisent largement pour 200-300
# connexions concurrentes avec WAL. Et ça divise par 2 la consommation RAM
# (vs 4 workers) → évite l'OOM killer.
# Note importante : avec plusieurs workers, le CACHE RAM in-process n'est PAS partagé entre
# workers. Chaque worker a son propre cache. C'est OK car les TTL sont courts (15-30s)
# et au pire on a 2× la même requête BDD au lieu d'1 (toujours acceptable).
#
# --h11-max-incomplete-event-size 16777216 : autorise les uploads d'images dans le chat
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--h11-max-incomplete-event-size", "16777216"]
