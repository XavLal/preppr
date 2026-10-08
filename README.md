# Preppr

Preppr est une application familiale pour planifier les repas et faire les courses.

On compose les menus avec un assistant (Google Gemini ou Anthropic Claude), ou on importe un fichier JSON. Les recettes et la liste de courses, regroupée par rayon, sont partagées par toutes les personnes connectées avec le même compte. La liste de courses reste utilisable sans réseau, puis se synchronise au retour de la connexion.

Il n’y a pas d’inscription dans l’interface. La personne qui installe Preppr crée le compte famille une fois, puis partage l’adresse et les identifiants avec le foyer.

## Démarrer avec Docker

C’est le chemin le plus simple. Il faut [Docker](https://docs.docker.com/get-docker/) avec Docker Compose. Node.js n’est pas nécessaire.

À la racine du projet, créez un fichier `.env` (il n’est pas versionné) :

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
```

Puis lancez l’application :

```bash
docker compose up --build -d
```

Ouvrez [http://localhost:3000](http://localhost:3000).

Créez le compte famille. L’identifiant accepte lettres, chiffres et tirets. Le mot de passe fait au moins 4 caractères. Le mode interactif évite de laisser le mot de passe dans l’historique du terminal :

```bash
docker compose exec -it app node server/dist/cli/add-user.js
```

Connectez-vous dans le navigateur avec ces identifiants. La case **Se souvenir de moi** garde la session 30 jours ; sans elle, la session dure 8 heures.

La suite se passe dans l’application : [guide d’utilisation](docs/utilisation.md).

Les données (comptes, recettes, liste, clés d’API) sont dans le volume Docker `preppr-data`. Elles survivent à un redémarrage du conteneur.

## Documentation

| Document | Pour qui |
| --- | --- |
| [Installation](docs/installation.md) | Docker, Node.js en local, variables, sauvegardes, mises à jour |
| [Utilisation](docs/utilisation.md) | Connexion, menus, recettes, courses, téléphone, hors ligne |
| [Format JSON](docs/format-json.md) | Importer des recettes collées depuis une autre IA |

## Développement

Node.js 22 ou plus récent.

```bash
npm install
npm run add-user -w server -- famille mot-de-passe
npm run dev
```

L’interface est sur [http://localhost:5173](http://localhost:5173), l’API sur le port 3001. Le détail est dans le [guide d’installation](docs/installation.md).
