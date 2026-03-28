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
