# Installer Preppr

Deux façons de lancer Preppr : **Docker** (usage familial, un seul service) ou **Node.js** (développement, ou serveur sans Docker).

Dans les deux cas, l’interface et l’API sont servies ensemble en production. Le navigateur parle à la même adresse pour les pages et pour `/api`.

## Docker

### Prérequis

- Docker et Docker Compose
- Un port libre, **3000** par défaut

### Secret de session

Preppr signe les sessions avec `JWT_SECRET`. Compose lit ce secret dans un fichier `.env` à côté de `docker-compose.yml`.

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
```

Le fichier [`.env.example`](../.env.example) rappelle le nom de la variable si vous préférez le créer à la main.

Gardez ce fichier. Si le secret change, tout le monde doit se reconnecter. Les recettes et la liste de courses restent en place.

Sans `.env`, Compose utilise la valeur de repli `change-me-in-production`. Remplacez-la avant d’exposer Preppr en dehors de votre machine.

### Lancer

```bash
docker compose up --build -d
```

L’application écoute sur [http://localhost:3000](http://localhost:3000).

Suivre les journaux :

```bash
docker compose logs -f app
```

Arrêter sans effacer les données :

```bash
docker compose down
```

### Créer un compte

Il n’y a pas de page d’inscription. Créez le compte dans le conteneur :

```bash
docker compose exec -it app node server/dist/cli/add-user.js
```

La commande demande l’identifiant, puis le mot de passe. Un même identifiant ne peut pas être créé deux fois. Chaque compte a ses propres recettes et sa propre liste : deux familles sur le même serveur ne voient pas les données l’une de l’autre.

Pour créer le compte en une ligne (le mot de passe reste alors dans l’historique du shell) :

```bash
docker compose exec app node server/dist/cli/add-user.js famille mot-de-passe
```

### Changer le port

Dans `docker-compose.yml`, la ligne `ports` est `"3000:3000"`. Pour publier Preppr sur le port 8080 de la machine :

```yaml
ports:
  - "8080:3000"
```

Laissez `PORT: "3000"` : c’est le port **à l’intérieur** du conteneur. Seul le nombre de gauche change.

### Mettre à jour

Depuis le dossier du projet, avec le même fichier `.env` :

```bash
docker compose up --build -d
```

Le volume `preppr-data` est conservé.

### Sauvegarder

Les fichiers vivent dans le volume nommé `preppr-data`, monté sur `/data` dans le conteneur :

```text
/data/accounts.json
/data/tenants/<identifiant>/state.json
/data/tenants/<identifiant>/history/
```

`accounts.json` contient les identifiants et les empreintes de mots de passe. `state.json` est l’état courant (recettes, courses, réglages, clés d’API). Le dossier `history/` garde jusqu’à 50 copies automatiques de cet état. Il n’y a pas d’écran de restauration : pour revenir en arrière, remplacez `state.json` par une copie de `history/` pendant que le conteneur est arrêté, puis relancez-le.

Exemple de copie vers un dossier local `sauvegarde/`. Le conteneur doit encore exister (`docker compose stop` le laisse en place ; `docker compose down` le supprime, le volume lui reste) :

```bash
docker compose stop
mkdir -p sauvegarde
docker compose cp app:/data/. ./sauvegarde
docker compose start
```

## Node.js, sans Docker

### Prérequis

- Node.js **22** ou plus récent
- npm (fourni avec Node)

### Installation

À la racine du projet :

```bash
npm install
```

### Compte famille

```bash
npm run add-user -w server -- famille mot-de-passe
```

Sans les deux arguments, la commande demande l’identifiant et le mot de passe :

```bash
npm run add-user -w server
```

Les fichiers sont créés dans `data/` (ignoré par git) :

```text
data/accounts.json
data/tenants/<identifiant>/state.json
```

Pour un autre dossier :

```bash
DATA_DIR=/chemin/vers/donnees npm run add-user -- famille mot-de-passe
```

Utilisez le même `DATA_DIR` au démarrage du serveur.

### Développement

Deux processus : l’API et l’interface, avec rechargement automatique.

```bash
npm run dev
```

- Interface : [http://localhost:5173](http://localhost:5173) (les appels `/api` sont transmis au port 3001)
- API : port **3001**

Le service worker de l’application installable est désactivé dans ce mode. Pour le tester : `npm run build`, puis `npm run preview -w client`.

### Production sur la même machine

```bash
npm run build
```

Puis, depuis la racine, avec un secret réel :

```bash
JWT_SECRET="$(openssl rand -hex 32)" \
CLIENT_DIST=client/dist \
DATA_DIR=data \
npm start
```

Ouvrez [http://localhost:3001](http://localhost:3001). Le port par défaut hors Docker est **3001**. Pour le changer : `PORT=3000` devant la commande.

`npm start` lance le JavaScript déjà compilé. `CLIENT_DIST` indique où se trouvent les pages construites. Sans cette variable, seule l’API répond.

Créez le compte **avant** ou **après** le démarrage, avec le même `DATA_DIR`. En production le code TypeScript n’est plus lancé par `tsx` : si `npm run add-user` n’est pas disponible, utilisez le fichier compilé :

```bash
DATA_DIR=data node server/dist/cli/add-user.js
```

## Variables d’environnement

| Variable | Rôle | Valeur si absente |
| --- | --- | --- |
| `JWT_SECRET` | Signature des sessions | `dev-secret-change-me` (Node) ou `change-me-in-production` (Compose) |
| `PORT` | Port d’écoute | `3001` en Node, `3000` dans l’image Docker |
| `DATA_DIR` | Dossier des comptes et des familles | `./data` en Node, `/data` dans Docker |
| `CLIENT_DIST` | Dossier du site construit, servi avec l’API | désactivé en Node ; `/app/static` dans Docker |

## Accès depuis le téléphone

Sur le réseau local, ouvrez `http://<adresse-ip-de-la-machine>:3000` (Docker) ou le port choisi. Pour installer Preppr sur l’écran d’accueil, le navigateur demande en général une adresse en **HTTPS**, sauf sur `localhost`. Placez Preppr derrière le reverse proxy de votre NAS ou de votre box, sur la même origine que l’API (pas de site statique séparé). Le guide d’installation dans l’application est sous **Paramètres → Comment installer l’application**.

## Clés d’API de l’assistant

Les clés Gemini et Claude se saisissent dans **Paramètres**, après connexion. Elles sont enregistrées avec les données de la famille, sur le serveur. Les appels à l’IA partent du navigateur vers Google ou Anthropic. Prévoir un accès Internet sortant depuis les téléphones et ordinateurs qui génèrent des menus. La liste de courses, elle, n’a pas besoin de ces clés.
