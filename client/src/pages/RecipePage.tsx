import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import RecipeSourceLink from "@/components/RecipeSourceLink";
import { scaledForRecipe } from "@/lib/quantities";
import { useAppStore } from "@/store/useAppStore";

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const hydrate = useAppStore((s) => s.hydrate);
  const state = useAppStore((s) => s.state);
  const commit = useAppStore((s) => s.commit);

  useEffect(() => {
    if (!state) void hydrate();
  }, [hydrate, state]);

  const recipe = useMemo(
    () => state?.recipes.find((r) => r.recipeInstanceId === id),
    [state, id]
  );

  const baseTarget =
    recipe && state
      ? state.targetPortions[recipe.recipeInstanceId] ?? recipe.basePortions
      : 4;
  const [localPortions, setLocalPortions] = useState(baseTarget);

  useEffect(() => {
    setLocalPortions(baseTarget);
  }, [baseTarget, recipe?.recipeInstanceId]);

  if (!recipe) {
    return (
      <p className="muted">
        Recette introuvable. <Link to="/">Retour</Link>
      </p>
    );
  }

  const recipeId = recipe.recipeInstanceId;

  async function flushPortions() {
    const v = Math.max(1, Math.min(24, Math.round(localPortions)));
    setLocalPortions(v);
    await commit((d) => {
      d.targetPortions[recipeId] = v;
    });
  }

  async function setCooked(v: boolean) {
    await commit((dr) => {
      const row = dr.recipes.find((x) => x.recipeInstanceId === recipeId);
      if (row) row.alreadyCooked = v;
    });
  }

  async function removeFromPlan() {
    const ok = await commit((dr) => {
      const row = dr.recipes.find((x) => x.recipeInstanceId === recipeId);
      if (row && row.alreadyCooked) row.removedFromPlan = true;
    });
    if (ok) nav("/");
  }

  const target =
    state?.targetPortions[recipeId] ?? recipe.basePortions;

  return (
    <div>
      <p className="breadcrumb">
        <Link to="/">← Recettes</Link>
      </p>
      <header className="recipe-header">
        <h1>{recipe.title}</h1>
        <p className="muted">
          {recipe.source}
          <RecipeSourceLink
            key={recipe.recipeInstanceId}
            title={recipe.title}
            source={recipe.source}
            url={recipe.url}
          />
        </p>
        <p className="muted small">
          Temps de préparation : {recipe.prepTimeMinutes} min
          {recipe.cookingTimeMinutes > 0
            ? ` · Temps de cuisson : ${recipe.cookingTimeMinutes} min`
            : ""}
        </p>
        <div className="row wrap">
          <label className="field inline">
            <span>Portions</span>
            <input
              type="number"
              min={1}
              max={24}
              value={localPortions}
              onChange={(e) => setLocalPortions(Number(e.target.value))}
              onBlur={() => void flushPortions()}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={recipe.alreadyCooked}
              onChange={(e) => void setCooked(e.target.checked)}
            />
            Déjà fait
          </label>
          <button
            type="button"
            className="btn danger ghost"
            disabled={!recipe.alreadyCooked}
            onClick={() => void removeFromPlan()}
          >
            Retirer de la planification
          </button>
        </div>
      </header>

      <div className="recipe-split">
        <aside className="recipe-ingredients">
          <h2>Ingrédients</h2>
          <ul>
            {recipe.ingredients.map((ing) => (
              <li key={ing.name + ing.unit}>
                <strong>
                  {scaledForRecipe(
                    ing.quantity,
                    ing.unit,
                    recipe.basePortions,
                    target
                  )}{" "}
                  {ing.unit}
                </strong>{" "}
                {ing.name}
              </li>
            ))}
          </ul>
        </aside>
        <section className="recipe-steps">
          <h2>Étapes</h2>
          <ol>
            {recipe.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
