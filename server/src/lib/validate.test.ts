import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppState, ShoppingLine, StoredRecipe } from "./types.js";
import { StateValidationError, validateStateTransition } from "./validate.js";

function recipe(ingredients: StoredRecipe["ingredients"]): StoredRecipe {
  return {
    recipeInstanceId: "r1",
    sourceRecipeId: "s1",
    weekId: null,
    title: "Soupe",
    source: "Maison",
    url: null,
    basePortions: 4,
    prepTimeMinutes: 10,
    cookingTimeMinutes: 0,
    equipment: [],
    tags: [],
    isSpecialMeal: false,
    alreadyCooked: false,
    removedFromPlan: false,
    ingredients,
    steps: ["Mélanger"],
  };
}

function line(partial: Partial<ShoppingLine> & Pick<ShoppingLine, "id" | "name">): ShoppingLine {
  return {
    quantity: 1,
    unit: "pièce",
    aisle: "Divers",
    checked: false,
    manual: false,
    ...partial,
  };
}

function state(recipes: StoredRecipe[], shoppingLines: ShoppingLine[]): AppState {
  return {
    version: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
    recipes,
    shoppingLines,
    targetPortions: {},
    shopAisleOrder: [],
    geminiApiKey: "",
    claudeApiKey: "",
    activeLlm: "gemini",
    familyContext: "",
    tastesContext: "",
    culinaryStyleContext: "",
    equipmentContext: "",
    interactionContext: "",
  };
}

describe("validateStateTransition shopping lines", () => {
  it("refuses to drop an unchecked manual line", () => {
    const prev = state([], [line({ id: "m1", name: "savon", manual: true })]);
    const next = state([], []);
    assert.throws(
      () => validateStateTransition(prev, next),
      (e: unknown) => e instanceof StateValidationError && e.code === "shopping.check_before_remove"
    );
  });

  it("refuses to drop an unchecked line still produced by a recipe", () => {
    const ing = { name: "tomate", quantity: 2, unit: "pièce", aisle: "Fruits & Légumes" };
    const prev = state(
      [recipe([ing])],
      [line({ id: "agg:tomate", name: "tomate", unit: "pièce", aisle: "Fruits & Légumes" })]
    );
    const next = state([recipe([ing])], []);
    assert.throws(
      () => validateStateTransition(prev, next),
      (e: unknown) => e instanceof StateValidationError && e.code === "shopping.check_before_remove"
    );
  });

  it("allows a recipe edit to drop an unchecked line the recipe no longer needs", () => {
    const prev = state(
      [recipe([{ name: "tomate", quantity: 2, unit: "pièce", aisle: "Fruits & Légumes" }])],
      [line({ id: "agg:tomate", name: "tomate", unit: "pièce", aisle: "Fruits & Légumes" })]
    );
    const next = state(
      [recipe([{ name: "carotte", quantity: 1, unit: "pièce", aisle: "Fruits & Légumes" }])],
      [line({ id: "agg:carotte", name: "carotte", unit: "pièce", aisle: "Fruits & Légumes" })]
    );
    assert.doesNotThrow(() => validateStateTransition(prev, next));
  });
});
