import { z } from "zod";

export const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  aisle: z.string(),
});

export const importRecipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  url: z.string().nullable(),
  portions: z.number().positive(),
  prepTimeMinutes: z.number().nonnegative(),
  equipment: z.array(z.string()),
  tags: z.array(z.string()),
  isSpecialMeal: z.boolean(),
  alreadyCooked: z.boolean(),
  ingredients: z.array(ingredientSchema),
  steps: z.array(z.string()),
});

export const importPayloadSchema = z.object({
  weekId: z.string(),
  recipes: z.array(importRecipeSchema),
});

export type ImportPayload = z.infer<typeof importPayloadSchema>;
