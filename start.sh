#!/bin/bash
# PRONO 2026 — Lancement automatique (Mac / Linux)
set -e

cd "$(dirname "$0")"

echo "================================================"
echo "🏆 PRONO 2026 - Installation & Lancement"
echo "================================================"

# --- Backend ---
echo ""
echo "📦 [1/4] Setup backend Python..."
cd backend
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "✓ Backend prêt"

echo ""
echo "🚀 [2/4] Démarrage backend sur http://localhost:8000..."
uvicorn main:app --port 8000 --host 0.0.0.0 &
BACKEND_PID=$!
cd ..

# Attendre que le backend démarre
sleep 3

# --- Frontend ---
echo ""
echo "📦 [3/4] Setup frontend Node.js..."
cd frontend
if [ ! -d "node_modules" ]; then
  npm install
fi
echo "✓ Frontend prêt"

echo ""
echo "🚀 [4/4] Démarrage frontend sur http://localhost:5173..."
echo ""
echo "================================================"
echo "✅ PRONO 2026 est lancé !"
echo "👉 Ouvre http://localhost:5173 dans ton navigateur"
echo "👤 admin@prono26.com / admin123"
echo "👤 demo@prono26.com / demo123"
echo "================================================"
echo ""
echo "Ctrl+C pour tout arrêter"

trap "kill $BACKEND_PID 2>/dev/null; exit" INT TERM
npm run dev
