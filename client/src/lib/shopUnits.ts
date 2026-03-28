export const SHOP_UNITS = [
  "g",
  "kg",
  "ml",
  "cl",
  "L",
  "càs",
  "càc",
  "pièce",
  "pincée",
] as const;

const ALLOWED = new Set<string>(SHOP_UNITS);

const UNIT_ALIASES: Record<string, string> = {
  pièces: "pièce",
  gousse: "pièce",
  gousses: "pièce",
};

/** Ramène l’unité existante vers une valeur du select, sinon « pièce ». */
export function unitForSelect(unit: string): string {
  const u = unit.trim();
  if (ALLOWED.has(u)) return u;
  const mapped = UNIT_ALIASES[u.toLowerCase()];
  if (mapped && ALLOWED.has(mapped)) return mapped;
  const lower = u.toLowerCase();
  for (const cand of SHOP_UNITS) {
    if (cand.toLowerCase() === lower) return cand;
  }
  return "pièce";
}
