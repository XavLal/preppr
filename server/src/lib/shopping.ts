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

/**
 * Ajoute ou met à jour les lignes issues des recettes **nouvellement importées** dans la liste
 * existante (sans toucher aux recettes déjà présentes dans `shoppingLines`).
 */
export function mergeImportedRecipesIntoShoppingLines(
  shoppingLines: ShoppingLine[],
  newRecipes: StoredRecipe[],
  targetPortions: Record<string, number>
): ShoppingLine[] {
  const lines = shoppingLines.map((l) => ({ ...l }));
  const keyToLine = new Map<string, ShoppingLine>();
  for (const l of lines) {
    if (l.manual || l.extraIngredient) continue;
    keyToLine.set(mergeKey(l.aisle, l.unit, l.name), l);
  }

  const bucket = new Map<
    string,
    { name: string; unit: string; aisle: string; quantity: number }
  >();
  for (const r of newRecipes) {
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

  for (const [, v] of bucket) {
    const key = mergeKey(v.aisle, v.unit, v.name);
    const existing = keyToLine.get(key);
    if (existing) {
      existing.quantity = roundDisplay(existing.quantity + v.quantity, v.unit);
    } else {
      const nl: ShoppingLine = {
        id: aggLineId(v.aisle, v.unit, v.name),
        name: v.name,
        quantity: roundDisplay(v.quantity, v.unit),
        unit: v.unit,
        aisle: v.aisle,
        checked: false,
        manual: false,
      };
      lines.push(nl);
      keyToLine.set(key, nl);
    }
  }

  return lines;
}
