const QUALITATIVE_UNITS = new Set(["pincée", "au goût", "qs", "quelques"]);

export function scaleIngredientQuantity(
  quantity: number,
  unit: string,
  scale: number
): number {
  const u = unit.toLowerCase();
  if (QUALITATIVE_UNITS.has(u)) return quantity;
  return quantity * scale;
}

export function roundDisplay(quantity: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "pièce" || u === "gousse" || u === "pièces")
    return Math.max(0, Math.round(quantity));
  if (u === "càs" || u === "càc") return Math.round(quantity * 10) / 10;
  if (u === "g" || u === "ml") return Math.round(quantity / 5) * 5;
  return Math.round(quantity * 100) / 100;
}

export function scaledForRecipe(
  quantity: number,
  unit: string,
  basePortions: number,
  targetPortions: number
): number {
  const scale = basePortions > 0 ? targetPortions / basePortions : 1;
  const s = scaleIngredientQuantity(quantity, unit, scale);
  return roundDisplay(s, unit);
}
