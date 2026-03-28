# Meal planner

Application familiale : import de recettes au format JSON (généré par l’IA), planification, liste de courses par rayon, synchronisation via API (polling), comptes par famille (login / mot de passe).

## Prérequis

- Node.js 22+

## Installation

```bash
npm install
```

## Créer un compte famille

```bash
npm run add-user -w server -- mon-identifiant mon-mot-de-passe
```

(`npm run add-user -w server` sans arguments : mode interactif.)

## Développement

Terminal 1 — API (port **3001**) :

```bash
npm run dev -w server
```

Terminal 2 — interface Vite (proxy `/api` → 3001) :

```bash
npm run dev -w client
```

Ou les deux :

```bash
npm install
npm run dev
```

Ouvrir http://localhost:5173

Variables utiles côté serveur :

- `JWT_SECRET` — secret de signature des jetons (obligatoire en production)
- `PORT` — défaut `3001`
- `DATA_DIR` — dossier des données (défaut : `./data` depuis le répertoire de travail du processus)

## Production (build local)

```bash
npm run build
cd server
CLIENT_DIST=../client/dist JWT_SECRET=dev node dist/index.js
```

L’app est servie sur le port `PORT` (défaut **3001**), avec le frontend sur la même origine.

## Docker

```bash
export JWT_SECRET=$(openssl rand -hex 32)
docker compose up --build
```

Données dans le volume `mealplanner-data` monté sur `/data`.

## Prochaines étapes (hors périmètre actuel)

- PWA / cache Service Worker et file d’attente IndexedDB pour la liste de courses hors ligne
- Déduplication à l’import, outil « nouvelle semaine »
