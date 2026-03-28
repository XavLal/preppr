# Meal planner

Application familiale : import de recettes au format JSON (généré par l’IA), planification, liste de courses par rayon, synchronisation via API (polling), comptes par famille (login / mot de passe).

Le JSON d’import contient `weekId`, un tableau `recipes` (comme décrit par l’IA) et optionnellement **`extraIngredients`** : liste d’objets `{ name, quantity, unit, aisle }` pour des articles **hors recettes** (ex. papier toilette). Ces lignes sont ajoutées à la liste de courses avec le repère « Hors recette ».

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

## Hors ligne & PWA

- **IndexedDB** : dernière copie de l’état par famille (clé = `sub` du JWT) ; en cas d’échec du chargement, affichage du cache.
- **Liste de courses** : en l’absence de réseau (ou si l’API échoue), les changements sont enregistrés localement puis **synchronisés** au retour en ligne (fusion : courses + portions cibles si le serveur a une version plus récente).
- **PWA** : `npm run build` génère un **service worker** (précache des assets). En production, servir le build avec le serveur Node (`CLIENT_DIST`) pour une seule origine.
- Développement : `vite-plugin-pwa` a `devOptions.enabled: false` ; tester le SW via `npm run build && npm run preview -w client`.

## Prochaines étapes possibles

- Déduplication à l’import, outil « nouvelle semaine »
- File d’attente détaillée par opération (au-delà du snapshot + fusion actuelle)
