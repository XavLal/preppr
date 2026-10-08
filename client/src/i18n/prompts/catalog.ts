import enRules from "@/config/fixed_json_rules.en.md?raw";
import frRules from "@/config/fixed_json_rules.md?raw";
import {
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_INTERACTION_CONTEXT,
  DEFAULT_ROLE_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
} from "@/config/userContextDefaults";
import { currentLocale, type AppLocale } from "@/i18n";

/**
 * Textes semés par `server/src/lib/userPromptDefaults.ts` à la création d’un compte.
 * S’ils n’ont pas été modifiés, le prompt envoyé utilise le catalogue de la langue de l’appareil.
 */
const SERVER_FAMILY =
  "- Taille de la famille : 4\n- Contraintes : zéro gâchis, aliments de saison.\n";
const SERVER_TASTES =
  "- Préférences : plats équilibrés\n- Éviter : trop épicé, trop sucré.\n- Allergies : aucune connue\n";
const SERVER_STYLE =
  "- Style : cuisine maison\n- Durée : 30-45 minutes\n- Niveau : simple (ingrédients faciles)\n";
const SERVER_EQUIPMENT =
  "- Four\n- Plaque de cuisson\n- Poêle\n- Mixeur (optionnel)\n";
const SERVER_INTERACTION =
  "- Ton : bienveillant, concret, sans jargon.\n- Format : réponses courtes, étapes numérotées si nécessaire.\n- Préférence : proposer toujours 2 à 3 options quand il y a un choix important.\n";

const EN_ROLE =
  "- You are an expert family-meal chef and a JSON data generator.\n" +
  "- You invent original, high-quality recipes that fit the family's criteria.\n" +
  "- You never invent URLs. You only generate search URLs or null.\n";

const EN_FAMILY =
  "- Family size: 4 (2 adults and 2 children aged 7 and 10)\n" +
  "- Constraints: zero waste, seasonal food.\n";

const EN_TASTES =
  "- Preferences: balanced meals, suited to children's tastes\n" +
  "- Avoid: too spicy, too sweet.\n" +
  "- Allergies: none known\n";

const EN_STYLE =
  "- Style: home cooking\n" +
  "- Duration: under 30 minutes of prep (unless specifically requested)\n" +
  "- Level: simple (ingredients easy to find in a supermarket)\n";

const EN_EQUIPMENT =
  "Oven, Hob, Microwave, Air fryer, Deep fryer, Thermomix, Cookeo, Waffle maker, Plancha, Pizza oven";

const EN_INTERACTION =
  "Handle the specifically requested meals first, then the standard meals.\n" +
  "\n" +
  "**Each turn:**\n" +
  "Offer exactly 3 original, high-quality recipes.\n" +
  "\n" +
  "For each choice, show:\n" +
  "- Recipe **title**\n" +
  "- A short appetizing description (1-2 lines)\n" +
  "- Prep / cook time\n" +
  "- Equipment used\n" +
  "- Main protein (for nutrition tracking)\n" +
  "\n" +
  "The user picks 1, 2, or 3 recipes from these choices.\n" +
  "\n" +
  "**Dynamic balance:**\n" +
  "After each selection, subtract the confirmed meals from the total.\n" +
  "If meals are still missing, offer 3 new choices that balance the week:\n" +
  "- If red meat was confirmed → offer fish, poultry, or vegetarian\n" +
  "- If a saucy dish was confirmed → offer a dry dish or a composed salad\n" +
  "- If a long recipe was confirmed → offer a quick recipe next\n" +
  "- Avoid repeating the same protein twice in the same day\n" +
  "\n" +
  "Repeat until the total quota is reached.";

export type PromptField =
  | "role"
  | "family"
  | "tastes"
  | "culinaryStyle"
  | "equipment"
  | "interaction";

type PromptDefaults = Record<PromptField, string>;

const FR_DEFAULTS: PromptDefaults = {
  role: DEFAULT_ROLE_CONTEXT,
  family: DEFAULT_FAMILY_CONTEXT,
  tastes: DEFAULT_TASTES_CONTEXT,
  culinaryStyle: DEFAULT_CULINARY_STYLE_CONTEXT,
  equipment: DEFAULT_EQUIPMENT_CONTEXT,
  interaction: DEFAULT_INTERACTION_CONTEXT,
};

const EN_DEFAULTS: PromptDefaults = {
  role: EN_ROLE,
  family: EN_FAMILY,
  tastes: EN_TASTES,
  culinaryStyle: EN_STYLE,
  equipment: EN_EQUIPMENT,
  interaction: EN_INTERACTION,
};

