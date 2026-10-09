import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAppStore } from "@/store/useAppStore";

export default function DashboardPage() {
  const { t } = useTranslation(["recipes", "common"]);
  const hydrate = useAppStore((s) => s.hydrate);
  const state = useAppStore((s) => s.state);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const pendingSync = useAppStore((s) => s.pendingSync);
  const importJson = useAppStore((s) => s.importJson);
  const commit = useAppStore((s) => s.commit);
  const clearAllRecipes = useAppStore((s) => s.clearAllRecipes);
  const online = useOnlineStatus();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [clearRecipesOpen, setClearRecipesOpen] = useState(false);
  const [clearRecipesBusy, setClearRecipesBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualPortions, setManualPortions] = useState("4");
  const [manualPrepTime, setManualPrepTime] = useState("20");
  const [manualCookingTime, setManualCookingTime] = useState("0");
  const [manualIngredients, setManualIngredients] = useState("");
  const [manualSteps, setManualSteps] = useState("");

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const active = state?.recipes.filter((r) => !r.removedFromPlan) ?? [];
  const toCook = active.filter((r) => !r.alreadyCooked).length;
  const cooked = active.filter((r) => r.alreadyCooked).length;
  const toBuy =
    state?.shoppingLines.filter((l) => !l.checked).length ?? 0;
  const bought = state?.shoppingLines.filter((l) => l.checked).length ?? 0;

  async function onImport(e: React.FormEvent) {
    e.preventDefault();
    setImportBusy(true);
    const ok = await importJson(importText);
    setImportBusy(false);
    if (ok) {
      setImportOpen(false);
      setImportText("");
    }
  }

  async function toggleCooked(id: string, value: boolean) {
    await commit((d) => {
      const r = d.recipes.find((x) => x.recipeInstanceId === id);
      if (r) r.alreadyCooked = value;
    });
  }

  async function removeRecipe(id: string) {
    await commit((d) => {
      const r = d.recipes.find((x) => x.recipeInstanceId === id);
      if (r && r.alreadyCooked) r.removedFromPlan = true;
    });
  }

  async function moveRecipe(id: string, direction: -1 | 1) {
    await commit((d) => {
      const indices: number[] = [];
      for (let i = 0; i < d.recipes.length; i += 1) {
        if (!d.recipes[i].removedFromPlan) indices.push(i);
      }
      const pos = indices.findIndex((idx) => d.recipes[idx].recipeInstanceId === id);
      if (pos === -1) return;
      const swapPos = pos + direction;
      if (swapPos < 0 || swapPos >= indices.length) return;
      const i = indices[pos]!;
      const j = indices[swapPos]!;
      const next = [...d.recipes];
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      d.recipes = next;
    });
  }

  const recipeCount = state?.recipes.length ?? 0;
  const canBulkClearRecipes =
    online && !pendingSync && recipeCount > 0;

  async function confirmClearAllRecipes() {
    setClearRecipesBusy(true);
    const ok = await clearAllRecipes();
    setClearRecipesBusy(false);
    if (ok) setClearRecipesOpen(false);
  }

  function resetManualForm() {
    setManualTitle("");
    setManualUrl("");
    setManualPortions("4");
    setManualPrepTime("20");
    setManualCookingTime("0");
    setManualIngredients("");
    setManualSteps("");
  }

  async function submitManualRecipe(e: FormEvent) {
    e.preventDefault();
    if (!state) return;
    const portions = Number(manualPortions);
    const prep = Number(manualPrepTime);
    const cook = Number(manualCookingTime);
    const safePortions =
      Number.isFinite(portions) && portions > 0 ? Math.min(Math.max(portions, 1), 24) : 4;
    const safePrep = Number.isFinite(prep) && prep >= 0 ? prep : 0;
    const safeCook = Number.isFinite(cook) && cook >= 0 ? cook : 0;

    const ingredients = manualIngredients
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((name) => ({
        name,
        quantity: 1,
        unit: "pièce",
        aisle: "Divers",
      }));

    const steps = manualSteps
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    setManualBusy(true);
    try {
    const ok = await commit((d) => {
      const id = crypto.randomUUID();
      d.recipes.push({
        recipeInstanceId: id,
        sourceRecipeId: `manual-${id}`,
        weekId: null,
        title: manualTitle.trim(),
        source: t("sourceHome"),
        url: manualUrl.trim() || null,
        basePortions: safePortions,
        prepTimeMinutes: safePrep,
        cookingTimeMinutes: safeCook,
        equipment: [],
        tags: [],
        isSpecialMeal: false,
        alreadyCooked: false,
        removedFromPlan: false,
        ingredients,
        steps: steps.length > 0 ? steps : [t("defaultStep")],
      });
    });
      if (ok) {
        resetManualForm();
        setManualOpen(false);
      }
    } finally {
      setManualBusy(false);
    }
  }

  if (loading && !state) {
    return <p className="muted">{t("common:loading")}</p>;
  }

  return (
    <div>
      {error ? (
        <p className="error banner" role="alert">
          {error}
        </p>
      ) : null}

      <div className="stats">
        <Link to="/" className="stat">
          <span className="stat-label">{t("toCook")}</span>
          <span className="stat-value">{toCook}</span>
        </Link>
        <Link to="/" className="stat">
          <span className="stat-label">{t("cooked")}</span>
          <span className="stat-value">{cooked}</span>
        </Link>
        <Link to="/courses" className="stat">
          <span className="stat-label">{t("toBuy")}</span>
          <span className="stat-value">{toBuy}</span>
        </Link>
        <Link to="/courses" className="stat">
          <span className="stat-label">{t("bought")}</span>
          <span className="stat-value">{bought}</span>
        </Link>
      </div>

      {active.length > 0 ? (
        <p className="muted small">
          {t("reorderHint")}
        </p>
      ) : null}

      <ul className="recipe-list">
        {active.map((r, idx) => (
          <li key={r.recipeInstanceId} className="recipe-card">
            <div className="recipe-card-head">
              <Link to={`/recette/${r.recipeInstanceId}`}>{r.title}</Link>
              {r.isSpecialMeal ? <span className="pill">{t("special")}</span> : null}
            </div>
            <p className="muted small">
              {r.source}
              {" · "}
              {t("prepMinutes", { count: r.prepTimeMinutes })}
              {r.cookingTimeMinutes > 0
                ? ` · ${t("cookMinutes", { count: r.cookingTimeMinutes })}`
                : ""}
              {r.tags.length ? ` · ${r.tags.join(", ")}` : ""}
            </p>
            <div className="row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={r.alreadyCooked}
                  onChange={(e) => void toggleCooked(r.recipeInstanceId, e.target.checked)}
                />
                {t("alreadyDone")}
              </label>
              <div className="row" style={{ gap: "0.25rem" }}>
                <button
                  type="button"
                  className="btn icon ghost"
                  disabled={idx === 0}
                  aria-label={t("moveUp")}
                  onClick={() => void moveRecipe(r.recipeInstanceId, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn icon ghost"
                  disabled={idx === active.length - 1}
                  aria-label={t("moveDown")}
                  onClick={() => void moveRecipe(r.recipeInstanceId, 1)}
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                className="btn danger ghost"
                disabled={!r.alreadyCooked}
                title={r.alreadyCooked ? t("removeTitle") : t("removeLocked")}
                onClick={() => void removeRecipe(r.recipeInstanceId)}
              >
                {t("remove")}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {active.length === 0 ? (
        <div
          className="flex justify-center items-center mb-[2rem] mt-[5rem]"
        >
          <Link
            to="/generateur-menus"
            className="btn primary"
            style={{
              borderRadius: "999px",
              paddingInline: "2.5rem",
              lineHeight: "2",
            }}
          >
            🍔 {t("generate")}
          </Link>
        </div>
      ) : null
      }

      <div className="page-footer" style={{ marginTop: "1.5rem" }}>

      </div>

      <footer className="page-footer">
        <Separator className="mb-[1.25rem]" />
        <p className="muted small">{t("addHint")}</p>
        <button
          type="button"
          className="btn ghost mr-[0.5rem] mb-[1rem]"
          onClick={() => setManualOpen(true)}
        >
          {t("addManual")}
        </button>
        <button
          type="button"
          className="btn primary mb-[1rem]"
          onClick={() => setImportOpen(true)}
        >
          {t("importJson")}
        </button>
        <Separator className="mb-[1.25rem]" />
        <p className="muted small">{t("clearHint")}</p>
        <button
          type="button"
          className="btn danger ghost"
          disabled={!canBulkClearRecipes}
          title={
            !online
              ? t("common:connectionRequired")
              : pendingSync
                ? t("common:syncPending")
                : recipeCount === 0
                  ? t("noRecipes")
                  : undefined
          }
          onClick={() => setClearRecipesOpen(true)}
        >
          {t("clearAll")}
        </button>
      </footer>

      {
        clearRecipesOpen ? (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-recipes-title"
            onClick={(e) => {
              if (e.target === e.currentTarget && !clearRecipesBusy) setClearRecipesOpen(false);
            }}
          >
            <div className="card modal" onClick={(e) => e.stopPropagation()}>
              <h2 id="clear-recipes-title">{t("clearTitle")}</h2>
              <p className="muted">{t("clearBody")}</p>
              <div className="row end">
                <button
                  type="button"
                  className="btn ghost"
                  disabled={clearRecipesBusy}
                  onClick={() => setClearRecipesOpen(false)}
                >
                  {t("common:cancel")}
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={clearRecipesBusy}
                  onClick={() => void confirmClearAllRecipes()}
                >
                  {clearRecipesBusy ? t("clearPending") : t("clearConfirm")}
                </button>
              </div>
            </div>
          </div>
        ) : null
      }

      {
        importOpen ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="card modal">
              <h2>{t("importTitle")}</h2>
              <form onSubmit={onImport}>
                <label className="field">
                  <span>{t("pasteJson")}</span>
                  <textarea
                    rows={12}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    required
                  />
                </label>
                <div className="row end">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setImportOpen(false);
                      setImportText("");
                    }}
                  >
                    {t("common:cancel")}
                  </button>
                  <button type="submit" className="btn primary" disabled={importBusy}>
                    {importBusy ? t("importPending") : t("import")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null
      }

      {
        manualOpen ? (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-recipe-title"
            onClick={(e) => {
              if (e.target === e.currentTarget && !manualBusy) {
                setManualOpen(false);
              }
            }}
          >
            <div className="card modal" onClick={(e) => e.stopPropagation()}>
              <h2 id="manual-recipe-title">{t("manualTitle")}</h2>
              <form onSubmit={submitManualRecipe} className="dashboard-manual-recipe-form">
                {error ? (
                  <p className="error banner" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="field-grid">
                  <label className="field">
                    <span>{t("title")}</span>
                    <input
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      required
                      autoFocus
                    />
                  </label>
                  <label className="field">
                    <span>{t("url")}</span>
                    <input
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      type="url"
                      placeholder={t("urlPlaceholder")}
                    />
                  </label>
                </div>
                <div className="field-grid">
                  <label className="field">
                    <span>{t("portions")}</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={manualPortions}
                      onChange={(e) => setManualPortions(e.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>{t("prepTime")}</span>
                    <input
                      type="number"
                      min={0}
                      value={manualPrepTime}
                      onChange={(e) => setManualPrepTime(e.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>{t("cookTime")}</span>
                    <input
                      type="number"
                      min={0}
                      value={manualCookingTime}
                      onChange={(e) => setManualCookingTime(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <label className="field">
                  <span>{t("ingredients")}</span>
                  <textarea
                    rows={5}
                    value={manualIngredients}
                    onChange={(e) => setManualIngredients(e.target.value)}
                    placeholder={t("ingredientsPlaceholder")}
                  />
                  <p className="muted small">{t("ingredientsHint")}</p>
                </label>
                <label className="field">
                  <span>{t("steps")}</span>
                  <textarea
                    rows={6}
                    value={manualSteps}
                    onChange={(e) => setManualSteps(e.target.value)}
                    placeholder={t("stepsPlaceholder")}
                  />
                </label>
                <div className="row end">
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={manualBusy}
                    onClick={() => {
                      setManualOpen(false);
                    }}
                  >
                    {t("common:cancel")}
                  </button>
                  <button type="submit" className="btn primary" disabled={manualBusy}>
                    {manualBusy ? t("addPending") : t("addRecipe")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null
      }
    </div >
  );
}
