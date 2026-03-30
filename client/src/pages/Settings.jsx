import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
} from "@/config/prompts.js";
import { getTenantCacheKey } from "@/lib/tenantCacheKey";

function tenantKeyOrDefault() {
  return getTenantCacheKey() ?? "default";
}

function storageKeyFor(familyKey, field) {
  return `preppr_${familyKey}_${field}`;
}

export default function Settings() {
  const familyKey = useMemo(() => tenantKeyOrDefault(), []);

  const apiKeyStorageKey = useMemo(
    () => storageKeyFor(familyKey, "gemini_api_key"),
    [familyKey]
  );
  const contextStorageKey = useMemo(
    () => storageKeyFor(familyKey, "custom_user_context"),
    [familyKey]
  );

  const [apiKey, setApiKey] = useState("");
  const [savedMessage, setSavedMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [familyContext, setFamilyContext] = useState(DEFAULT_FAMILY_CONTEXT);
  const [tastesContext, setTastesContext] = useState(DEFAULT_TASTES_CONTEXT);
  const [culinaryStyleContext, setCulinaryStyleContext] = useState(
    DEFAULT_CULINARY_STYLE_CONTEXT
  );
  const [equipmentContext, setEquipmentContext] = useState(DEFAULT_EQUIPMENT_CONTEXT);

  function buildCustomUserContextPayload() {
    return {
      familyContext,
      tastesContext,
      culinaryStyleContext,
      equipmentContext,
    };
  }

  function applyLegacyStringToFields(legacyValue) {
    // Compat ascendante (ancienne UI = textarea "famille+goûts").
    setFamilyContext(legacyValue);
    setTastesContext("");
    setCulinaryStyleContext(DEFAULT_CULINARY_STYLE_CONTEXT);
    setEquipmentContext(DEFAULT_EQUIPMENT_CONTEXT);
  }

  // Pré-remplissage au premier chargement.
  useEffect(() => {
    const storedKey = localStorage.getItem(apiKeyStorageKey);
    setApiKey(storedKey ?? "");

    const storedContext = localStorage.getItem(contextStorageKey);
    if (!storedContext) {
      // Valeurs par défaut.
      setFamilyContext(DEFAULT_FAMILY_CONTEXT);
      setTastesContext(DEFAULT_TASTES_CONTEXT);
      setCulinaryStyleContext(DEFAULT_CULINARY_STYLE_CONTEXT);
      setEquipmentContext(DEFAULT_EQUIPMENT_CONTEXT);
    } else {
      try {
        const parsed = JSON.parse(storedContext);
        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed) &&
          Object.prototype.hasOwnProperty.call(parsed, "familyContext")
        ) {
          const obj = parsed;
          setFamilyContext(
            typeof obj.familyContext === "string" ? obj.familyContext : DEFAULT_FAMILY_CONTEXT
          );
          setTastesContext(
            typeof obj.tastesContext === "string" ? obj.tastesContext : DEFAULT_TASTES_CONTEXT
          );
          setCulinaryStyleContext(
            typeof obj.culinaryStyleContext === "string"
              ? obj.culinaryStyleContext
              : DEFAULT_CULINARY_STYLE_CONTEXT
          );
          setEquipmentContext(
            typeof obj.equipmentContext === "string"
              ? obj.equipmentContext
              : DEFAULT_EQUIPMENT_CONTEXT
          );
        } else {
          // Si c'est une string legacy.
          applyLegacyStringToFields(String(storedContext));
        }
      } catch {
        applyLegacyStringToFields(String(storedContext));
      }
    }

    setHydrated(true);
  }, [apiKeyStorageKey, contextStorageKey]);

  useEffect(() => {
    if (!hydrated) return;
    // Auto-save (debounce) pour éviter un spam de notifications.
    setBusy(true);
    const t = window.setTimeout(() => {
      localStorage.setItem(apiKeyStorageKey, apiKey);
      localStorage.setItem(
        contextStorageKey,
        JSON.stringify(buildCustomUserContextPayload())
      );
      setBusy(false);
      setSavedMessage("Préférences enregistrées");
      window.setTimeout(() => setSavedMessage(null), 2500);
    }, 600);
    return () => window.clearTimeout(t);
  }, [
    hydrated,
    apiKey,
    familyContext,
    tastesContext,
    culinaryStyleContext,
    equipmentContext,
    apiKeyStorageKey,
    contextStorageKey,
  ]);

  function resetToDefaults() {
    setApiKey("");
    setFamilyContext(DEFAULT_FAMILY_CONTEXT);
    setTastesContext(DEFAULT_TASTES_CONTEXT);
    setCulinaryStyleContext(DEFAULT_CULINARY_STYLE_CONTEXT);
    setEquipmentContext(DEFAULT_EQUIPMENT_CONTEXT);
  }

  return (
    <div className="settings">
      <h1>Paramètres</h1>

      <section className="card">
        <h2>Clé API Gemini</h2>
        <p className="muted small">
          Pour activer le Générateur de Menus, crée une clé API dans Google AI Studio. Le forfait gratuit est suffisant.
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
        <h2>Contexte utilisateur</h2>
        <p className="muted small">
          Ces champs constituent votre <strong>contexte utilisateur</strong> envoyé au générateur de menus.
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
        </div>

        <div
          className="row end"
          style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}
        >
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={resetToDefaults}
            title="Remet les préférences par défaut"
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

