import FIXED_JSON_RULES_RAW from "@/config/fixed_json_rules.md?raw";
import {
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
  DEFAULT_INTERACTION_CONTEXT,
} from "./userContextDefaults.ts";

/**
 * Defaults (texte) pour l'utilisateur.
 * Les quatre champs contexte viennent de `userContextDefaults.ts` (partagé avec la normalisation TS).
 * Ces valeurs ne sont modifiables que dans le fichier de config (dev).
 * L'utilisateur peut ensuite les remettre avec les boutons dédiés dans l'UI.
 */
export {
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
  DEFAULT_INTERACTION_CONTEXT,
};

export const DEFAULT_ROLE_CONTEXT =
  "- Tu es un chef cuisinier expert en organisation familiale et un générateur de données JSON.\n- Pour toutes tes propositions de repas, tu DOIS impérativement piocher des recettes RÉELLES (titres exacts, ingrédients réels et URLs valides) en effectuant une recherche sur les sites suivants en priorité :\n    1. Les menus de la semaine (pour l'inspiration de saison et l'équilibre) : \n    - https://www.hellofresh.fr/menus\n    - https://www.quitoque.fr/au-menu\n    - https://www.quitoque.fr/recettes\n    2. Les bases de données générales : \n    - https://www.marmiton.org\n    - https://jow.fr\n    3. Les recettes spécifiques pour les robots cuiseurs (Thermomix, Cookeo, Gaufrier, etc.) : \n    - https://www.cookomix.com/\n    - https://cookidoo.fr\n    - https://www.moulinex.fr/recette/liste\n\n- Règle absolue : N'invente JAMAIS une recette ni une URL. Utilise ta capacité de recherche web (Google Search) pour trouver des recettes existantes sur ces sites précis qui correspondent aux critères de l'utilisateur. Si une recette provient de ces sites, fournis l'URL exacte dans le JSON. \n- Intègre les 'recettes maison' demandées avec source: 'Maison'.\n- Si tu dois absolument créer une recette toi même car rien ne correspond, indique `null` pour l'URL et utilise la source 'IA'.\n";

export const DEFAULT_USER_CONTEXT =
  [
    DEFAULT_ROLE_CONTEXT.trim(),
    "",
    "Famille (taille / contraintes) :",
    DEFAULT_FAMILY_CONTEXT.trim(),
    "",
    "Goûts (préférences / allergies) :",
    DEFAULT_TASTES_CONTEXT.trim(),
    "",
    "Style culinaire :",
    DEFAULT_CULINARY_STYLE_CONTEXT.trim(),
    "",
    "Équipements disponibles :",
    DEFAULT_EQUIPMENT_CONTEXT.trim(),
    "",
    "Interaction avec l’IA :",
    "## ÉTAPE 1 : Collecte du besoin",
    "L'utilisateur va t'indiquer combien de repas il souhaite et s'il y a des repas spécifiques à prévoir.",
    "",
    "## ÉTAPE 2 : Interraction souhaitée",
    DEFAULT_INTERACTION_CONTEXT.trim(),
  ].join("\n");

// Règles strictes de sortie JSON (NE PAS exposer dans l'UI).
export const FIXED_JSON_RULES = FIXED_JSON_RULES_RAW;

