import {
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
  DEFAULT_INTERACTION_CONTEXT,
} from "@/config/userContextDefaults";
import type { AppState } from "@/types";

function importFlagKey(tenantKey: string): string {
  return `preppr_${tenantKey}_prompt_ls_import_v1`;
}

/**
 * Import unique depuis l’ancien localStorage (clé + contexte) lorsque le serveur n’a pas encore de clé.
 */
export function mergeLegacyLocalStoragePrompts(
  tenantKey: string,
  parsed: AppState
): { state: AppState; migrated: boolean } {
  if (typeof localStorage === "undefined") {
    return { state: parsed, migrated: false };
  }
  const flagKey = importFlagKey(tenantKey);
  if (localStorage.getItem(flagKey)) {
    return { state: parsed, migrated: false };
  }

  const prefix = `preppr_${tenantKey}_`;
  const lsApiKey = localStorage.getItem(`${prefix}gemini_api_key`);
  const ctxRaw = localStorage.getItem(`${prefix}custom_user_context`);

  if (!lsApiKey?.trim() && !ctxRaw) {
    return { state: parsed, migrated: false };
  }

  const serverHasKey = Boolean(parsed.geminiApiKey?.trim());
  if (serverHasKey) {
    localStorage.setItem(flagKey, "1");
    return { state: parsed, migrated: false };
  }

  let familyContext = DEFAULT_FAMILY_CONTEXT;
  let tastesContext = DEFAULT_TASTES_CONTEXT;
  let culinaryStyleContext = DEFAULT_CULINARY_STYLE_CONTEXT;
  let equipmentContext = DEFAULT_EQUIPMENT_CONTEXT;
  let interactionContext = DEFAULT_INTERACTION_CONTEXT;

  if (ctxRaw) {
    try {
      const obj = JSON.parse(ctxRaw) as Record<string, unknown>;
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        if (typeof obj.familyContext === "string") familyContext = obj.familyContext;
        if (typeof obj.tastesContext === "string") tastesContext = obj.tastesContext;
        if (typeof obj.culinaryStyleContext === "string") {
          culinaryStyleContext = obj.culinaryStyleContext;
        }
        if (typeof obj.equipmentContext === "string") equipmentContext = obj.equipmentContext;
        if (typeof obj.interactionContext === "string") {
          interactionContext = obj.interactionContext;
        }
      } else {
        familyContext = String(ctxRaw);
        tastesContext = "";
        culinaryStyleContext = DEFAULT_CULINARY_STYLE_CONTEXT;
        equipmentContext = DEFAULT_EQUIPMENT_CONTEXT;
        interactionContext = DEFAULT_INTERACTION_CONTEXT;
      }
    } catch {
      familyContext = String(ctxRaw);
      tastesContext = "";
      culinaryStyleContext = DEFAULT_CULINARY_STYLE_CONTEXT;
      equipmentContext = DEFAULT_EQUIPMENT_CONTEXT;
      interactionContext = DEFAULT_INTERACTION_CONTEXT;
    }
  }

  return {
    state: {
      ...parsed,
      geminiApiKey: lsApiKey?.trim() ?? "",
      familyContext,
      tastesContext,
      culinaryStyleContext,
      equipmentContext,
      interactionContext,
    },
    migrated: true,
  };
}

export function markLegacyPromptImportDone(tenantKey: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(importFlagKey(tenantKey), "1");
}
