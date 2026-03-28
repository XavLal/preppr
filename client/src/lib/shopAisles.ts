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

const ORDER = new Map<string, number>(SHOP_AISLES.map((a, i) => [a, i]));

/** Trie les rayons : ordre fixe pour les connus, puis les autres par locale. */
export function compareAisles(a: string, b: string): number {
  const ia = ORDER.has(a) ? ORDER.get(a)! : 1000;
  const ib = ORDER.has(b) ? ORDER.get(b)! : 1000;
  if (ia !== ib) return ia - ib;
  return a.localeCompare(b, "fr");
}

/** Si le rayon ne fait pas partie de la liste (ancienne donnée), propose « Divers ». */
export function aisleForSelect(aisle: string): string {
  return ORDER.has(aisle) ? aisle : "Divers";
}
