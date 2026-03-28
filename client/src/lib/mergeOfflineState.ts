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
    return clone(local);
  }
  return {
    ...server,
    shoppingLines: local.shoppingLines,
    targetPortions: { ...server.targetPortions, ...local.targetPortions },
  };
}
