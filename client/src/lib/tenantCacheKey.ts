import { getAuthToken } from "@/lib/authToken";

function decodeJwtSub(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const json = atob(b64);
    const payload = JSON.parse(json) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** Clé de partitionnement du cache hors ligne (champ `sub` du JWT, non vérifié). */
export function getTenantCacheKey(): string | null {
  const t = getAuthToken();
  if (!t) return null;
  return decodeJwtSub(t);
}