const KNOWN: Record<PromptField, string[]> = {
  role: [FR_DEFAULTS.role, EN_DEFAULTS.role],
  family: [FR_DEFAULTS.family, SERVER_FAMILY, EN_DEFAULTS.family],
  tastes: [FR_DEFAULTS.tastes, SERVER_TASTES, EN_DEFAULTS.tastes],
  culinaryStyle: [FR_DEFAULTS.culinaryStyle, SERVER_STYLE, EN_DEFAULTS.culinaryStyle],
  equipment: [FR_DEFAULTS.equipment, SERVER_EQUIPMENT, EN_DEFAULTS.equipment],
  interaction: [FR_DEFAULTS.interaction, SERVER_INTERACTION, EN_DEFAULTS.interaction],
};

const FR_DIRECTIVE =
  "Réponds à l’utilisateur en français. Les titres, les étapes et les noms d’ingrédients du JSON sont en français. Les valeurs de aisle restent exactement les libellés canoniques listés plus bas.";

const EN_DIRECTIVE =
  "Reply to the user in English. Recipe titles, steps, and ingredient names in the JSON must be in English. The aisle values must stay exactly the canonical French labels listed below.";

const FR_LABELS = {
  role: "Rôle :",
  family: "Famille (taille / contraintes) :",
  tastes: "Goûts (préférences / allergies) :",
  culinaryStyle: "Style culinaire :",
  equipment: "Équipements disponibles :",
  interaction: "Interaction avec l’IA :",
  step1Title: "## ÉTAPE 1 : Collecte du besoin",
  step1Body:
    "L'utilisateur va t'indiquer combien de repas il souhaite et s'il y a des repas spécifiques à prévoir.",
  step2Title: "## ÉTAPE 2 : Interraction souhaitée",
};

const EN_LABELS = {
  role: "Role:",
  family: "Family (size / constraints):",
  tastes: "Tastes (preferences / allergies):",
  culinaryStyle: "Cooking style:",
  equipment: "Available equipment:",
  interaction: "Interaction with the AI:",
  step1Title: "## STEP 1: Gather the request",
  step1Body:
    "The user will tell you how many meals they want and whether any meals are already decided.",
  step2Title: "## STEP 2: Preferred interaction",
};

export function promptDefaults(locale: AppLocale = currentLocale()): PromptDefaults {
  return locale === "en" ? EN_DEFAULTS : FR_DEFAULTS;
}

export function resolvePromptField(
  field: PromptField,
  stored: string | undefined,
  locale: AppLocale = currentLocale()
): string {
  const localized = promptDefaults(locale)[field].trim();
  const value = (stored ?? "").trim();
  if (!value) return localized;
  if (KNOWN[field].some((known) => known.trim() === value)) return localized;
  return value;
}

export type PromptProfile = {
  roleContext?: string;
  familyContext?: string;
  tastesContext?: string;
  culinaryStyleContext?: string;
  equipmentContext?: string;
  interactionContext?: string;
};

export function buildLocalizedSystemPrompt(
  profile: PromptProfile | undefined,
  locale: AppLocale = currentLocale()
): string {
  const labels = locale === "en" ? EN_LABELS : FR_LABELS;
  const directive = locale === "en" ? EN_DIRECTIVE : FR_DIRECTIVE;
  const rules = locale === "en" ? enRules : frRules;
  const role = resolvePromptField("role", profile?.roleContext, locale);
  const family = resolvePromptField("family", profile?.familyContext, locale);
  const tastes = resolvePromptField("tastes", profile?.tastesContext, locale);
  const culinaryStyle = resolvePromptField(
    "culinaryStyle",
    profile?.culinaryStyleContext,
    locale
  );
  const equipment = resolvePromptField("equipment", profile?.equipmentContext, locale);
  const interaction = resolvePromptField(
    "interaction",
    profile?.interactionContext,
    locale
  );

  return [
    directive,
    "",
    labels.role,
    role,
    "",
    labels.family,
    family,
    "",
    labels.tastes,
    tastes,
    "",
    labels.culinaryStyle,
    culinaryStyle,
    "",
    labels.equipment,
    equipment,
    "",
    labels.interaction,
    labels.step1Title,
    labels.step1Body,
    "",
    labels.step2Title,
    interaction,
    "",
    rules,
  ].join("\n");
}
