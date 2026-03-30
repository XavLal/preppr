import {
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
} from "@/config/userContextDefaults";
import { normalizeAisleOrder } from "@/lib/shopAisles";
import type { AppState } from "@/types";

/** État API / cache : complète les champs récents et normalise l’ordre des rayons. */
export function normalizeAppState(raw: AppState): AppState {
  const p = raw as AppState & {
    shopAisleOrder?: unknown;
    geminiApiKey?: unknown;
    familyContext?: unknown;
    tastesContext?: unknown;
    culinaryStyleContext?: unknown;
    equipmentContext?: unknown;
  };
  return {
    ...raw,
    shopAisleOrder: normalizeAisleOrder(p.shopAisleOrder),
    geminiApiKey: typeof p.geminiApiKey === "string" ? p.geminiApiKey : "",
    familyContext:
      typeof p.familyContext === "string" ? p.familyContext : DEFAULT_FAMILY_CONTEXT,
    tastesContext:
      typeof p.tastesContext === "string" ? p.tastesContext : DEFAULT_TASTES_CONTEXT,
    culinaryStyleContext:
      typeof p.culinaryStyleContext === "string"
        ? p.culinaryStyleContext
        : DEFAULT_CULINARY_STYLE_CONTEXT,
    equipmentContext:
      typeof p.equipmentContext === "string"
        ? p.equipmentContext
        : DEFAULT_EQUIPMENT_CONTEXT,
  };
}
