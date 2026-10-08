# Importer un JSON de recettes

Preppr accepte un objet JSON collé dans **Recettes → Importer depuis un JSON**. Le générateur de menus produit ce même format et l’importe tout seul quand la réponse de l’IA est valide.

Un import **ajoute** les recettes au plan déjà présent et complète la liste de courses. Les articles saisis à la main restent.

Collez uniquement l’objet JSON, ou un bloc entouré de \`\`\`json. S’il y a du texte autour, l’import manuel depuis la page Recettes attend un JSON valide dans le champ : copiez l’objet, pas la conversation.

## Exemple minimal

```json
{
  "weekId": "2026-W15",
  "recipes": [
    {
      "id": "rec_001",
      "title": "Pâtes au thon",
      "source": "Maison",
      "url": null,
      "portions": 4,
      "prepTimeMinutes": 10,
      "cookingTimeMinutes": 12,
      "equipment": ["Casserole"],
      "tags": ["rapide"],
      "isSpecialMeal": false,
      "alreadyCooked": false,
      "ingredients": [
        { "name": "Pâtes", "quantity": 400, "unit": "g", "aisle": "Épicerie Salée" },
        { "name": "Thon au naturel", "quantity": 1, "unit": "pièce", "aisle": "Épicerie Salée" }
      ],
      "steps": [
        "Faire cuire les pâtes.",
        "Égoutter et mélanger avec le thon."
      ]
    }
  ],
  "extraIngredients": [
    { "name": "Papier toilette", "quantity": 1, "unit": "pièce", "aisle": "Hygiène & Beauté" }
  ]
}
```

`extraIngredients` est facultatif. Ces lignes arrivent dans les courses avec le badge **Hors recette**. Elles ne sont pas liées à un plat. Un tableau vide ou l’absence du champ conviennent.

## Champs

### Enveloppe

| Champ | Attendu |
| --- | --- |
| `weekId` | Texte, par exemple `2026-W15`. Sert d’étiquette sur les recettes importées. |
| `recipes` | Tableau de recettes. Peut être vide si vous n’ajoutez que des courses hors recette. |
| `extraIngredients` | Tableau d’articles hors recettes. Facultatif. |

### Recette

| Champ | Attendu |
| --- | --- |
| `id` | Identifiant texte unique dans ce fichier (`rec_001`). Preppr crée en plus son propre identifiant interne. |
| `title` | Nom affiché. |
| `source` | Origine libre, par exemple `Maison` ou le nom d’un site. |
| `url` | Lien `https://…`, ou `null` s’il n’y en a pas. |
| `portions` | Nombre de portions de la recette d’origine, supérieur à 0. |
| `prepTimeMinutes` | Minutes de préparation, 0 accepté. |
| `cookingTimeMinutes` | Minutes de cuisson, 0 accepté. |
| `equipment` | Tableau de textes. `[]` si aucun. |
| `tags` | Tableau de textes. `[]` si aucun. |
| `isSpecialMeal` | `true` affiche le badge **Spécial** sur la carte. |
| `alreadyCooked` | `true` ou `false`. |
| `ingredients` | Tableau d’ingrédients. |
| `steps` | Tableau de textes, une étape par entrée. |

### Ingrédient (recette ou hors recette)

| Champ | Attendu |
| --- | --- |
| `name` | Nom. Les lignes de courses au même nom, même unité et même rayon sont additionnées. |
| `quantity` | Nombre. |
| `unit` | Voir la liste ci-dessous. |
| `aisle` | Voir la liste ci-dessous. |

## Unités

`g`, `kg`, `ml`, `cl`, `L`, `càs`, `càc`, `pièce`, `pincée`.

## Rayons

Utilisez exactement l’un de ces libellés :

- Fruits & Légumes
- Viandes & Poissons
- Frais & Laitier
- Épicerie Salée
- Épicerie Sucrée
- Boulangerie
- Surgelés
- Boissons
- Hygiène & Beauté
- Divers

Un autre libellé reste visible en fin de liste de courses. Il n’apparaît pas dans le réglage **Ordre des rayons**.

## Erreurs fréquentes

Preppr répond **JSON invalide** si le texte n’est pas du JSON (virgule en trop, apostrophes à la place des guillemets, commentaire).

Il répond **Format de fichier invalide** si un champ obligatoire manque, si un nombre n’est pas un nombre (`portions` à 0, `quantity` écrit `"400 g"`), ou si un tableau attendu (`ingredients`, `steps`, `equipment`, `tags`) est absent. Sans lien, mettez `url` à `null`.

L’unité va dans `unit`, à part de la quantité.
