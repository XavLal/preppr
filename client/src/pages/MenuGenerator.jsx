import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  DEFAULT_ROLE_CONTEXT,
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
  FIXED_JSON_RULES,
} from "@/config/prompts.js";
import { getTenantCacheKey } from "@/lib/tenantCacheKey";
import { useAppStore } from "@/store/useAppStore";

function tenantKeyOrDefault() {
  return getTenantCacheKey() ?? "default";
}

function storageKeyFor(familyKey, field) {
  return `preppr_${familyKey}_${field}`;
}

const DEFAULT_ASSISTANT_WELCOME =
  "Je peux générer un menu familial et les courses correspondantes. Décris simplement ce que tu as en tête.";

function defaultConversation() {
  return [{ role: "model", content: DEFAULT_ASSISTANT_WELCOME }];
}

function isValidChatMessage(value) {
  return (
    value &&
    typeof value === "object" &&
    (value.role === "user" || value.role === "model") &&
    typeof value.content === "string"
  );
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

function extractJsonPayload(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1) Bloc markdown ```json ... ```
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  // 2) Tout le texte est déjà du JSON
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return trimmed;
  }

  // 3) Fallback : extraire du premier "{" au dernier "}"
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return null;
}

function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Impossible de lire l'image sélectionnée."));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Format d'image invalide pour l'envoi."));
        return;
      }
      resolve({
        inlineData: {
          data: base64,
          mimeType: file.type || "image/jpeg",
        },
      });
    };
    reader.onerror = () => reject(new Error("Lecture de l'image impossible."));
    reader.readAsDataURL(file);
  });
}

export default function MenuGenerator() {
  const familyKey = useMemo(() => tenantKeyOrDefault(), []);

  const chatStorageKey = useMemo(
    () => storageKeyFor(familyKey, "menu_generator_chat"),
    [familyKey]
  );

  const hydrate = useAppStore((s) => s.hydrate);
  const state = useAppStore((s) => s.state);

  const [messages, setMessages] = useState(defaultConversation);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [chatHydrated, setChatHydrated] = useState(false);

  const importJson = useAppStore((s) => s.importJson);
  const appError = useAppStore((s) => s.error);

  const textareaRef = useRef(null);

  useEffect(() => {
    if (!state) void hydrate();
  }, [hydrate, state]);

  const apiKey = state?.geminiApiKey ?? "";

  const customUserContext = useMemo(() => {
    return buildCustomUserContextText({
      roleContext: DEFAULT_ROLE_CONTEXT,
      familyContext: state?.familyContext,
      tastesContext: state?.tastesContext,
      culinaryStyleContext: state?.culinaryStyleContext,
      equipmentContext: state?.equipmentContext,
    });
  }, [
    state?.familyContext,
    state?.tastesContext,
    state?.culinaryStyleContext,
    state?.equipmentContext,
  ]);

  useEffect(() => {
    const raw = localStorage.getItem(chatStorageKey);
    if (!raw) {
      setMessages(defaultConversation());
      setChatHydrated(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(isValidChatMessage);
        setMessages(valid.length > 0 ? valid : defaultConversation());
      } else {
        setMessages(defaultConversation());
      }
    } catch {
      setMessages(defaultConversation());
    }
    setChatHydrated(true);
  }, [chatStorageKey]);

  useEffect(() => {
    if (!chatHydrated) return;
    localStorage.setItem(chatStorageKey, JSON.stringify(messages));
  }, [chatHydrated, chatStorageKey, messages]);

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

  function startNewConversation() {
    setMessages(defaultConversation());
    setDraft("");
    setImportStatus(null);
    localStorage.removeItem(chatStorageKey);
  }

  async function handleSendMessage() {
    const text = draft.trim();
    if ((!text && !selectedFile) || isLoading) return;

    const visualUserMessage = text || `Image envoyée : ${selectedFileName ?? "photo"}`;
    const userMessage = { role: "user", content: visualUserMessage };

    addMessage(userMessage.role, userMessage.content);
    setDraft("");
    setIsLoading(true);

    const finalSystemPrompt = customUserContext + "\n\n" + FIXED_JSON_RULES;

    if (!apiKey.trim()) {
      addMessage("model", "Clé API Gemini manquante. Ajoute-la dans Paramètres.");
      setIsLoading(false);
      return;
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        tools: [
          {
            googleSearch: {},
          },
        ],
        systemInstruction: finalSystemPrompt,
      });

      const historyContents = messages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      }));
      const userParts = [];
      if (text) userParts.push({ text });
      if (selectedFile) {
        const imagePart = await fileToGenerativePart(selectedFile);
        userParts.push(imagePart);
      }
      if (userParts.length === 0) userParts.push({ text: " " });

      const result = await model.generateContent({
        contents: [...historyContents, { role: "user", parts: userParts }],
      });

      const answer =
        result.response.text()?.trim() ||
        "Je n'ai pas recu de reponse exploitable de Gemini.";

      const jsonPayload = extractJsonPayload(answer);
      if (!jsonPayload) {
        addMessage("model", answer);
        setImportStatus(
          "Réponse IA reçue, mais aucun JSON importable n'a été détecté."
        );
        return;
      }

      try {
        JSON.parse(jsonPayload);
      } catch {
        setImportStatus(
          "Réponse IA reçue, mais le JSON détecté est invalide."
        );
        return;
      }

      const imported = await importJson(jsonPayload);
      if (imported) {
        addMessage(
          "model",
          "C'est fait. Les recettes ont été importées automatiquement et la liste de courses est prête."
        );
        setImportStatus(
          "Recettes et liste de courses mises à jour automatiquement."
        );
      } else {
        addMessage(
          "model",
          "J'ai généré un JSON, mais l'import automatique a échoué. Vérifie les règles de format et réessaie."
        );
        setImportStatus(
          "Le JSON a été détecté, mais l'import a échoué."
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue pendant l'appel Gemini.";
      addMessage(
        "model",
        `Impossible de contacter Gemini pour le moment. Detail: ${message}`
      );
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
      setSelectedFileName(null);
    }
  }

  return (
    <div className="menu-generator">
      <h1>Générateur de Menus</h1>
      {importStatus ? (
        <p
          className="banner"
          role="status"
          aria-live="polite"
          style={{
            background: "#e8f5f1",
            border: "1px solid #cfeee4",
            color: "#0d5e4a",
            marginBottom: "0.75rem",
          }}
        >
          {importStatus}
        </p>
      ) : null}
      {appError ? (
        <p className="error banner" role="alert" style={{ marginBottom: "0.75rem" }}>
          {appError}
        </p>
      ) : null}

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
            <div className="row" style={{ gap: "0.5rem" }}>
              <button
                type="button"
                className="btn ghost"
                disabled={isLoading}
                onClick={startNewConversation}
                title="Effacer l'historique et recommencer"
              >
                Nouvelle conversation
              </button>
              <label
                className="btn ghost"
                style={{ cursor: "pointer" }}
                title="Joindre une image"
              >
                Joindre une image
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setSelectedFile(f ?? null);
                    setSelectedFileName(f ? f.name : null);
                  }}
                />
              </label>
            </div>
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
              disabled={isLoading || (draft.trim().length === 0 && !selectedFile)}
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

