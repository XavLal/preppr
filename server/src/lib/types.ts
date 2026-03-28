export type StoredRecipe = {
  recipeInstanceId: string;
  sourceRecipeId: string;
  weekId: string | null;
  title: string;
  source: string;
  url: string | null;
  basePortions: number;
  prepTimeMinutes: number;
  equipment: string[];
  tags: string[];
  isSpecialMeal: boolean;
  alreadyCooked: boolean;
  removedFromPlan: boolean;
  ingredients: {
    name: string;
    quantity: number;
    unit: string;
    aisle: string;
  }[];
  steps: string[];
};

export type ShoppingLine = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  aisle: string;
  checked: boolean;
  manual: boolean;
  /** Ligne issue de `extraIngredients` dans le JSON d’import */
  extraIngredient?: boolean;
};

export type AppState = {
  version: number;
  updatedAt: string;
  recipes: StoredRecipe[];
  shoppingLines: ShoppingLine[];
  /** target portions per recipeInstanceId; default = basePortions from recipe */
  targetPortions: Record<string, number>;
};
