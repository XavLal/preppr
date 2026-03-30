/**
 * Même liste que le client (`client/src/lib/shopAisles.ts`) — garder les deux alignés.
 */
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

const KNOWN_AISLE_SET = new Set<string>(SHOP_AISLES as unknown as string[]);

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
