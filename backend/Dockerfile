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

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
