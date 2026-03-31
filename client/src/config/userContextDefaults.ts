/**
 * Valeurs par défaut du contexte utilisateur (Paramètres / Gemini).
 * Aligné sur l’historique `prompts.js` et `server/src/lib/userPromptDefaults.ts`.
 */
export const DEFAULT_FAMILY_CONTEXT =
  "- Taille de la famille : 4\n- Contraintes : zéro gâchis, aliments de saison.\n";

export const DEFAULT_TASTES_CONTEXT =
  "- Préférences : plats équilibrés\n- Éviter : trop épicé, trop sucré.\n- Allergies : aucune connue\n";

export const DEFAULT_CULINARY_STYLE_CONTEXT =
  "- Style : cuisine maison\n- Durée : 30-45 minutes\n- Niveau : simple (ingrédients faciles)\n";

export const DEFAULT_EQUIPMENT_CONTEXT =
  "- Four\n- Plaque de cuisson\n- Poêle\n- Mixeur (optionnel)\n";

export const DEFAULT_INTERACTION_CONTEXT =
  "Traite toujours les repas spécifiques en premier, puis passe aux repas standards.\nPour chaque 'tour' de proposition :\n    - Propose exactement 3 choix de repas.\n    - Lorsque tu proposes tes 3 choix de repas, tu DOIS parser les sites indiqués ou utiliser l'outil de recherche Google pour trouver des recettes existantes sur les sites demandés. Affiche le lien source dès la proposition pour que l'utilisateur puisse cliquer dessus avant même de générer le JSON.\n\nPour chaque choix donne : Titre, mini-description, temps de préparation, équipement, source.\n\nL'utilisateur sélectionne 1, 2 ou 3 recettes parmi ces choix.\n\nÉquilibre dynamique : Déduis le nombre sélectionné du total attendu. S'il manque encore des repas, propose 3 nouveaux choix qui s'équilibrent nutritionnellement avec ce qui a déjà été choisi (ex: si l'utilisateur a pris de la viande rouge, propose ensuite du poisson, de la volaille ou du végétarien).\nRépète cette boucle jusqu'à ce que le nombre total de repas demandé soit atteint.\n";
