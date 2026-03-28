import type { ShoppingLine, StoredRecipe } from "./types.js";
import { scaleIngredientQuantity } from "./quantities.js";

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeKey(aisle: string, unit: string, name: string): string {
  return `${aisle}||${unit}||${normalizeName(name)}`;
}

export function aggLineId(aisle: string, unit: string, name: string): string {
  const mk = mergeKey(aisle, unit, name);
  return `agg:${Buffer.from(mk).toString("base64url")}`;
}

function roundDisplay(quantity: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "pièce" || u === "gousse" || u === "pièces")
    return Math.max(0, Math.round(quantity));
  if (u === "càs" || u === "càc") return Math.round(quantity * 10) / 10;
  if (u === "g" || u === "ml") return Math.round(quantity / 5) * 5;
  return Math.round(quantity * 100) / 100;
}

export function rebuildShoppingLines(
  recipes: StoredRecipe[],
  targetPortions: Record<string, number>,
  previous: ShoppingLine[]
): ShoppingLine[] {
  const prevById = new Map(previous.map((l) => [l.id, l]));
  const bucket = new Map<
    string,
    { name: string; unit: string; aisle: string; quantity: number }
  >();

  for (const r of recipes) {
    if (r.removedFromPlan) continue;
    const base = r.basePortions;
    const target = targetPortions[r.recipeInstanceId] ?? base;
    const scale = base > 0 ? target / base : 1;
    for (const ing of r.ingredients) {
      const key = mergeKey(ing.aisle, ing.unit, ing.name);
      const q = scaleIngredientQuantity(ing.quantity, ing.unit, scale);
      const cur = bucket.get(key);
      if (cur) cur.quantity += q;
      else
        bucket.set(key, {
          name: ing.name,
          unit: ing.unit,
          aisle: ing.aisle,
          quantity: q,
        });
    }
  }

  const manual = previous.filter((l) => l.manual);
  const aggregated: ShoppingLine[] = [];

  for (const [, v] of bucket) {
    const id = aggLineId(v.aisle, v.unit, v.name);
    const prev = prevById.get(id);
    aggregated.push({
      id,
      name: v.name,
      quantity: roundDisplay(v.quantity, v.unit),
      unit: v.unit,
      aisle: v.aisle,
      checked: prev?.checked ?? false,
      manual: false,
    });
  }

  aggregated.sort((a, b) => {
    const aisleCmp = a.aisle.localeCompare(b.aisle, "fr");
    if (aisleCmp !== 0) return aisleCmp;
    return a.name.localeCompare(b.name, "fr");
  });
  manual.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return [...manual, ...aggregated];
}
