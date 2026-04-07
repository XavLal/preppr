import { scaledForRecipe } from "@/lib/quantities";
import type { StoredRecipe } from "@/types";

export type StepSegment =
  | { kind: "text"; text: string }
  | { kind: "ing"; quantity: number; unit: string; name: string };

type IngredientRow = StoredRecipe["ingredients"][number];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Supprime les blocs « (…) » en fin de libellé, tant qu’il en reste (ex. facultatif). */
function stripTrailingParentheticals(name: string): string {
  let s = name.trim();
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\s*\([^)]*\)\s*$/u, "").trim();
  } while (s !== prev);
  return s;
}

/** Libellés à tester dans les étapes : nom complet + base sans parenthèses finales si différente. */
function ingredientMatchVariants(name: string): string[] {
  const full = name.trim();
  if (!full) return [];
  const stripped = stripTrailingParentheticals(full);
  if (stripped === full) return [full];
  return [full, stripped];
}

type MatchVariant = { variant: string; ing: IngredientRow };

function buildMatchVariants(ingredients: IngredientRow[]): MatchVariant[] {
  const raw: MatchVariant[] = [];
  for (const ing of ingredients) {
    for (const variant of ingredientMatchVariants(ing.name)) {
      raw.push({ variant, ing });
    }
  }
  raw.sort((a, b) => b.variant.length - a.variant.length);
  const seen = new Set<string>();
  const out: MatchVariant[] = [];
  for (const e of raw) {
    const key = e.variant.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

/**
 * Découpe une étape en segments texte / ingrédient : chaque mention d’un nom
 * d’ingrédient (mot entier, insensible à la casse) est remplacée par la
 * quantité mise à l’échelle, l’unité et le nom, pour affichage en gras.
 * Les suffixes entre parenthèses en fin de nom d’ingrédient ne sont pas exigés
 * dans le texte de l’étape (ex. « fromage râpé » matche « Fromage râpé (facultatif) »).
 */
export function parseStepIngredientSegments(
  step: string,
  ingredients: IngredientRow[],
  basePortions: number,
  targetPortions: number
): StepSegment[] {
  const usable = ingredients.filter((i) => i.name.trim().length > 0);
  if (!usable.length) {
    return [{ kind: "text", text: step }];
  }

  const matchVariants = buildMatchVariants(usable);
  const pattern = matchVariants.map((m) => escapeRegex(m.variant)).join("|");
  const re = new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])(${pattern})(?![\\p{L}\\p{M}\\p{N}])`,
    "giu"
  );

  const segments: StepSegment[] = [];
  let last = 0;
  const matches = step.matchAll(re);
  for (const m of matches) {
    const idx = m.index ?? 0;
    if (idx > last) segments.push({ kind: "text", text: step.slice(last, idx) });
    const matchedName = m[1];
    const ing = matchVariants.find(
      (x) => x.variant.toLowerCase() === matchedName.toLowerCase()
    )?.ing;
    if (!ing) {
      segments.push({ kind: "text", text: m[0] });
      last = idx + m[0].length;
      continue;
    }
    const quantity = scaledForRecipe(
      ing.quantity,
      ing.unit,
      basePortions,
      targetPortions
    );
    segments.push({
      kind: "ing",
      quantity,
      unit: ing.unit,
      name: ing.name,
    });
    last = idx + m[0].length;
  }
  if (last < step.length) {
    segments.push({ kind: "text", text: step.slice(last) });
  }
  return segments.length ? segments : [{ kind: "text", text: step }];
}
