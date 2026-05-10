/**
 * Valeurs par défaut du contexte utilisateur (Paramètres / Gemini).
 * Aligné sur l’historique `prompts.js` et `server/src/lib/userPromptDefaults.ts`.
 */
export const DEFAULT_FAMILY_CONTEXT =
    "- Taille de la famille : 4 (2 adultes et 2 enfants de 7 et 10 ans)\n" +
    "- Contraintes : zéro gâchis, aliments de saison.\n";

export const DEFAULT_TASTES_CONTEXT =
    "- Préférences : plats équilibrés, adaptés aux goûts des enfants\n" +
    "- Éviter : trop épicé, trop sucré.\n" +
    "- Allergies : aucune connue\n";

export const DEFAULT_CULINARY_STYLE_CONTEXT =
    "- Style : cuisine maison\n" +
    "- Durée : < 30> minutes de préparation (sauf demande spécifique)\n" +
    "- Niveau : simple (ingrédients faciles à trouver en supermarché)\n";

export const DEFAULT_EQUIPMENT_CONTEXT =
    "Four, Plaque de cuisson, Micro-onde, Air Fryer, Friteuse, Thermomix, Cookeo, Gaufrier, Plancha, Four à pizza";

export const DEFAULT_INTERACTION_CONTEXT =
    "Traite d'abord les repas spécifiques demandés, puis les repas standards.\n" +
    "\n" +
    "**Pour chaque tour :**\n" +
    "Propose exactement 3 recettes originales et de qualité.\n" +
    "\n" +
    "Pour chaque choix, affiche :\n" +
    "- **Titre** de la recette\n" +
    "- Mini-description appétissante (1-2 lignes)\n" +
    "- Temps de préparation / cuisson\n" +
    "- Équipement utilisé\n" +
    "- Protéine principale (pour le suivi nutritionnel)\n" +
    "\n" +
    "L'utilisateur sélectionne 1, 2 ou 3 recettes parmi ces choix.\n" +
    "\n" +
    "**Équilibre dynamique :**\n" +
    "Après chaque sélection, déduis les repas validés du total.\n" +
    "S'il manque encore des repas, propose 3 nouveaux choix qui équilibrent la semaine :\n" +
    "- Si viande rouge validée → proposer poisson, volaille ou végétarien\n" +
    "- Si plat en sauce validé → proposer plat sec ou salade composée\n" +
    "- Si recette longue validée → proposer recette express ensuite\n" +
    "- Éviter de répéter deux fois la même protéine dans la même journée\n" +
    "\n" +
    "Répète jusqu'à atteindre le quota total."