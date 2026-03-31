import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
} from "@/config/prompts.js";
import { normalizeAisleOrder } from "@/lib/shopAisles";
import { useAppStore } from "@/store/useAppStore";

export default function Settings() {
  const hydrate = useAppStore((s) => s.hydrate);
  const state = useAppStore((s) => s.state);
  const commit = useAppStore((s) => s.commit);

  const [apiKey, setApiKey] = useState("");
  const [savedMessage, setSavedMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formHydrated, setFormHydrated] = useState(false);

  const [familyContext, setFamilyContext] = useState(DEFAULT_FAMILY_CONTEXT);
  const [tastesContext, setTastesContext] = useState(DEFAULT_TASTES_CONTEXT);
  const [culinaryStyleContext, setCulinaryStyleContext] = useState(
    DEFAULT_CULINARY_STYLE_CONTEXT
  );
  const [equipmentContext, setEquipmentContext] = useState(DEFAULT_EQUIPMENT_CONTEXT);
  const [interactionContext, setInteractionContext] = useState("");

  const lastPushedVersionRef = useRef(null);

  useEffect(() => {
    if (!state) void hydrate();
  }, [hydrate, state]);

  useEffect(() => {
    if (!state) return;
    if (lastPushedVersionRef.current === state.version) return;
    lastPushedVersionRef.current = state.version;
    setApiKey(state.geminiApiKey);
    setFamilyContext(state.familyContext);
    setTastesContext(state.tastesContext);
    setCulinaryStyleContext(state.culinaryStyleContext);
    setEquipmentContext(state.equipmentContext);
    setInteractionContext(state.interactionContext);
    setFormHydrated(true);
  }, [state?.version, state]);

  useEffect(() => {
    if (!formHydrated || !state) return;
    const matches =
      apiKey === state.geminiApiKey &&
      familyContext === state.familyContext &&
      tastesContext === state.tastesContext &&
      culinaryStyleContext === state.culinaryStyleContext &&
      equipmentContext === state.equipmentContext &&
      interactionContext === state.interactionContext;
    if (matches) return;

    setBusy(true);
    const t = window.setTimeout(() => {
      void (async () => {
        const ok = await commit((d) => {
          d.geminiApiKey = apiKey;
          d.familyContext = familyContext;
          d.tastesContext = tastesContext;
          d.culinaryStyleContext = culinaryStyleContext;
          d.equipmentContext = equipmentContext;
          d.interactionContext = interactionContext;
        });
        setBusy(false);
        if (ok) {
          setSavedMessage("Préférences enregistrées");
          window.setTimeout(() => setSavedMessage(null), 2500);
        }
      })();
    }, 600);
    return () => {
      window.clearTimeout(t);
      setBusy(false);
    };
  }, [
    formHydrated,
    apiKey,
    familyContext,
    tastesContext,
    culinaryStyleContext,
    equipmentContext,
    state,
    commit,
  ]);

  function showSavedToastIfOk(wasOk) {
    if (wasOk) {
      setSavedMessage("Préférences enregistrées");
      window.setTimeout(() => setSavedMessage(null), 2500);
    }
  }

  async function moveAisle(index, direction) {
    const ok = await commit((d) => {
      const cur = normalizeAisleOrder(d.shopAisleOrder);
      const j = index + direction;
      if (j < 0 || j >= cur.length) return;
      const next = [...cur];
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      d.shopAisleOrder = next;
    });
    showSavedToastIfOk(ok);
  }

  async function resetAisleOrderDefault() {
    const ok = await commit((d) => {
      d.shopAisleOrder = normalizeAisleOrder([]);
    });
    showSavedToastIfOk(ok);
  }

  async function resetPromptsToDefaults() {
    setApiKey("");
    setFamilyContext(DEFAULT_FAMILY_CONTEXT);
    setTastesContext(DEFAULT_TASTES_CONTEXT);
    setCulinaryStyleContext(DEFAULT_CULINARY_STYLE_CONTEXT);
    setEquipmentContext(DEFAULT_EQUIPMENT_CONTEXT);
    setInteractionContext("");
    const ok = await commit((d) => {
      d.geminiApiKey = "";
      d.familyContext = DEFAULT_FAMILY_CONTEXT;
      d.tastesContext = DEFAULT_TASTES_CONTEXT;
      d.culinaryStyleContext = DEFAULT_CULINARY_STYLE_CONTEXT;
      d.equipmentContext = DEFAULT_EQUIPMENT_CONTEXT;
      d.interactionContext = "";
    });
    showSavedToastIfOk(ok);
  }

  const aisleOrder = state ? normalizeAisleOrder(state.shopAisleOrder) : [];
  const aisleControlsDisabled = !state || busy;

  return (
    <div className="settings">
      <h1>Paramètres</h1>

      <section className="card">
        <h2>Clé API Gemini</h2>
        <p className="muted small">
          Pour activer le Générateur de Menus, crée une clé API dans Google AI Studio. Le forfait gratuit est suffisant.
          La clé est enregistrée avec vos données familiales sur le serveur (comme les recettes).
        </p>
        <ol className="muted small" style={{ paddingLeft: "1.25rem" }}>
          <li>Va sur Google AI Studio, menu "Get API key" : <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">ICI</a></li>
          <li>Crée/copie la clé API.</li>
          <li>Colle-la ci-dessous.</li>
        </ol>

        <label className="field">
          <span>Clé API</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Gemini API key"
            autoComplete="off"
          />
        </label>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Ordre des rayons</h2>
        <p className="muted small">
          Ordre d’affichage des rayons sur la page Liste de courses (parcours de votre magasin).
          Synchronisé avec votre famille comme les recettes et la liste de courses.
        </p>
        {!state ? <p className="muted small">Chargement des données…</p> : null}
        {state ? (
          <>
            <ul
              className="settings-aisle-order"
              style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0", display: "grid", gap: "0.4rem" }}
            >
              {aisleOrder.map((label, i) => (
                <li
                  key={label}
                  className="row"
                  style={{ alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}
                >
                  <span style={{ flex: "1 1 12rem" }}>{label}</span>
                  <div className="row" style={{ gap: "0.35rem" }}>
                    <button
                      type="button"
                      className="btn icon ghost"
                      disabled={aisleControlsDisabled || i === 0}
                      onClick={() => void moveAisle(i, -1)}
                      aria-label={`Monter ${label}`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn icon ghost"
                      disabled={aisleControlsDisabled || i === aisleOrder.length - 1}
                      onClick={() => void moveAisle(i, 1)}
                      aria-label={`Descendre ${label}`}
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="row" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn ghost"
                disabled={aisleControlsDisabled}
                onClick={() => void resetAisleOrderDefault()}
              >
                Réinitialiser l’ordre des rayons
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Contexte utilisateur</h2>
        <p className="muted small">
          Ces champs constituent votre <strong>contexte utilisateur</strong> envoyé au générateur de menus.
          Ils sont synchronisés pour toute la famille (même compte).
        </p>

        <div style={{ display: "grid", gap: "1rem", marginTop: "0.5rem" }}>
          <div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Famille</strong>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => setFamilyContext(DEFAULT_FAMILY_CONTEXT)}
              >
                Réinitialiser
              </button>
            </div>
            <label className="field">
              <span>(taille / contraintes)</span>
              <textarea
                rows={6}
                value={familyContext}
                onChange={(e) => setFamilyContext(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Goûts</strong>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => setTastesContext(DEFAULT_TASTES_CONTEXT)}
              >
                Réinitialiser
              </button>
            </div>
            <label className="field">
              <span>(préférences / allergies)</span>
              <textarea
                rows={6}
                value={tastesContext}
                onChange={(e) => setTastesContext(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Style culinaire</strong>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => setCulinaryStyleContext(DEFAULT_CULINARY_STYLE_CONTEXT)}
              >
                Réinitialiser
              </button>
            </div>
            <label className="field">
              <span>(recettes, durée, niveau...)</span>
              <textarea
                rows={6}
                value={culinaryStyleContext}
                onChange={(e) => setCulinaryStyleContext(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Équipements disponibles</strong>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => setEquipmentContext(DEFAULT_EQUIPMENT_CONTEXT)}
              >
                Réinitialiser
              </button>
            </div>
            <label className="field">
              <span>(four, robot, poêle...)</span>
              <textarea
                rows={6}
                value={equipmentContext}
                onChange={(e) => setEquipmentContext(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Interaction</strong>
            </div>
            <label className="field">
              <span>(ton, longueur des réponses, préférences d’échange)</span>
              <textarea
                rows={6}
                value={interactionContext}
                onChange={(e) => setInteractionContext(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div
          className="row end"
          style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}
        >
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => void resetPromptsToDefaults()}
            title="Remet la clé API (vide) et le contexte utilisateur par défaut"
          >
            Réinitialiser les préférences par défaut
          </button>
        </div>
      </section>

      {savedMessage ? (
        <div
          className="banner"
          style={{
            background: "#e8f5f1",
            border: "1px solid #cfeee4",
            color: "#0d5e4a",
          }}
          role="status"
          aria-live="polite"
        >
          {savedMessage}
        </div>
      ) : null}
    </div>
  );
}
