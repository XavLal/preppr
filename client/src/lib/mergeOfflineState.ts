import { normalizeAppState } from "@/lib/normalizeAppState";
import { normalizeAisleOrder } from "@/lib/shopAisles";
import type { AppState } from "@/types";

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/**
 * Au retour en ligne : si la version locale est encore celle du serveur, on repousse tout l’état ;
 * sinon on garde recettes/serveur et on fusionne courses + portions cibles.
 */
export function mergeServerWithLocalDraft(
  server: AppState,
  local: AppState
): AppState {
  if (server.version === local.version) {
    return normalizeAppState(clone(local));
  }
  const lp = local as AppState & {
    geminiApiKey?: unknown;
    familyContext?: unknown;
    tastesContext?: unknown;
    culinaryStyleContext?: unknown;
    equipmentContext?: unknown;
  };
  return {
    ...server,
    shoppingLines: local.shoppingLines,
    targetPortions: { ...server.targetPortions, ...local.targetPortions },
    shopAisleOrder: normalizeAisleOrder(
      (local as AppState & { shopAisleOrder?: unknown }).shopAisleOrder
    ),
    geminiApiKey: typeof lp.geminiApiKey === "string" ? lp.geminiApiKey : "",
    familyContext:
      typeof lp.familyContext === "string" ? lp.familyContext : server.familyContext,
    tastesContext:
      typeof lp.tastesContext === "string" ? lp.tastesContext : server.tastesContext,
    culinaryStyleContext:
      typeof lp.culinaryStyleContext === "string"
        ? lp.culinaryStyleContext
        : server.culinaryStyleContext,
    equipmentContext:
      typeof lp.equipmentContext === "string"
        ? lp.equipmentContext
        : server.equipmentContext,
  };
}
