# Utiliser Preppr

Ce guide décrit l’application une fois qu’elle tourne et qu’un compte existe. L’installation est dans [installation.md](installation.md).

Tout le foyer utilise **le même identifiant**. Les recettes, la liste de courses et les réglages sont communs. Une modification sur un téléphone apparaît sur les autres appareils connectés (rafraîchissement automatique tant qu’il y a du réseau).

## Première connexion

1. Ouvrez l’adresse de Preppr.
2. Saisissez l’identifiant et le mot de passe créés à l’installation.
3. Laissez **Se souvenir de moi** coché sur un téléphone ou un ordinateur personnel (session de 30 jours). Décochez-la sur un appareil partagé (session de 8 heures).

Le menu **☰** en haut à droite contient **Paramètres** et **Déconnexion**. La déconnexion efface aussi la copie locale de cette famille sur cet appareil.

La barre du haut a trois entrées :

- **Recettes** : le plan de la semaine
- **Courses** : la liste par rayon
- l’icône d’assistant : le **générateur de menus**

## Régler l’assistant

Le générateur a besoin d’une clé d’API, propre à votre famille.

1. Ouvrez **☰ → Paramètres**.
2. Dans **Modèle d’IA**, choisissez **Google Gemini** ou **Anthropic Claude**.
3. Créez une clé chez le fournisseur (les liens sont dans la page) et collez-la. L’enregistrement est automatique.
4. Dans **Contexte utilisateur**, décrivez le foyer : nombre de personnes, allergies, matériel (four, Cookeo, etc.), façon dont l’assistant doit proposer les plats. Ces textes sont envoyés à chaque conversation.

**Réinitialiser les préférences par défaut** vide aussi les clés d’API.

**Ordre des rayons** aligne la liste de courses sur le parcours de votre magasin. Les flèches montent ou descendent un rayon. **Réinitialiser l’ordre des rayons** revient à l’ordre d’origine.

## Générer les menus

Ouvrez l’assistant (icône en haut, ou **Générer mes menus** quand le plan est vide).

Le message d’accueil demande en général :

- combien de repas vous voulez
- s’il y a un repas particulier (invités, plat déjà décidé)
- des contraintes pour cette fois (temps, reste du frigo, etc.)

Écrivez votre demande, puis **Envoyer**. Entrée envoie le message. Maj+Entrée passe à la ligne. Le trombone joint une photo (liste manuscrite, frigo, placard).

L’assistant propose des recettes. Vous en choisissez, il en propose d’autres jusqu’au nombre demandé, puis il produit un fichier de recettes. Dès que ce fichier est valide, Preppr l’importe tout seul : les plats arrivent dans **Recettes** et les ingrédients dans **Courses**. Un bandeau confirme l’import.

Le bouton de rafraîchissement à côté du titre démarre une nouvelle conversation. L’historique du chat reste sur l’appareil ; les recettes importées, elles, sont sur le serveur, partagées par la famille.

Vous pouvez aussi coller un JSON venant d’ailleurs : **Recettes → Importer depuis un JSON**. Le format est décrit dans [format-json.md](format-json.md). Un import **ajoute** des recettes. Il ne remplace pas celles déjà là.

## Recettes

La page d’accueil résume ce qui reste à cuisiner, ce qui est déjà fait, ce qui reste à acheter et ce qui est déjà coché.

Chaque carte de recette permet de :

- ouvrir la fiche (titre)
- cocher **Déjà fait**
- monter ou descendre le plat dans la liste
- **Retirer** le plat du plan

**Retirer** s’active seulement après **Déjà fait**. C’est voulu : on ne sort pas une recette du plan tant qu’elle n’est pas marquée comme cuisinée. Le retrait enlève aussi ses ingrédients de la liste de courses, sauf les articles saisis à la main.

**Supprimer toutes les recettes** (en bas de page) demande une confirmation et une connexion. Les articles ajoutés à la main dans les courses sont conservés.

### Fiche recette

- **Portions** : de 1 à 24. Les quantités des ingrédients et de la liste de courses suivent. La base de la recette ne change pas : seul le nombre de portions visé change.
- **Déjà fait** et **Retirer de la planification** : mêmes règles que sur la liste.
- Le crayon ouvre la modification (titre, lien, temps, ingrédients, étapes).
- Le lien à côté de la source ouvre la page d’origine quand une URL a été fournie.

**Ajouter une recette manuellement** (en bas de la liste) sert pour un plat maison. Une ligne par ingrédient (`2 tomates`, `200 g de pâtes`), une ligne par étape.

## Liste de courses

Les ingrédients des recettes sont regroupés par rayon, et additionnés quand le nom, l’unité et le rayon correspondent.

- Cochez un article une fois qu’il est dans le panier.
- **Retirer** une ligne n’est possible qu’après l’avoir cochée.
- **Ajouter un ingrédient** crée une ligne marquée **Manuel**. Le bouton **+** à côté d’un rayon préremplit ce rayon.
- Touchez la ligne pour modifier le nom, la quantité, l’unité ou le rayon.
- Dans un rayon, la poignée **⋮** ou les flèches changent l’ordre.
- Les articles hors recettes (papier toilette, etc.), venus de l’import, portent le badge **Hors recette**.
- **Imprimer** ouvre la boîte d’impression du navigateur.
- **Retirer les articles cochés** enlève ce qui est déjà acheté et laisse le reste.
- **Vider toute la liste** efface toutes les lignes. Les fiches recettes restent. Cette action demande une connexion. Un nouvel import pourra remplir à nouveau la liste.

Unités proposées : `g`, `kg`, `ml`, `cl`, `L`, `càs`, `càc`, `pièce`, `pincée`.

Rayons : Fruits & Légumes, Viandes & Poissons, Frais & Laitier, Épicerie Salée, Épicerie Sucrée, Boulangerie, Surgelés, Boissons, Hygiène & Beauté, Divers.

## Hors ligne

Quand le réseau manque, un badge **Hors ligne** s’affiche. La dernière copie connue de la famille reste lisible.

Sur la liste de courses (cocher, ajouter, modifier, retirer un article déjà coché) et sur les portions, les changements sont gardés sur l’appareil. Le badge **À synchroniser** indique qu’ils ne sont pas encore partis. Au retour du réseau, Preppr les envoie. Si quelqu’un d’autre a modifié les données entre-temps, les courses et les portions de votre appareil sont reprises sur la version la plus récente du serveur.

**Supprimer toutes les recettes** et **Vider toute la liste** demandent d’être en ligne, sans synchronisation en attente.

L’application installée (voir ci-dessous) améliore ce cache. En développement (`npm run dev`), ce cache d’installation n’est pas actif.

## Sur le téléphone

**Paramètres → Comment installer l’application (Android et iPhone)** détaille les gestes.

- Android, Chrome : menu **⋮**, puis **Installer l’application** ou **Ajouter à l’écran d’accueil**.
- iPhone ou iPad, Safari : **Partager**, puis **Sur l’écran d’accueil**.

Une fois installée, Preppr s’ouvre comme une application. L’installation depuis un téléphone distant fonctionne en HTTPS. En local, `http://localhost` suffit sur la machine qui héberge Preppr.
