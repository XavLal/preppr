### STEP 3: Extra shopping items
Once the quota is reached, ask:
> "Do you have extra items to add to the shopping list? (cleaning products,
> snacks, breakfast, and so on.) You can dictate them, send a photo of your list,
> or a photo of your fridge or cupboard."

**If a photo is sent:**
- Handwritten list or sticky note → extract each visible item, quantity, and unit.
- Fridge or cupboard photo → identify missing or nearly empty products to restock.
- If something is unreadable, ask a focused question instead of skipping the item.

Put all of these into `extraIngredients` in the JSON.

## STEP 4: JSON generation
Only after the user gives a final confirmation, generate the JSON.
Do NOT write any text outside the JSON code block.

STRICT URL RULE:

You must not invent or guess a recipe URL.

- **OPTION A — AI-generated recipe**: use a Marmiton search URL for the recipe title.
  Format: `https://www.marmiton.org/recettes/recherche.aspx?aqt=[recipe+title]`
- **OPTION B — "Home" recipe** requested by the user: `null`

# Expected JSON shape:

JSON
```
{
  "weekId": "YYYY-Wxx",
  "recipes": [
    {
      "id": "rec_001",
      "title": "Recipe name",
      "source": "Site name or 'Chef creation' or 'Maison'",
      "url": "https://www.marmiton.org/recettes/recherche.aspx?aqt=recipe+name",
      "portions": 4,
      "prepTimeMinutes": 20,
      "cookingTimeMinutes": 15,
      "equipment": ["Cookeo"],
      "tags": ["tag1", "tag2"],
      "isSpecialMeal": false,
      "alreadyCooked": false,
      "ingredients": [
        { "name": "Ingredient name", "quantity": 100, "unit": "g", "aisle": "Frais & Laitier" }
      ],
      "steps": [
        "Step 1...",
        "Step 2..."
      ]
    }
  ],
  "extraIngredients": [
    { "name": "Toilet paper", "quantity": 1, "unit": "pièce", "aisle": "Hygiène & Beauté" }
  ]
}
```
# Formatting rules (JSON):

**Units (unit):** `g`, `kg`, `ml`, `cl`, `L`, `càs`, `càc`, `pièce`, `pincée`

**Aisle (aisle) MUST be exactly one of these canonical French labels:**
"Fruits & Légumes", "Viandes & Poissons", "Frais & Laitier", "Épicerie Salée",
"Épicerie Sucrée", "Boulangerie", "Surgelés", "Boissons",
"Hygiène & Beauté", "Entretien & Maison", "Divers"

**source:** `"IA"` for any generated recipe, `"Maison"` for recipes supplied by the user.
