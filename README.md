# Preppr

Preppr est une application familiale pour planifier les repas et faire les courses.

On compose les menus avec un assistant (Google Gemini ou Anthropic Claude), ou on importe un fichier JSON. Les recettes et la liste de courses, regroupée par rayon, sont partagées par toutes les personnes connectées avec le même compte. La liste de courses reste utilisable sans réseau, puis se synchronise au retour de la connexion.

Au premier lancement, le navigateur propose de créer le compte administrateur. Ce compte sert à un foyer, et peut ensuite créer d’autres foyers depuis **Paramètres**. Chaque foyer a ses propres recettes et sa propre liste. Les personnes d’un même foyer partagent un seul identifiant.

## Démarrer avec Docker

C’est le chemin le plus simple. Il faut [Docker](https://docs.docker.com/get-docker/) avec Docker Compose. Node.js n’est pas nécessaire. Aucun fichier de configuration n’est requis.

```bash
docker compose up --build -d
```

Ouvrez [http://localhost:3000](http://localhost:3000) et créez le compte administrateur tout de suite. Le formulaire demande le code d’installation affiché au démarrage (`docker compose logs -f app`). L’identifiant accepte lettres, chiffres et tirets. Le mot de passe fait au moins 12 caractères.

La case **Se souvenir de moi** garde la session 30 jours ; sans elle, la session dure 8 heures. Le compte administrateur est créé avec une session de 30 jours.

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
npm run dev
```

L’interface est sur [http://localhost:5173](http://localhost:5173), l’API sur le port 3001. Au premier passage, créez le compte administrateur dans le navigateur. Le détail est dans le [guide d’installation](docs/installation.md).
