# Installer Preppr

Deux façons de lancer Preppr : **Docker** (usage familial, un seul service) ou **Node.js** (développement, ou serveur sans Docker).

Dans les deux cas, l’interface et l’API sont servies ensemble en production. Le navigateur parle à la même adresse pour les pages et pour `/api`.

## Docker

### Prérequis

- Docker et Docker Compose
- Un port libre, **3000** par défaut

### Lancer

Aucun fichier `.env` n’est nécessaire. Au premier démarrage, Preppr génère le secret qui signe les sessions et le conserve dans le volume de données (`jwt-secret`). Il survit aux mises à jour. S’il change, tout le monde doit se reconnecter ; les recettes et la liste de courses restent en place.

Une installation qui tournait sans `.env` sur l’ancienne valeur de repli `change-me-in-production` reçoit un vrai secret à la mise à jour : une reconnexion unique.

```bash
docker compose up --build -d
```

L’application écoute sur [http://localhost:3000](http://localhost:3000).

Pour imposer vous-même le secret, créez un `.env` à côté de `docker-compose.yml` (`[.env.example](../.env.example)` rappelle le nom) :

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
```

Gardez ce fichier : il prime sur `jwt-secret`.

Suivre les journaux :

```bash
docker compose logs -f app
```

Arrêter sans effacer les données :

```bash
docker compose down
```

### Premier compte

Ouvrez l’adresse tout de suite après le premier lancement. Le formulaire **Créer le compte administrateur** n’apparaît que tant qu’aucun compte n’existe. Il demande aussi le **code d’installation**, affiché une fois dans les journaux :

```bash
docker compose logs -f app
```

Cherchez la ligne `Code d'installation Preppr`. Sans ce code, un visiteur du réseau ne peut pas devenir administrateur. Le mot de passe fait au moins 12 caractères.

Depuis **Paramètres → Comptes des foyers**, ce compte crée les autres foyers et leur transmet l’identifiant et le mot de passe. Chaque foyer a ses propres recettes et sa propre liste. Les autres comptes ne peuvent pas en créer. Chacun change son mot de passe dans **Paramètres → Mon compte**. L’administrateur réinitialise celui d’un autre foyer, ce qui déconnecte ses appareils.

Il n’y a pas de « mot de passe oublié » par e-mail. Si l’administrateur oublie le sien, la commande suivante le remplace. L’accès à la machine tient lieu de preuve. Le mode interactif évite de laisser le mot de passe dans l’historique du terminal :

```bash
docker compose exec -it app node server/dist/cli/reset-password.js
```

La même commande fonctionne pour n’importe quel identifiant. En une ligne (le mot de passe reste dans l’historique du shell) :

```bash
docker compose exec app node server/dist/cli/reset-password.js famille nouveau-mot-de-passe
```

La commande `add-user` reste disponible pour créer un compte sans passer par le navigateur. Le premier compte créé ainsi est administrateur, les suivants sont des foyers ordinaires :

```bash
docker compose exec -it app node server/dist/cli/add-user.js
```

### Changer le port

Dans `docker-compose.yml`, la ligne `ports` est `"3000:3000"`. Pour publier Preppr sur le port 8080 de la machine :

```yaml
ports:
  - "8080:3000"
```

Laissez `PORT: "3000"` : c’est le port **à l’intérieur** du conteneur. Seul le nombre de gauche change.

### Mettre à jour

Depuis le dossier du projet (et le même `.env`, si vous en avez défini un) :

```bash
docker compose up --build -d
```

Le volume Docker `preppr-data` est conservé. Au démarrage, le conteneur ajuste ce volume pour que l’application, qui ne tourne pas en root, puisse l’écrire. Les fichiers de données sont ensuite limités au propriétaire (`0700` pour les dossiers, `0600` pour les fichiers).

### Sauvegarder

Les fichiers vivent dans le volume nommé `preppr-data`, monté sur `/data` dans le conteneur :

```text
/data/accounts.json
/data/jwt-secret
/data/tenants/<identifiant>/state.json
/data/tenants/<identifiant>/history/
```

`accounts.json` contient les identifiants et les empreintes de mots de passe. `jwt-secret` signe les sessions lorsqu’aucun `JWT_SECRET` n’est défini : sauvegardez-le avec le reste, sinon tout le monde devra se reconnecter. `state.json` est l’état courant (recettes, courses, réglages, clés d’API). Le dossier `history/` garde jusqu’à 50 copies automatiques de cet état. Il n’y a pas d’écran de restauration : pour revenir en arrière, remplacez `state.json` par une copie de `history/` pendant que le conteneur est arrêté, puis relancez-le.

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

### Données

Les fichiers sont créés dans `data/` (ignoré par git) au premier compte :

```text
data/accounts.json
data/jwt-secret
data/tenants/<identifiant>/state.json
```

Pour un autre dossier, le même `DATA_DIR` sert au démarrage et aux commandes de secours :

```bash
DATA_DIR=/chemin/vers/donnees npm start
```

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

Puis, depuis la racine :

```bash
DATA_DIR=data npm start
```

Ouvrez [http://localhost:3001](http://localhost:3001) et créez le compte administrateur. Le port par défaut hors Docker est **3001**. Pour le changer : `PORT=3000` devant la commande.

`npm start` lance le JavaScript déjà compilé et sert les pages de `client/dist` à côté de l’API. Le secret de session est écrit dans `data/jwt-secret` s’il n’existe pas encore.

En production le code TypeScript n’est plus lancé par `tsx`. Pour un mot de passe oublié, ou pour créer un compte sans le navigateur :

```bash
DATA_DIR=data node server/dist/cli/reset-password.js
DATA_DIR=data node server/dist/cli/add-user.js
```

En développement, les mêmes commandes passent par npm : `npm run reset-password` et `npm run add-user`.

`DATA_DIR=data` est toujours le dossier `data` à la racine du projet, que la commande parte de la racine ou du workspace `server`. Le code d’installation s’affiche dans le terminal au premier démarrage sans compte.

Si un ancien `accounts.json` contient deux identifiants qui aboutissent au même dossier (par exemple `Famille A` et `famille-a`), Preppr refuse de démarrer. La commande suivante donne un dossier distinct au second compte, en copiant les données existantes :

```bash
DATA_DIR=data node server/dist/cli/migrate-accounts.js
```

En développement : `npm run migrate-accounts`.

## Variables d’environnement


| Variable      | Rôle                                        | Valeur si absente                                              |
| ------------- | ------------------------------------------- | -------------------------------------------------------------- |
| `JWT_SECRET`  | Signature des sessions                      | secret généré et conservé dans `DATA_DIR/jwt-secret`           |
| `PORT`        | Port d’écoute                               | `3001` en Node, `3000` dans l’image Docker                     |
| `DATA_DIR`    | Dossier des comptes et des familles         | `./data` en Node, `/data` dans Docker                          |
| `CLIENT_DIST` | Dossier du site construit, servi avec l’API | `client/dist` s’il existe, sinon `/app/static` dans l’image    |


## Accès depuis le téléphone

Sur le réseau local, ouvrez `http://<adresse-ip-de-la-machine>:3000` (Docker) ou le port choisi. Pour installer Preppr sur l’écran d’accueil, le navigateur demande en général une adresse en **HTTPS**, sauf sur `localhost`. Placez Preppr derrière le reverse proxy de votre NAS ou de votre box, sur la même origine que l’API (pas de site statique séparé). Le guide d’installation dans l’application est sous **Paramètres → Comment installer l’application**.

## Clés d’API de l’assistant

Les clés Gemini et Claude se saisissent dans **Paramètres**, après connexion. Elles sont enregistrées avec les données de la famille, sur le serveur. Les appels à l’IA partent du navigateur vers Google ou Anthropic. Prévoir un accès Internet sortant depuis les téléphones et ordinateurs qui génèrent des menus. La liste de courses, elle, n’a pas besoin de ces clés.