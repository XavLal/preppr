/** Rayons autorisés pour les articles manuels (alignés sur les imports JSON). */
export const SHOP_AISLES = [
  "Fruits & Légumes",
  "Viandes & Poissons",
  "Frais & Laitier",
  "Épicerie Salée",
  "Épicerie Sucrée",
  "Boulangerie",
  "Surgelés",
  "Boissons",
  "Hygiène & Beauté",
  "Divers",
] as const;

export type ShopAisle = (typeof SHOP_AISLES)[number];

const KNOWN_AISLE_SET = new Set<string>(SHOP_AISLES as unknown as string[]);

const DEFAULT_ORDER_MAP = new Map<string, number>(
  SHOP_AISLES.map((a, i) => [a, i])
);

/** Complète et filtre une liste persistante : tous les rayons connus, sans doublon. */
export function normalizeAisleOrder(saved: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(saved)) {
    for (const x of saved) {
      if (typeof x !== "string" || !KNOWN_AISLE_SET.has(x) || seen.has(x)) continue;
      seen.add(x);
      out.push(x);
    }
  }
  for (const a of SHOP_AISLES) {
    if (!seen.has(a)) out.push(a);
  }
  return out;
}

export function aisleOrderToMap(order: readonly string[]): Map<string, number> {
  const normalized = normalizeAisleOrder(order);
  return new Map(normalized.map((a, i) => [a, i]));
}

/**
 * Trie les rayons selon `orderMap` (indices basse = premier dans le magasin).
 * Rayons inconnus : rang 1000 puis locale fr.
 */
export function compareAisles(
  a: string,
  b: string,
  orderMap: Map<string, number> = DEFAULT_ORDER_MAP
): number {
  const ia = orderMap.has(a) ? orderMap.get(a)! : 1000;
  const ib = orderMap.has(b) ? orderMap.get(b)! : 1000;
  if (ia !== ib) return ia - ib;
  return a.localeCompare(b, "fr");
}

/** Si le rayon ne fait pas partie de la liste (ancienne donnée), propose « Divers ». */
export function aisleForSelect(aisle: string): string {
  return KNOWN_AISLE_SET.has(aisle) ? aisle : "Divers";
}
