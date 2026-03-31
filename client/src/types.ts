export type StoredRecipe = {
  recipeInstanceId: string;
  sourceRecipeId: string;
  weekId: string | null;
  title: string;
  source: string;
  url: string | null;
  basePortions: number;
  prepTimeMinutes: number;
  cookingTimeMinutes: number;
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
  targetPortions: Record<string, number>;
  /** Ordre des rayons (liste de courses), synchronisé avec le serveur pour la famille */
  shopAisleOrder: string[];
  geminiApiKey: string;
  familyContext: string;
  tastesContext: string;
  culinaryStyleContext: string;
  equipmentContext: string;
  interactionContext: string;
};
