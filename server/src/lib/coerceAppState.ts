import { normalizeAisleOrder } from "./shopAisles.js";
import type { AppState } from "./types.js";
import {
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
} from "./userPromptDefaults.js";

/** Complète les champs ajoutés après coup et normalise `shopAisleOrder`. */
export function coerceAppState(raw: AppState): AppState {
  const partial = raw as AppState & {
    shopAisleOrder?: unknown;
    geminiApiKey?: unknown;
    familyContext?: unknown;
    tastesContext?: unknown;
    culinaryStyleContext?: unknown;
    equipmentContext?: unknown;
  };
  return {
    ...raw,
    shopAisleOrder: normalizeAisleOrder(partial.shopAisleOrder),
    geminiApiKey: typeof partial.geminiApiKey === "string" ? partial.geminiApiKey : "",
    familyContext:
      typeof partial.familyContext === "string"
        ? partial.familyContext
        : DEFAULT_FAMILY_CONTEXT,
    tastesContext:
      typeof partial.tastesContext === "string"
        ? partial.tastesContext
        : DEFAULT_TASTES_CONTEXT,
    culinaryStyleContext:
      typeof partial.culinaryStyleContext === "string"
        ? partial.culinaryStyleContext
        : DEFAULT_CULINARY_STYLE_CONTEXT,
    equipmentContext:
      typeof partial.equipmentContext === "string"
        ? partial.equipmentContext
        : DEFAULT_EQUIPMENT_CONTEXT,
  };
}
