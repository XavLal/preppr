import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import RecipeSourceLink from "@/components/RecipeSourceLink";
import {
  roundDisplay,
  scaleIngredientQuantity,
  scaledForRecipe,
} from "@/lib/quantities";
import { useAppStore } from "@/store/useAppStore";

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const hydrate = useAppStore((s) => s.hydrate);
  const state = useAppStore((s) => s.state);
  const commit = useAppStore((s) => s.commit);

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editPortions, setEditPortions] = useState("4");
  const [editPrepTime, setEditPrepTime] = useState("20");
  const [editCookingTime, setEditCookingTime] = useState("0");
  const [editIngredients, setEditIngredients] = useState("");
  const [editSteps, setEditSteps] = useState("");

  useEffect(() => {
    if (!state) void hydrate();
  }, [hydrate, state]);

  const recipe = useMemo(
    () => state?.recipes.find((r) => r.recipeInstanceId === id),
    [state, id]
  );

  function normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function base64UrlEncodeUtf8(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const base64 = btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function aggLineId(aisle: string, unit: string, name: string): string {
    const mk = `${aisle}||${unit}||${normalizeName(name)}`;
    return `agg:${base64UrlEncodeUtf8(mk)}`;
  }

  const baseTarget =
    recipe && state
      ? state.targetPortions[recipe.recipeInstanceId] ?? recipe.basePortions
      : 4;
  const [localPortions, setLocalPortions] = useState(baseTarget);
  const flushPortionsTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null
  );

  useEffect(() => {
    setLocalPortions(baseTarget);
  }, [baseTarget, recipe?.recipeInstanceId]);

  useEffect(() => {
    return () => {
      if (flushPortionsTimerRef.current) {
        window.clearTimeout(flushPortionsTimerRef.current);
      }
    };
  }, []);

  if (!recipe) {
    return (
      <p className="muted">
        Recette introuvable. <Link to="/">Retour</Link>
      </p>
    );
  }

  const recipeId = recipe.recipeInstanceId;

  async function flushPortions(rawValue?: number) {
    const base = rawValue ?? localPortions;
    const v = Math.max(1, Math.min(24, Math.round(base)));
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

  function resetEditForm() {
    setEditTitle("");
    setEditUrl("");
    setEditPortions("4");
    setEditPrepTime("20");
    setEditCookingTime("0");
    setEditIngredients("");
    setEditSteps("");
  }

  function openEditModal() {
    setEditTitle(recipe.title);
    setEditUrl(recipe.url ?? "");
    setEditPortions(String(recipe.basePortions));
    setEditPrepTime(String(recipe.prepTimeMinutes));
    setEditCookingTime(String(recipe.cookingTimeMinutes));
    setEditIngredients(
      recipe.ingredients
        .map((i) => {
          const q = Number.isInteger(i.quantity) ? String(i.quantity) : String(i.quantity);
          return `${q} ${i.unit} ${i.name}`;
        })
        .join("\n")
    );
    setEditSteps(recipe.steps.map((s) => `- ${s}`).join("\n"));
    setEditOpen(true);
  }

  function parseIngredientLine(
    line: string,
    existingByName: Map<
      string,
      { aisle: string; unit: string; name: string; quantity: number }
    >
  ): { name: string; quantity: number; unit: string; aisle: string } {
    const raw = line.trim().replace(/^[-•]\s*/g, "");
    if (!raw || raw === "-" || raw.startsWith("#")) {
      return { name: "", quantity: 1, unit: "pièce", aisle: "Divers" };
    }

    // Case "2 tomates" => souvent sans unité explicite. On tente d’abord de matcher le nom complet.
    const m = raw.match(/^([0-9]+(?:[.,][0-9]+)?)\s+(.*)$/);
    if (!m) {
      const name = raw;
      const existing = existingByName.get(normalizeName(name));
      return {
        name: existing?.name ?? name,
        quantity: existing?.quantity ?? 1,
        unit: existing?.unit ?? "pièce",
        aisle: existing?.aisle ?? "Divers",
      };
    }

    const qtyRaw = m[1] ?? "1";
    const remainder = (m[2] ?? "").trim();
    const quantity = (() => {
      const v = Number(String(qtyRaw).replace(",", "."));
      return Number.isFinite(v) && v > 0 ? v : 1;
    })();

    const byFullRemainder = existingByName.get(normalizeName(remainder));
    if (byFullRemainder) {
      return {
        name: byFullRemainder.name,
        quantity,
        unit: byFullRemainder.unit,
        aisle: byFullRemainder.aisle,
      };
    }

    const tokens = remainder.split(/\s+/g).filter(Boolean);
    if (tokens.length === 0) {
      return { name: "", quantity: 1, unit: "pièce", aisle: "Divers" };
    }

    if (tokens.length === 1) {
      const name = tokens[0]!;
      const existing = existingByName.get(normalizeName(name));
      return {
        name: existing?.name ?? name,
        quantity,
        unit: existing?.unit ?? "pièce",
        aisle: existing?.aisle ?? "Divers",
      };
    }

    const unit = tokens[0]!;
    const name = tokens.slice(1).join(" ");
    const existing = existingByName.get(normalizeName(name));
    return {
      name: existing?.name ?? name,
      quantity,
      unit: unit || existing?.unit || "pièce",
      aisle: existing?.aisle ?? "Divers",
    };
  }

  async function submitEditRecipe(e: FormEvent) {
    e.preventDefault();
    if (!state) return;

    const portions = Number(editPortions);
    const prep = Number(editPrepTime);
    const cook = Number(editCookingTime);
    const safePortions =
      Number.isFinite(portions) && portions > 0 ? Math.min(Math.max(portions, 1), 24) : 4;
    const safePrep = Number.isFinite(prep) && prep >= 0 ? prep : 0;
    const safeCook = Number.isFinite(cook) && cook >= 0 ? cook : 0;

    const existingByName = new Map<
      string,
      { aisle: string; unit: string; name: string; quantity: number }
    >();
    for (const ing of recipe.ingredients) {
      existingByName.set(normalizeName(ing.name), {
        aisle: ing.aisle,
        unit: ing.unit,
        name: ing.name,
        quantity: ing.quantity,
      });
    }

    const ingredients = editIngredients
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => parseIngredientLine(line, existingByName))
      .filter((i) => i.name.trim().length > 0);

    const steps = editSteps
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^[-•]\s*/g, "").trim())
      .filter((s) => s.length > 0);

    setEditBusy(true);
    const ok = await commit((dr) => {
      const row = dr.recipes.find((x) => x.recipeInstanceId === recipeId);
      if (!row) return;

      row.title = editTitle.trim();
      row.url = editUrl.trim() || null;
      row.basePortions = safePortions;
      row.prepTimeMinutes = safePrep;
      row.cookingTimeMinutes = safeCook;
      row.ingredients = ingredients;
      row.steps = steps.length > 0 ? steps : ["Préparer la recette."];

      // Recalcule les lignes de courses dérivées (celles issues des recettes),
      // en préservant les lignes manuelles et l’état `checked` par identifiant.
      const prevLines = dr.shoppingLines;
      const existingCheckedById = new Map<string, boolean>();
      for (const l of prevLines) {
        if (l.manual || l.extraIngredient) continue;
        existingCheckedById.set(l.id, l.checked);
      }

      const computedById = new Map<
        string,
        { name: string; unit: string; aisle: string; quantity: number }
      >();

      for (const r of dr.recipes) {
        if (r.removedFromPlan) continue;
        const base = r.basePortions;
        const target = dr.targetPortions[r.recipeInstanceId] ?? base;
        const scale = base > 0 ? target / base : 1;
        for (const ing of r.ingredients) {
          const id = aggLineId(ing.aisle, ing.unit, ing.name);
          const q = scaleIngredientQuantity(ing.quantity, ing.unit, scale);
          const cur = computedById.get(id);
          if (!cur) {
            computedById.set(id, {
              name: ing.name,
              unit: ing.unit,
              aisle: ing.aisle,
              quantity: q,
            });
          } else {
            cur.quantity = cur.quantity + q;
          }
        }
      }

      const seen = new Set<string>();
      const nextLines: typeof dr.shoppingLines = [];
      for (const l of prevLines) {
        if (l.manual || l.extraIngredient) {
          nextLines.push(l);
          continue;
        }
        const comp = computedById.get(l.id);
        if (!comp) continue;
        seen.add(l.id);
        nextLines.push({
          ...l,
          name: comp.name,
          unit: comp.unit,
          aisle: comp.aisle,
          quantity: roundDisplay(comp.quantity, comp.unit),
          checked: existingCheckedById.get(l.id) ?? false,
          manual: false,
        });
      }
      for (const [id, comp] of computedById) {
        if (seen.has(id)) continue;
        nextLines.push({
          id,
          name: comp.name,
          quantity: roundDisplay(comp.quantity, comp.unit),
          unit: comp.unit,
          aisle: comp.aisle,
          checked: false,
          manual: false,
        });
      }

      dr.shoppingLines = nextLines;
    });

    setEditBusy(false);
    if (ok) {
      resetEditForm();
      setEditOpen(false);
    }
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
              onChange={(e) => {
                const n = Number(e.target.value);
                setLocalPortions(n);
                if (flushPortionsTimerRef.current) {
                  window.clearTimeout(flushPortionsTimerRef.current);
                }
                flushPortionsTimerRef.current = window.setTimeout(() => {
                  void flushPortions(n);
                }, 250);
              }}
              onBlur={() => {
                if (flushPortionsTimerRef.current) {
                  window.clearTimeout(flushPortionsTimerRef.current);
                  flushPortionsTimerRef.current = null;
                }
                void flushPortions();
              }}
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
          <button
            type="button"
            className="btn icon ghost"
            aria-label="Modifier la recette"
            title="Modifier"
            disabled={editBusy}
            onClick={() => openEditModal()}
          >
            ✎
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

      {editOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-recipe-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !editBusy) {
              setEditOpen(false);
              resetEditForm();
            }
          }}
        >
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-recipe-title">Modifier la recette</h2>
            <form
              onSubmit={submitEditRecipe}
              className="dashboard-manual-recipe-form"
            >
              <div className="field-grid">
                <label className="field">
                  <span>Titre</span>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
                <label className="field">
                  <span>URL</span>
                  <input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    type="url"
                    placeholder="https://… (optionnel)"
                  />
                </label>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span>Portions</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={editPortions}
                    onChange={(e) => setEditPortions(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Temps de préparation (min)</span>
                  <input
                    type="number"
                    min={0}
                    value={editPrepTime}
                    onChange={(e) => setEditPrepTime(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Temps de cuisson (min)</span>
                  <input
                    type="number"
                    min={0}
                    value={editCookingTime}
                    onChange={(e) => setEditCookingTime(e.target.value)}
                    required
                  />
                </label>
              </div>

              <label className="field">
                <span>Ingrédients</span>
                <textarea
                  rows={5}
                  value={editIngredients}
                  onChange={(e) => setEditIngredients(e.target.value)}
                  placeholder={
                    "Une ligne par ingrédient (quantité + unité + nom), ex.:\n2 pièce tomates\n200 g de pâtes\n1 càs huile d'olive"
                  }
                />
                <p className="muted small">
                  Les quantités/unités sont sauvegardées telles quelles (pour éviter de fausser la recette).
                </p>
              </label>

              <label className="field">
                <span>Étapes</span>
                <textarea
                  rows={6}
                  value={editSteps}
                  onChange={(e) => setEditSteps(e.target.value)}
                  placeholder={"Une ligne par étape, préfixez avec « - », ex.:\n- Faire chauffer le four…"}
                />
              </label>

              <div className="row end">
                <button
                  type="button"
                  className="btn ghost"
                  disabled={editBusy}
                  onClick={() => {
                    setEditOpen(false);
                    resetEditForm();
                  }}
                >
                  Annuler
                </button>
                <button type="submit" className="btn primary" disabled={editBusy}>
                  {editBusy ? "Enregistrement…" : "Enregistrer la recette"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
