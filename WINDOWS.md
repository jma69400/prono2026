# 🪟 Guide Windows — PRONO 2026

Ce guide te permet de lancer PRONO 2026 sur Windows même si `start.bat` ne marche pas.

---

## ✅ Méthode 1 : double-clic sur `start.bat`

C'est la méthode la plus simple. Si elle marche, tu n'as pas besoin de lire la suite.

⚠️ **Si la fenêtre se ferme aussitôt** : **NE DOUBLE-CLIQUE PAS** sur le `.bat`. À la place :

1. Ouvre l'explorateur de fichiers et va dans le dossier `prono2026`
2. **Maintiens Shift + clic droit** dans le dossier (sur le fond, pas sur un fichier)
3. Choisis **"Ouvrir une fenêtre PowerShell ici"** ou **"Ouvrir l'invite de commandes ici"**
4. Tape : `start.bat` puis Entrée

Comme ça tu verras le message d'erreur, la fenêtre ne se fermera pas.

---

## ✅ Méthode 2 : deux fenêtres séparées (plus stable)

Si `start.bat` plante, utilise les deux scripts séparés :

1. Double-clic sur **`start-backend.bat`** → laisse cette fenêtre ouverte
2. Double-clic sur **`start-frontend.bat`** → laisse cette fenêtre ouverte aussi
3. Ouvre `http://localhost:5173` dans ton navigateur

Pour tout arrêter : ferme les deux fenêtres.

---

## ✅ Méthode 3 : commandes manuelles (méthode garantie)

Cette méthode marche **toujours** si tes prérequis sont installés.

### 1. Vérifier les prérequis

Ouvre **PowerShell** et tape :

```powershell
python --version
node --version
npm --version
```

Tu dois voir trois numéros de version (Python ≥ 3.11, Node ≥ 18). Si l'un manque :
- **Python** : https://www.python.org/downloads/ → ⚠️ coche **"Add python.exe to PATH"** pendant l'install
- **Node.js** : https://nodejs.org/ (LTS)

> Si `python` n'est pas reconnu mais `py` l'est, c'est OK : Windows propose les deux. Le script `start.bat` détecte automatiquement les deux.

### 2. Installer le backend (PowerShell, dossier `prono2026`)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

> Si `Activate.ps1` est bloqué par PowerShell, lance d'abord :
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### 3. Lancer le backend (laisse cette fenêtre ouverte)

```powershell
uvicorn main:app --port 8000
```

Tu dois voir : `Uvicorn running on http://0.0.0.0:8000`

### 4. Installer le frontend (nouvelle fenêtre PowerShell, dossier `prono2026`)

```powershell
cd frontend
npm install
```

### 5. Lancer le frontend (toujours dans la même fenêtre)

```powershell
npm run dev
```

Le navigateur s'ouvre tout seul sur `http://localhost:5173`. ✅

---

## 🚨 Erreurs fréquentes Windows

### "python n'est pas reconnu en tant que commande"
Python n'est pas dans le PATH. Deux solutions :
- **Réinstalle Python** depuis python.org en cochant cette fois "Add to PATH"
- **Ou utilise `py`** : `py -m venv venv` au lieu de `python -m venv venv`

### "L'exécution de scripts est désactivée sur ce système"
Windows bloque les scripts PowerShell par défaut. Tape une fois pour autoriser :
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Microsoft Visual C++ 14.0 or greater is required" pendant pip install
C'est argon2 qui a besoin du compilateur C++. Solutions :
- **Solution 1 (rapide)** : Installer **Microsoft C++ Build Tools** : https://visualstudio.microsoft.com/visual-cpp-build-tools/
  → Pendant l'installation, coche **"Outils de génération C++"**
- **Solution 2 (sans compilation)** : argon2-cffi inclut désormais des wheels pré-compilées pour Windows. Tape :
  ```powershell
  pip install argon2-cffi --only-binary :all:
  pip install -r requirements.txt
  ```

### Le port 8000 ou 5173 est déjà utilisé
```powershell
# Trouver qui occupe le port
netstat -ano | findstr :8000

# Tuer le process (remplace 12345 par le PID que tu as trouvé)
taskkill /PID 12345 /F
```

### "Cannot find module 'lucide-react'" dans le navigateur
`npm install` a échoué ou pas été lancé. Solution :
```powershell
cd frontend
del /s /q node_modules
del package-lock.json
npm install
```

### Le backend démarre mais le frontend dit "Erreur réseau"
Le proxy Vite n'arrive pas à joindre le backend. Vérifie :
1. Que le backend est bien actif : ouvre `http://localhost:8000/api/health` dans ton navigateur, tu dois voir `{"status":"ok"}`
2. Que ton firewall ne bloque pas le port 8000 (clique "Autoriser" si Windows demande)

### Antivirus / Windows Defender bloque le venv ou node_modules
Certains antivirus bloquent la création de centaines de fichiers d'un coup. Solutions :
- **Pause temporaire** : désactive l'antivirus 5 min, lance l'installation, réactive
- **Exception** : ajoute le dossier `prono2026` à la liste blanche de ton antivirus

---

## 🔄 Tout réinitialiser

```powershell
# Backend
cd backend
rmdir /s /q venv
del prono2026.db .jwt_secret

# Frontend
cd ..\frontend
rmdir /s /q node_modules
del package-lock.json

# Puis relance start.bat
```

---

## 📞 Si rien ne marche

Copie-moi **le message d'erreur exact** (tout ce que la fenêtre affiche en rouge ou après "Error:") et je te donne la solution précise.
