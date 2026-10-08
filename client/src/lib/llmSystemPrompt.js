import { buildLocalizedSystemPrompt } from "@/i18n/prompts/catalog";

/** Consigne système complète : directive de langue + contexte + règles JSON. */
export function buildFullLlmSystemPrompt(profile) {
  return buildLocalizedSystemPrompt(profile);
}

export function buildCustomUserContextText(profile) {
  return buildLocalizedSystemPrompt(profile);
}
