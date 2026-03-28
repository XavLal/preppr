import type { ShoppingLine } from "@/types";

/**
 * Déplace une ligne à la position d’une autre ligne du même rayon (ordre relatif conservé
 * pour les autres rayons dans le tableau global).
 */
export function moveLineWithinAisle(
  lines: ShoppingLine[],
  aisle: string,
  fromId: string,
  toId: string
): ShoppingLine[] {
  if (fromId === toId) return lines;
  const inAisle = lines.filter((l) => l.aisle === aisle);
  const fromIdx = inAisle.findIndex((l) => l.id === fromId);
  let toIdx = inAisle.findIndex((l) => l.id === toId);
  if (fromIdx < 0 || toIdx < 0) return lines;
  const reordered = [...inAisle];
  const [item] = reordered.splice(fromIdx, 1);
  /* Insérer à l’index `toIdx` dans le tableau *après* retrait : pas de -1 quand fromIdx < toIdx,
   * sinon « descendre » d’une case replace l’élément au même endroit. */
  reordered.splice(toIdx, 0, item);
  let ai = 0;
  return lines.map((l) => (l.aisle === aisle ? reordered[ai++]! : l));
}

export function moveLineStepInAisle(
  lines: ShoppingLine[],
  aisle: string,
  lineId: string,
  direction: -1 | 1
): ShoppingLine[] | null {
  const inAisle = lines.filter((l) => l.aisle === aisle);
  const idx = inAisle.findIndex((l) => l.id === lineId);
  const neighborIdx = idx + direction;
  if (idx < 0 || neighborIdx < 0 || neighborIdx >= inAisle.length) return null;
  return moveLineWithinAisle(
    lines,
    aisle,
    lineId,
    inAisle[neighborIdx]!.id
  );
}
