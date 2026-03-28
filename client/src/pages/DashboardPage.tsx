import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useAppStore } from "@/store/useAppStore";

export default function DashboardPage() {
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

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const active = state?.recipes.filter((r) => !r.removedFromPlan) ?? [];
  const toCook = active.filter((r) => !r.alreadyCooked).length;
  const toBuy =
    state?.shoppingLines.filter((l) => !l.checked).length ?? 0;

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

  const recipeCount = state?.recipes.length ?? 0;
  const canBulkClearRecipes =
    online && !pendingSync && recipeCount > 0;

  async function confirmClearAllRecipes() {
    setClearRecipesBusy(true);
    const ok = await clearAllRecipes();
    setClearRecipesBusy(false);
    if (ok) setClearRecipesOpen(false);
  }

  if (loading && !state) {
    return <p className="muted">Chargement…</p>;
  }

  return (
    <div>
      {error ? (
        <p className="error banner" role="alert">
          {error}
        </p>
      ) : null}

      <div className="stats">
        <div className="stat">
          <span className="stat-label">À cuisiner</span>
          <span className="stat-value">{toCook}</span>
        </div>
        <div className="stat">
          <span className="stat-label">À acheter</span>
          <span className="stat-value">{toBuy}</span>
        </div>
      </div>

      <div className="toolbar">
        <button type="button" className="btn primary" onClick={() => setImportOpen(true)}>
          Importer du JSON
        </button>
      </div>

      <ul className="recipe-list">
        {active.map((r) => (
          <li key={r.recipeInstanceId} className="recipe-card">
            <div className="recipe-card-head">
              <Link to={`/recette/${r.recipeInstanceId}`}>{r.title}</Link>
              {r.isSpecialMeal ? <span className="pill">Spécial</span> : null}
            </div>
            <p className="muted small">
              {r.source} · {r.prepTimeMinutes} min · {r.tags.join(", ")}
            </p>
            <div className="row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={r.alreadyCooked}
                  onChange={(e) => void toggleCooked(r.recipeInstanceId, e.target.checked)}
                />
                Déjà fait
              </label>
              <button
                type="button"
                className="btn danger ghost"
                disabled={!r.alreadyCooked}
                title={
                  r.alreadyCooked
                    ? "Retirer de la planification"
                    : "Cochez « Déjà fait » d’abord"
                }
                onClick={() => void removeRecipe(r.recipeInstanceId)}
              >
                Retirer
              </button>
            </div>
          </li>
        ))}
      </ul>

      <footer className="page-footer">
        <p className="muted small">
          Retire toutes les recettes du plan. La liste de courses est recalculée ; les lignes ajoutées
          manuellement y restent.
        </p>
        <button
          type="button"
          className="btn danger ghost"
          disabled={!canBulkClearRecipes}
          title={
            !online
              ? "Connexion requise"
              : pendingSync
                ? "Synchronisation en attente"
                : recipeCount === 0
                  ? "Aucune recette"
                  : undefined
          }
          onClick={() => setClearRecipesOpen(true)}
        >
          Supprimer toutes les recettes
        </button>
      </footer>

      {clearRecipesOpen ? (
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
            <h2 id="clear-recipes-title">Supprimer toutes les recettes ?</h2>
            <p className="muted">
              Toutes les recettes seront retirées du plan. La liste de courses sera mise à jour ;
              les ingrédients saisis manuellement dans la liste seront conservés.
            </p>
            <div className="row end">
              <button
                type="button"
                className="btn ghost"
                disabled={clearRecipesBusy}
                onClick={() => setClearRecipesOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={clearRecipesBusy}
                onClick={() => void confirmClearAllRecipes()}
              >
                {clearRecipesBusy ? "Suppression…" : "Tout supprimer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="card modal">
            <h2>Importer des recettes</h2>
            <form onSubmit={onImport}>
              <label className="field">
                <span>Coller le JSON</span>
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
                  onClick={() => setImportOpen(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn primary" disabled={importBusy}>
                  {importBusy ? "Import…" : "Importer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
