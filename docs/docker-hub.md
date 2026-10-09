# Preppr

Preppr est une application familiale pour planifier les repas et faire les courses.

On compose les menus avec un assistant (Google Gemini ou Anthropic Claude), ou on importe un fichier JSON. Les recettes et la liste de courses, regroupée par rayon, sont partagées par toutes les personnes connectées avec le même compte. La liste de courses reste utilisable sans réseau, puis se synchronise au retour de la connexion.

Au premier lancement, on crée un compte administrateur. Ce compte sert à un foyer, et peut ensuite créer d’autres foyers. Chaque foyer a ses propres recettes et sa propre liste. Les personnes d’un même foyer partagent un seul identifiant.

Image : `xavlal/preppr`  
Code : [github.com/XavLal/preppr](https://github.com/XavLal/preppr)

## Installer

Aucun fichier de configuration n’est nécessaire. Au premier démarrage, Preppr génère le secret qui signe les sessions et le conserve dans le volume de données (`jwt-secret`). Les recettes, les comptes et les clés d’API y sont aussi enregistrés. Le volume survit aux mises à jour.

Le conteneur démarre en root le temps d’ajuster les droits du volume, puis l’application tourne avec l’utilisateur `preppr` (UID 1000). Les dossiers de données sont en `0700`, les fichiers en `0600`.

### Avec `docker run`

```bash
docker run -d \
  --name preppr \
  --restart unless-stopped \
  -p 3000:3000 \
  -v preppr-data:/data \
  xavlal/preppr:latest
```

Ouvrez [http://localhost:3000](http://localhost:3000).

Pour un dossier de l’hôte à la place d’un volume nommé, remplacez `preppr-data` par un chemin, par exemple `-v /chemin/vers/donnees:/data`. Ce dossier sera attribué à l’UID 1000.

### Avec Docker Compose

Enregistrez ce fichier sous `compose.yaml` :

```yaml
services:
  preppr:
    image: xavlal/preppr:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - preppr-data:/data

volumes:
  preppr-data:
```

Puis :

```bash
docker compose up -d
```

L’application écoute sur [http://localhost:3000](http://localhost:3000).

### Depuis une interface (NAS, Portainer, etc.)

1. Image : `xavlal/preppr:latest` (ou une version figée, par exemple `xavlal/preppr:0.4.0`).
2. Publiez le port **3000** du conteneur sur un port libre de la machine.
3. Montez un volume ou un jeu de données sur **`/data`**.
4. Laissez le redémarrage automatique activé.
5. Démarrez, puis ouvrez `http://<adresse-de-la-machine>:<port>`.

### Premier compte

Le formulaire **Créer le compte administrateur** n’apparaît que tant qu’aucun compte n’existe. Il demande le **code d’installation**, affiché une fois dans les journaux :

```bash
docker logs -f preppr
```

Avec Compose, le nom du service remplace `preppr` si vous l’avez nommé autrement (`docker compose logs -f preppr`).

Cherchez la ligne `Code d'installation Preppr`. Sans ce code, un visiteur du réseau ne peut pas devenir administrateur. Le code est effacé dès que le compte est créé.

1. Ouvrez l’adresse de Preppr.
2. Copiez le code d’installation.
3. Choisissez un identifiant : lettres, chiffres et tirets.
4. Choisissez un mot de passe d’au moins 12 caractères, et confirmez-le.
5. Validez. La session de ce premier compte dure 30 jours.

### Autres foyers

Connecté avec le compte administrateur : **Paramètres → Comptes des foyers**.

1. Saisissez l’identifiant du nouveau foyer.
2. Saisissez un mot de passe initial d’au moins 12 caractères.
3. Transmettez vous-même l’identifiant et le mot de passe.

Deux identifiants qui se normalisent de la même façon (`Famille A` et `famille-a`) ne peuvent pas coexister : le second est refusé. Chaque foyer a ses recettes et sa liste. L’administrateur ne les voit pas. Les autres comptes ne peuvent pas en créer.

La même création est possible sans le navigateur. Le premier compte créé ainsi est administrateur, les suivants sont des foyers ordinaires.

```bash
docker exec -it preppr node server/dist/cli/add-user.js
```

### Mots de passe

Chacun change le sien dans **Paramètres → Mon compte**. Les autres appareils de ce compte doivent alors se reconnecter.

L’administrateur réinitialise le mot de passe d’un autre foyer depuis **Comptes des foyers**. Les appareils de ce foyer sont déconnectés. Ce mot de passe permet aussi de s’y connecter : il sert à dépanner quelqu’un qui l’a oublié.

Il n’y a pas de « mot de passe oublié » par e-mail. Si l’administrateur oublie le sien, l’accès à la machine tient lieu de preuve. Le mode interactif évite de laisser le mot de passe dans l’historique du terminal :

```bash
docker exec -it preppr node server/dist/cli/reset-password.js
```

En une ligne (le mot de passe reste dans l’historique du shell) :

```bash
docker exec preppr node server/dist/cli/reset-password.js famille nouveau-mot-de-passe
```

Le nouveau mot de passe fait au moins 12 caractères. Un mot de passe déjà enregistré, plus court, continue de fonctionner jusqu’à ce qu’on le change.

### Changer le port

Dans `docker run`, remplacez `3000:3000` par `8080:3000` pour publier Preppr sur le port 8080 de la machine. Le nombre de droite reste **3000** : c’est le port à l’intérieur du conteneur.

Dans Compose :

```yaml
ports:
  - "8080:3000"
```

### Imposer le secret de session

Sans réglage, le secret est créé dans `/data/jwt-secret` et réutilisé aux démarrages suivants. S’il change, tout le monde doit se reconnecter ; les recettes et la liste restent en place.

Pour en imposer un :

```bash
docker run -d \
  --name preppr \
  --restart unless-stopped \
  -p 3000:3000 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -v preppr-data:/data \
  xavlal/preppr:latest
```

Gardez cette valeur : elle prime sur le fichier `jwt-secret`.

### Mettre à jour

Le volume de données est conservé.

```bash
docker pull xavlal/preppr:latest
docker stop preppr
docker rm preppr
docker run -d \
  --name preppr \
  --restart unless-stopped \
  -p 3000:3000 \
  -v preppr-data:/data \
  xavlal/preppr:latest
```

Avec Compose, dans le dossier du fichier :

```bash
docker compose pull
docker compose up -d
```

Pour contrôler le moment de la mise à jour, figez une version (`xavlal/preppr:0.4.0`) à la place de `latest`.

Une installation qui tournait encore avec l’ancien secret de repli `change-me-in-production` reçoit un vrai secret à la mise à jour : une reconnexion unique.

### Sauvegarder

Les fichiers sont dans le volume monté sur `/data` :

```text
/data/accounts.json
/data/jwt-secret
/data/tenants/<identifiant>/state.json
/data/tenants/<identifiant>/history/
```

`accounts.json` contient les identifiants et les empreintes de mots de passe. `jwt-secret` signe les sessions lorsqu’aucun `JWT_SECRET` n’est défini : sauvegardez-le avec le reste, sinon tout le monde devra se reconnecter. `state.json` est l’état courant (recettes, courses, réglages, clés d’API). Le dossier `history/` garde jusqu’à 50 copies automatiques de cet état.

Il n’y a pas d’écran de restauration. Pour revenir en arrière, arrêtez le conteneur, remplacez `state.json` par une copie de `history/`, puis relancez-le.

```bash
docker stop preppr
mkdir -p sauvegarde
docker cp preppr:/data/. ./sauvegarde
docker start preppr
```

`docker rm` supprime le conteneur, pas le volume nommé `preppr-data`. `docker volume rm preppr-data` efface les données.

### Variables d’environnement

| Variable | Rôle | Valeur si absente |
| --- | --- | --- |
| `JWT_SECRET` | Signature des sessions | Secret généré dans `/data/jwt-secret` |
| `PORT` | Port d’écoute dans le conteneur | `3000` |
| `DATA_DIR` | Dossier des comptes et des foyers | `/data` |

### Accès depuis le téléphone

Sur le réseau local, ouvrez `http://<adresse-ip-de-la-machine>:3000` (ou le port publié).

Pour installer Preppr sur l’écran d’accueil, le navigateur demande en général une adresse en **HTTPS**, sauf sur `localhost`. Placez Preppr derrière le reverse proxy de votre NAS ou de votre box, sur la même origine que l’API. Le guide pas à pas est dans l’application : **Paramètres → Comment installer l’application**.

Les clés Gemini et Claude se saisissent dans **Paramètres**, après connexion. Elles sont enregistrées avec les données du foyer. Les appels à l’IA partent du navigateur vers Google ou Anthropic : les téléphones et ordinateurs qui génèrent des menus ont besoin d’un accès Internet. La liste de courses n’a pas besoin de ces clés.

## Utiliser

La barre du haut a trois entrées : **Recettes** (le plan), **Courses** (la liste par rayon) et l’icône d’assistant (le générateur de menus). Le menu **☰** contient **Paramètres** et **Déconnexion**. La déconnexion efface aussi la copie locale de ce foyer sur l’appareil.

L’interface est en français ou en anglais. Le choix de langue reste sur l’appareil.

### Se connecter

1. Ouvrez l’adresse de Preppr.
2. S’il n’existe encore aucun compte, suivez [Premier compte](#premier-compte). Sinon, saisissez l’identifiant et le mot de passe du foyer.
3. Laissez **Se souvenir de moi** coché sur un téléphone ou un ordinateur personnel (session de 30 jours). Décochez-la sur un appareil partagé (session de 8 heures).

### Régler l’assistant

1. Ouvrez **☰ → Paramètres**.
2. Dans **Modèle d’IA**, choisissez **Google Gemini** ou **Anthropic Claude**.
3. Créez une clé chez le fournisseur (les liens sont dans la page) et collez-la. L’enregistrement est automatique.
4. Dans **Contexte utilisateur**, décrivez le foyer : nombre de personnes, allergies, matériel, façon dont l’assistant doit proposer les plats. Ces textes sont envoyés à chaque conversation.

**Réinitialiser les préférences par défaut** vide aussi les clés d’API.

**Ordre des rayons** aligne la liste sur le parcours du magasin. Les flèches montent ou descendent un rayon. **Réinitialiser l’ordre des rayons** revient à l’ordre d’origine.

### Générer les menus

Ouvrez l’assistant (icône en haut, ou **Générer mes menus** quand le plan est vide).

1. Indiquez combien de repas vous voulez, un repas particulier éventuel, et les contraintes de cette fois (temps, reste du frigo).
2. **Envoyer**. Entrée envoie le message. Maj+Entrée passe à la ligne. Le trombone joint une photo (liste manuscrite, frigo, placard).
3. Choisissez parmi les recettes proposées. L’assistant en propose d’autres jusqu’au nombre demandé, puis produit un fichier de recettes.
4. Dès que ce fichier est valide, Preppr l’importe : les plats arrivent dans **Recettes**, les ingrédients dans **Courses**. Un bandeau confirme l’import.

Le bouton de rafraîchissement à côté du titre démarre une nouvelle conversation. L’historique du chat reste sur l’appareil. Les recettes importées sont sur le serveur, partagées par le foyer.

**Recettes → Importer depuis un JSON** ajoute des recettes déjà rédigées ailleurs. L’import ne remplace pas celles qui sont déjà là. Le format est décrit dans le dépôt : [format JSON](https://github.com/XavLal/preppr/blob/main/docs/format-json.md).

### Recettes

La page d’accueil résume ce qui reste à cuisiner, ce qui est déjà fait, ce qui reste à acheter et ce qui est déjà coché.

Sur chaque carte :

- le titre ouvre la fiche ;
- **Déjà fait** marque le plat comme cuisiné ;
- les flèches changent l’ordre ;
- **Retirer** sort le plat du plan.

**Retirer** s’active seulement après **Déjà fait**. Le retrait enlève aussi les ingrédients de la liste, sauf les articles saisis à la main.

**Supprimer toutes les recettes** (en bas de page) demande une confirmation et une connexion. Les articles ajoutés à la main dans les courses sont conservés.

Sur la fiche :

- **Portions** va de 1 à 24. Les quantités des ingrédients et de la liste suivent. La base de la recette ne change pas.
- Le crayon modifie le titre, le lien, le temps, les ingrédients et les étapes.
- Le lien à côté de la source ouvre la page d’origine quand une URL a été fournie.

**Ajouter une recette manuellement** sert pour un plat maison. Une ligne par ingrédient (`2 tomates`, `200 g de pâtes`), une ligne par étape.

### Liste de courses

Les ingrédients des recettes sont regroupés par rayon, et additionnés quand le nom, l’unité et le rayon correspondent.

1. Cochez un article une fois qu’il est dans le panier.
2. **Retirer** une ligne n’est possible qu’après l’avoir cochée.
3. **Ajouter un ingrédient** crée une ligne marquée **Manuel**. Le bouton **+** à côté d’un rayon préremplit ce rayon.
4. Touchez la ligne pour modifier le nom, la quantité, l’unité ou le rayon.
5. Dans un rayon, la poignée **⋮** ou les flèches changent l’ordre.

Les articles hors recettes venus de l’import portent le badge **Hors recette**.

- **Imprimer** ouvre la boîte d’impression du navigateur.
- **Retirer les articles cochés** enlève ce qui est déjà acheté et laisse le reste.
- **Vider toute la liste** efface toutes les lignes. Les fiches recettes restent. Cette action demande une connexion.

Unités : `g`, `kg`, `ml`, `cl`, `L`, `càs`, `càc`, `pièce`, `pincée`.

Rayons : Fruits & Légumes, Viandes & Poissons, Frais & Laitier, Épicerie Salée, Épicerie Sucrée, Boulangerie, Surgelés, Boissons, Hygiène & Beauté, Divers.

### Hors ligne

Quand le réseau manque, un badge **Hors ligne** s’affiche. La dernière copie connue du foyer reste lisible.

Sur la liste de courses (cocher, ajouter, modifier, retirer un article déjà coché) et sur les portions, les changements sont gardés sur l’appareil. Le badge **À synchroniser** indique qu’ils ne sont pas encore partis. Au retour du réseau, Preppr les envoie. Si quelqu’un d’autre a modifié les données entre-temps, les courses et les portions de l’appareil sont reprises sur la version la plus récente du serveur.

**Supprimer toutes les recettes** et **Vider toute la liste** demandent d’être en ligne, sans synchronisation en attente.

### Sur le téléphone

**Paramètres → Comment installer l’application (Android et iPhone)** détaille les gestes.

- Android, Chrome : menu **⋮**, puis **Installer l’application** ou **Ajouter à l’écran d’accueil**.
- iPhone ou iPad, Safari : **Partager**, puis **Sur l’écran d’accueil**.

Une fois installée, Preppr s’ouvre comme une application. L’installation depuis un téléphone distant fonctionne en HTTPS. En local, `http://localhost` suffit sur la machine qui héberge Preppr.
