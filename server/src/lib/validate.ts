import { recipeDerivedLineKeys, shoppingLineKey } from "./shopping.js";
import type { AppState } from "./types.js";

export class StateValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "StateValidationError";
    this.code = code;
  }
}

export function validateStateTransition(
  prev: AppState,
  next: AppState
): void {
  const prevShop = new Map(prev.shoppingLines.map((l) => [l.id, l]));
  const nextShop = new Map(next.shoppingLines.map((l) => [l.id, l]));
  const stillFromRecipes = recipeDerivedLineKeys(next.recipes);

  for (const [id, line] of prevShop) {
    if (nextShop.has(id) || line.checked) continue;
    const derived = !line.manual && !line.extraIngredient;
    const droppedByRecipeEdit =
      derived &&
      !stillFromRecipes.has(shoppingLineKey(line.aisle, line.unit, line.name));
    if (droppedByRecipeEdit) continue;
    throw new StateValidationError(
      "shopping.check_before_remove",
      "Cochez l’article avant de le retirer de la liste de courses."
    );
  }

  const prevRecipes = new Map(prev.recipes.map((r) => [r.recipeInstanceId, r]));
  for (const r of next.recipes) {
    const was = prevRecipes.get(r.recipeInstanceId);
    if (was && !was.removedFromPlan && r.removedFromPlan && !r.alreadyCooked) {
      throw new StateValidationError(
        "recipe.mark_cooked_before_remove",
        "Marquez la recette comme faite avant de la retirer de la planification."
      );
    }
  }

  for (const [id, was] of prevRecipes) {
    const now = next.recipes.find((x) => x.recipeInstanceId === id);
    if (now && !was.removedFromPlan && now.removedFromPlan && !now.alreadyCooked) {
      throw new StateValidationError(
        "recipe.mark_cooked_before_remove",
        "Marquez la recette comme faite avant de la retirer de la planification."
      );
    }
  }
}

export function validateRecipesRemoved(
  prev: AppState,
  next: AppState
): void {
  const nextIds = new Set(next.recipes.map((r) => r.recipeInstanceId));
  for (const was of prev.recipes) {
    if (was.removedFromPlan) continue;
    if (!nextIds.has(was.recipeInstanceId)) {
      if (!was.alreadyCooked) {
        throw new StateValidationError(
          "recipe.mark_cooked_before_remove",
          "Marquez la recette comme faite avant de la retirer de la planification."
        );
      }
    }
  }
}
