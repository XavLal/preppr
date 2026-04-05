import {
  DEFAULT_ROLE_CONTEXT,
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
  DEFAULT_INTERACTION_CONTEXT,
  FIXED_JSON_RULES,
} from "@/config/prompts.js";

export function buildCustomUserContextText(profile) {
  const role =
    typeof profile?.roleContext === "string"
      ? profile.roleContext
      : DEFAULT_ROLE_CONTEXT;
  const family =
    typeof profile?.familyContext === "string"
      ? profile.familyContext
      : DEFAULT_FAMILY_CONTEXT;
  const tastes =
    typeof profile?.tastesContext === "string"
      ? profile.tastesContext
      : DEFAULT_TASTES_CONTEXT;
  const culinaryStyle =
    typeof profile?.culinaryStyleContext === "string"
      ? profile.culinaryStyleContext
      : DEFAULT_CULINARY_STYLE_CONTEXT;
  const equipment =
    typeof profile?.equipmentContext === "string"
      ? profile.equipmentContext
      : DEFAULT_EQUIPMENT_CONTEXT;
  const interraction =
    typeof profile?.interactionContext === "string"
      ? profile.interactionContext
      : DEFAULT_INTERACTION_CONTEXT;

  return [
    "Rôle :",
    role.trim(),
    "",
    "Famille (taille / contraintes) :",
    family.trim(),
    "",
    "Goûts (préférences / allergies) :",
    tastes.trim(),
    "",
    "Style culinaire :",
    culinaryStyle.trim(),
    "",
    "Équipements disponibles :",
    equipment.trim(),
    "",
    "Interaction avec l’IA :",
    "## ÉTAPE 1 : Collecte du besoin",
    "L'utilisateur va t'indiquer combien de repas il souhaite et s'il y a des repas spécifiques à prévoir.",
    "",
    "## ÉTAPE 2 : Interraction souhaitée",
    interraction.trim(),
  ].join("\n");
}

/** Consigne système complète : contexte utilisateur + règles JSON (Gemini / Claude). */
export function buildFullLlmSystemPrompt(profile) {
  return buildCustomUserContextText(profile) + "\n\n" + FIXED_JSON_RULES;
}
