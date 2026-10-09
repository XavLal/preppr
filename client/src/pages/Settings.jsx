import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import AccountSettings from "@/components/AccountSettings";
import { DEFAULT_ROLE_CONTEXT } from "@/config/prompts.js";
import i18n, { currentLocale, setAppLocale } from "@/i18n";
import { useCatalogLabels } from "@/i18n/labels";
import { promptDefaults } from "@/i18n/prompts/catalog";
import { buildFullLlmSystemPrompt } from "@/lib/llmSystemPrompt";
import { normalizeAisleOrder } from "@/lib/shopAisles";
import { useAppStore } from "@/store/useAppStore";

function savedLabel() {
  return i18n.t("settings:saved");
}

export default function Settings() {
  const { t } = useTranslation("settings");
  const { aisleLabel } = useCatalogLabels();
  const hydrate = useAppStore((s) => s.hydrate);
  const state = useAppStore((s) => s.state);
  const commit = useAppStore((s) => s.commit);

  const [apiKey, setApiKey] = useState("");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [activeLlm, setActiveLlm] = useState("gemini");
  const [savedMessage, setSavedMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formHydrated, setFormHydrated] = useState(false);

  const defaults = promptDefaults();
  const [familyContext, setFamilyContext] = useState(defaults.family);
  const [tastesContext, setTastesContext] = useState(defaults.tastes);
  const [culinaryStyleContext, setCulinaryStyleContext] = useState(defaults.culinaryStyle);
  const [equipmentContext, setEquipmentContext] = useState(defaults.equipment);
  const [interactionContext, setInteractionContext] = useState(defaults.interaction);

  const lastPushedVersionRef = useRef(null);

  useEffect(() => {
    if (!state) void hydrate();
  }, [hydrate, state]);

  useEffect(() => {
    if (!state) return;
    if (lastPushedVersionRef.current === state.version) return;
    lastPushedVersionRef.current = state.version;
    setApiKey(state.geminiApiKey);
    setClaudeApiKey(state.claudeApiKey);
    setActiveLlm(state.activeLlm ?? "gemini");
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
      claudeApiKey === state.claudeApiKey &&
      activeLlm === (state.activeLlm ?? "gemini") &&
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
          d.claudeApiKey = claudeApiKey;
          d.activeLlm = activeLlm;
          d.familyContext = familyContext;
          d.tastesContext = tastesContext;
          d.culinaryStyleContext = culinaryStyleContext;
          d.equipmentContext = equipmentContext;
          d.interactionContext = interactionContext;
        });
        setBusy(false);
        if (ok) {
          setSavedMessage(savedLabel());
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
    claudeApiKey,
    activeLlm,
    familyContext,
    tastesContext,
    culinaryStyleContext,
    equipmentContext,
    interactionContext,
    state,
    commit,
  ]);

  function showSavedToastIfOk(wasOk) {
    if (wasOk) {
      setSavedMessage(savedLabel());
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

  function exportFullLlmPrompt() {
    const text = buildFullLlmSystemPrompt({
      roleContext: DEFAULT_ROLE_CONTEXT,
      familyContext,
      tastesContext,
      culinaryStyleContext,
      equipmentContext,
      interactionContext,
    });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "preppr-prompt-complet.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setSavedMessage(i18n.t("settings:exported"));
    window.setTimeout(() => setSavedMessage(null), 2500);
  }

  async function resetPromptsToDefaults() {
    setApiKey("");
    setClaudeApiKey("");
    setActiveLlm("gemini");
    const nextDefaults = promptDefaults();
    setFamilyContext(nextDefaults.family);
    setTastesContext(nextDefaults.tastes);
    setCulinaryStyleContext(nextDefaults.culinaryStyle);
    setEquipmentContext(nextDefaults.equipment);
    setInteractionContext(nextDefaults.interaction);
    const ok = await commit((d) => {
      d.geminiApiKey = "";
      d.claudeApiKey = "";
      d.activeLlm = "gemini";
      d.familyContext = nextDefaults.family;
      d.tastesContext = nextDefaults.tastes;
      d.culinaryStyleContext = nextDefaults.culinaryStyle;
      d.equipmentContext = nextDefaults.equipment;
      d.interactionContext = nextDefaults.interaction;
    });
    showSavedToastIfOk(ok);
  }

  const aisleOrder = state ? normalizeAisleOrder(state.shopAisleOrder) : [];
  const aisleControlsDisabled = !state || busy;

  return (
    <div className="settings">
      <h1>{t("title")}</h1>

      <section className="card">
        <h2>{t("languageTitle")}</h2>
        <p className="muted small">{t("languageHelp")}</p>
        <label className="field">
          <span>{t("languageLabel")}</span>
          <select
            value={currentLocale()}
            onChange={(e) => setAppLocale(e.target.value === "en" ? "en" : "fr")}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>

      <AccountSettings />

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>{t("mobileTitle")}</h2>
        <p className="muted small">{t("mobileBody")}</p>
        <Link to="/parametres/installation-pwa" className="btn ghost">
          {t("mobileLink")}
        </Link>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>{t("modelTitle")}</h2>
        <p className="muted small">{t("modelBody")}</p>

        <label className="field">
          <span>{t("activeModel")}</span>
          <select
            value={activeLlm}
            onChange={(e) => setActiveLlm(e.target.value)}
          >
            <option value="gemini">{t("gemini")}</option>
            <option value="claude">{t("claude")}</option>
          </select>
        </label>

        {activeLlm === "gemini" && (
          <div style={{ marginTop: "1rem" }}>
            <strong>{t("geminiKeyTitle")}</strong>
            <ol className="muted small" style={{ paddingLeft: "1.25rem", margin: "0.4rem 0 0.75rem" }}>
              <li>
                {t("geminiStep1")}{" "}
                <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">
                  {t("geminiStep1Link")}
                </a>
              </li>
              <li>{t("geminiStep2")}</li>
              <li>{t("geminiStep3")}</li>
            </ol>
            <label className="field">
              <span>{t("geminiKey")}</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                autoComplete="off"
              />
            </label>
          </div>
        )}

        {activeLlm === "claude" && (
          <div style={{ marginTop: "1rem" }}>
            <strong>{t("claudeKeyTitle")}</strong>
            <ol className="muted small" style={{ paddingLeft: "1.25rem", margin: "0.4rem 0 0.75rem" }}>
              <li>
                {t("claudeStep1")}{" "}
                <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">
                  console.anthropic.com
                </a>
                .
              </li>
              <li>{t("claudeStep2")}</li>
              <li>{t("claudeStep3")}</li>
            </ol>
            <label className="field">
              <span>{t("claudeKey")}</span>
              <input
                type="password"
                value={claudeApiKey}
                onChange={(e) => setClaudeApiKey(e.target.value)}
                placeholder="sk-ant-..."
                autoComplete="off"
              />
            </label>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>{t("aislesTitle")}</h2>
        <p className="muted small">{t("aislesBody")}</p>
        {!state ? <p className="muted small">{t("common:loadingData")}</p> : null}
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
                  <span style={{ flex: "1 1 12rem" }}>{aisleLabel(label)}</span>
                  <div className="row" style={{ gap: "0.35rem" }}>
                    <button
                      type="button"
                      className="btn icon ghost"
                      disabled={aisleControlsDisabled || i === 0}
                      onClick={() => void moveAisle(i, -1)}
                      aria-label={t("moveAisleUp", { name: aisleLabel(label) })}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn icon ghost"
                      disabled={aisleControlsDisabled || i === aisleOrder.length - 1}
                      onClick={() => void moveAisle(i, 1)}
                      aria-label={t("moveAisleDown", { name: aisleLabel(label) })}
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
                {t("resetAisles")}
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>{t("contextTitle")}</h2>
        <p className="muted small">{t("contextBody")}</p>

        <div style={{ display: "grid", gap: "1rem", marginTop: "0.5rem" }}>
          <div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{t("family")}</strong>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => setFamilyContext(promptDefaults().family)}
              >
                {t("reset")}
              </button>
            </div>
            <label className="field">
              <span>{t("familyHint")}</span>
              <textarea
                rows={6}
                value={familyContext}
                onChange={(e) => setFamilyContext(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{t("tastes")}</strong>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => setTastesContext(promptDefaults().tastes)}
              >
                {t("reset")}
              </button>
            </div>
            <label className="field">
              <span>{t("tastesHint")}</span>
              <textarea
                rows={6}
                value={tastesContext}
                onChange={(e) => setTastesContext(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{t("style")}</strong>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => setCulinaryStyleContext(promptDefaults().culinaryStyle)}
              >
                {t("reset")}
              </button>
            </div>
            <label className="field">
              <span>{t("styleHint")}</span>
              <textarea
                rows={6}
                value={culinaryStyleContext}
                onChange={(e) => setCulinaryStyleContext(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{t("equipment")}</strong>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => setEquipmentContext(promptDefaults().equipment)}
              >
                {t("reset")}
              </button>
            </div>
            <label className="field">
              <span>{t("equipmentHint")}</span>
              <textarea
                rows={6}
                value={equipmentContext}
                onChange={(e) => setEquipmentContext(e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{t("interaction")}</strong>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => setInteractionContext(promptDefaults().interaction)}
              >
                {t("reset")}
              </button>
            </div>
            <label className="field">
              <span>{t("interactionHint")}</span>
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
            title={t("resetAllTitle")}
          >
            {t("resetAll")}
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

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>{t("exportTitle")}</h2>
        <p className="muted small">{t("exportBody")}</p>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => exportFullLlmPrompt()}
        >
          {t("export")}
        </button>
      </section>
    </div>
  );
}
