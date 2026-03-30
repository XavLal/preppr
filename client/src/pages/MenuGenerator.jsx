import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ROLE_CONTEXT,
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
  DEFAULT_USER_CONTEXT,
  FIXED_JSON_RULES,
} from "@/config/prompts.js";
import { getTenantCacheKey } from "@/lib/tenantCacheKey";

function tenantKeyOrDefault() {
  return getTenantCacheKey() ?? "default";
}

function storageKeyFor(familyKey, field) {
  return `preppr_${familyKey}_${field}`;
}

function buildCustomUserContextText(profile) {
  const role = typeof profile?.roleContext === "string" ? profile.roleContext : DEFAULT_ROLE_CONTEXT;
  const family = typeof profile?.familyContext === "string" ? profile.familyContext : DEFAULT_FAMILY_CONTEXT;
  const tastes = typeof profile?.tastesContext === "string" ? profile.tastesContext : DEFAULT_TASTES_CONTEXT;
  const culinaryStyle =
    typeof profile?.culinaryStyleContext === "string"
      ? profile.culinaryStyleContext
      : DEFAULT_CULINARY_STYLE_CONTEXT;
  const equipment =
    typeof profile?.equipmentContext === "string"
      ? profile.equipmentContext
      : DEFAULT_EQUIPMENT_CONTEXT;

  return [
    "Rôle :",
    role.trim(),
    "",
    "Famille (taille / contraintes) :",
    family.trim(),
    "",
    "Goûts (préférences / allergies) :",
    tastes.trim(),
    "",
    "Style culinaire :",
    culinaryStyle.trim(),
    "",
    "Équipements disponibles :",
    equipment.trim(),
  ].join("\n");
}

/**
 * UI de chat (mock) : dans la vraie version, on appellera l’API Gemini côté client (BYOK).
 */
export default function MenuGenerator() {
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
  const [customUserContext, setCustomUserContext] = useState(DEFAULT_USER_CONTEXT);

  const [messages, setMessages] = useState(() => [
    {
      role: "model",
      content:
        "Je peux générer un menu familial et les courses correspondantes. Décris simplement ce que tu as en tête.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState(null);

  const textareaRef = useRef(null);

  useEffect(() => {
    const storedKey = localStorage.getItem(apiKeyStorageKey);
    setApiKey(storedKey ?? "");

    const storedContext = localStorage.getItem(contextStorageKey);
    if (!storedContext) {
      setCustomUserContext(DEFAULT_USER_CONTEXT);
      return;
    }

    // Nouveaux paramètres (JSON) ; compat avec l'ancien stockage string.
    try {
      const parsed = JSON.parse(storedContext);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setCustomUserContext(buildCustomUserContextText(parsed));
      } else {
        setCustomUserContext(String(storedContext));
      }
    } catch {
      setCustomUserContext(String(storedContext));
    }
  }, [apiKeyStorageKey, contextStorageKey]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  function addMessage(role, content) {
    setMessages((m) => [...m, { role, content }]);
  }

  function handleDraftKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  }

  async function handleSendMessage() {
    const text = draft.trim();
    if (!text || isLoading) return;

    addMessage("user", text);
    setDraft("");
    setIsLoading(true);

    // Dans la vraie version, voici comment on construirait le prompt système final :
    const finalSystemPrompt = customUserContext + "\n\n" + FIXED_JSON_RULES;
    console.log(finalSystemPrompt);

    window.setTimeout(() => {
      const fakeAssistant =
        "Menu proposé (mock) :\n- Lundi : poulet rôti + légumes au four\n- Mardi : chili végétarien + riz\n- Jeudi : pâtes au pesto + salade\n\nSi tu me donnes des contraintes (budget, allergies, quantités), je peux ajuster.";
      addMessage("model", fakeAssistant);
      setIsLoading(false);
    }, 2000);
  }

  return (
    <div className="menu-generator">
      <h1>Générateur de Menus</h1>

      <div
        className="card"
        style={{
          padding: "0.9rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          minHeight: "65vh",
        }}
      >
        <div
          className="chat-messages"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.25rem 0.1rem",
          }}
        >
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={`${msg.role}-${idx}`}
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                  padding: "0.2rem 0",
                }}
              >
                <div
                  style={{
                    maxWidth: "78%",
                    background: isUser ? "#0d8065" : "#e8f5f1",
                    color: isUser ? "#fff" : "#0d5e4a",
                    borderRadius: 14,
                    padding: "0.6rem 0.75rem",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.4,
                    border: isUser ? "1px solid #095848" : "1px solid #cfeee4",
                  }}
                  aria-label={isUser ? "Message utilisateur" : "Message IA"}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "flex-start", padding: "0.2rem 0" }}>
              <div
                style={{
                  maxWidth: 520,
                  background: "#e8f5f1",
                  color: "#0d5e4a",
                  borderRadius: 14,
                  padding: "0.6rem 0.75rem",
                  border: "1px solid #cfeee4",
                }}
              >
                Génération…
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="muted small">
              {apiKey ? "Clé API détectée." : "Ajoute une clé API pour activer la génération."}
            </div>

            <label className="btn ghost icon" style={{ cursor: "pointer" }} title="Joindre une image">
              Joindre une image
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setSelectedFileName(f ? f.name : null);
                }}
              />
            </label>
          </div>

          {selectedFileName ? (
            <div className="muted small" style={{ marginTop: "-0.2rem" }}>
              Image : <strong>{selectedFileName}</strong>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end" }}>
            <label className="field" style={{ flex: 1, marginBottom: 0 }}>
              <span className="sr-only">Message</span>
              <textarea
                ref={textareaRef}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Écris ton message… (Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)"
                style={{
                  resize: "none",
                  overflow: "hidden",
                  minHeight: 42,
                  maxHeight: 180,
                }}
              />
            </label>

            <button
              type="button"
              className="btn primary"
              disabled={isLoading || draft.trim().length === 0}
              onClick={() => void handleSendMessage()}
            >
              {isLoading ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

