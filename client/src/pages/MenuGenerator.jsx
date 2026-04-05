import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_ROLE_CONTEXT } from "@/config/prompts.js";
import { buildFullLlmSystemPrompt } from "@/lib/llmSystemPrompt";
import { getTenantCacheKey } from "@/lib/tenantCacheKey";
import { useAppStore } from "@/store/useAppStore";

function tenantKeyOrDefault() {
  return getTenantCacheKey() ?? "default";
}

function storageKeyFor(familyKey, field) {
  return `preppr_${familyKey}_${field}`;
}

const DEFAULT_ASSISTANT_WELCOME =
  "🍔 Je peux générer des menus et les courses correspondantes. \n👉 Indique moi:\n    - combien de repas tu souhaites au total\n    - s'il y a des repas spécifiques (invités, etc.)\n    - Contraintes, préférences, etc";

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

function IconRefresh() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
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
  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const initialReadIdxRef = useRef(0);
  const didInitialScrollRef = useRef(false);
  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    didInitialScrollRef.current = false;
    prevMessageCountRef.current = 0;
  }, [chatStorageKey]);

  useEffect(() => {
    if (!state) void hydrate();
  }, [hydrate, state]);

  const activeLlm = state?.activeLlm ?? "gemini";
  const apiKey = state?.geminiApiKey ?? "";
  const claudeApiKey = state?.claudeApiKey ?? "";
  const activeApiKey = activeLlm === "claude" ? claudeApiKey : apiKey;

  const fullLlmSystemPrompt = useMemo(() => {
    return buildFullLlmSystemPrompt({
      roleContext: DEFAULT_ROLE_CONTEXT,
      familyContext: state?.familyContext,
      tastesContext: state?.tastesContext,
      culinaryStyleContext: state?.culinaryStyleContext,
      equipmentContext: state?.equipmentContext,
      interactionContext: state?.interactionContext,
    });
  }, [
    state?.familyContext,
    state?.tastesContext,
    state?.culinaryStyleContext,
    state?.equipmentContext,
    state?.interactionContext,
  ]);

  useEffect(() => {
    const readIdxKey = `${chatStorageKey}_read_idx`;
    const raw = localStorage.getItem(chatStorageKey);
    let initialMessages;
    if (!raw) {
      initialMessages = defaultConversation();
    } else {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isValidChatMessage);
          initialMessages = valid.length > 0 ? valid : defaultConversation();
        } else {
          initialMessages = defaultConversation();
        }
      } catch {
        initialMessages = defaultConversation();
      }
    }
    const readRaw = localStorage.getItem(readIdxKey);
    initialReadIdxRef.current =
      readRaw != null && readRaw !== "" && !Number.isNaN(Number(readRaw))
        ? Number(readRaw)
        : initialMessages.length - 1;
    setMessages(initialMessages);
    setChatHydrated(true);
  }, [chatStorageKey]);

  useLayoutEffect(() => {
    if (!chatHydrated) return;
    const scroller = chatScrollRef.current;
    if (!scroller) return;

    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      const lastRead = initialReadIdxRef.current;
      const firstUnread = lastRead + 1;
      if (firstUnread < messages.length) {
        const node = scroller.querySelector(`[data-chat-msg="${firstUnread}"]`);
        node?.scrollIntoView({ block: "start", behavior: "auto" });
      } else {
        scroller.scrollTop = scroller.scrollHeight;
      }
      prevMessageCountRef.current = messages.length;
      return;
    }

    if (messages.length !== prevMessageCountRef.current || isLoading) {
      prevMessageCountRef.current = messages.length;
      scroller.scrollTop = scroller.scrollHeight;
      try {
        localStorage.setItem(
          `${chatStorageKey}_read_idx`,
          String(Math.max(0, messages.length - 1))
        );
      } catch {
        /* ignore */
      }
    }
  }, [chatHydrated, messages, isLoading, chatStorageKey]);

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
    const fresh = defaultConversation();
    setMessages(fresh);
    setDraft("");
    setImportStatus(null);
    localStorage.removeItem(chatStorageKey);
    localStorage.removeItem(`${chatStorageKey}_read_idx`);
    initialReadIdxRef.current = Math.max(0, fresh.length - 1);
    prevMessageCountRef.current = fresh.length;
    requestAnimationFrame(() => {
      const scroller = chatScrollRef.current;
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
  }

  async function handleSendMessage() {
    const text = draft.trim();
    if ((!text && !selectedFile) || isLoading) return;

    const visualUserMessage = text || `Image envoyée : ${selectedFileName ?? "photo"}`;
    const userMessage = { role: "user", content: visualUserMessage };

    addMessage(userMessage.role, userMessage.content);
    setDraft("");
    setIsLoading(true);

    const finalSystemPrompt = fullLlmSystemPrompt;

    if (!activeApiKey.trim()) {
      const llmLabel = activeLlm === "claude" ? "Claude (Anthropic)" : "Gemini (Google)";
      addMessage("model", `Clé API ${llmLabel} manquante. Ajoute-la dans Paramètres.`);
      setIsLoading(false);
      return;
    }

    try {
      let answer = "";

      if (activeLlm === "claude") {
        const anthropic = new Anthropic({
          apiKey: claudeApiKey.trim(),
          dangerouslyAllowBrowser: true,
        });

        const claudeHistory = messages.map((msg) => ({
          role: msg.role === "model" ? "assistant" : "user",
          content: msg.content,
        }));

        const userContent = [];
        if (text) userContent.push({ type: "text", text });
        if (selectedFile) {
          const imagePart = await fileToGenerativePart(selectedFile);
          userContent.push({
            type: "image",
            source: {
              type: "base64",
              media_type: selectedFile.type || "image/jpeg",
              data: imagePart.inlineData.data,
            },
          });
        }
        if (userContent.length === 0) userContent.push({ type: "text", text: " " });

        const response = await anthropic.messages.create({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 8192,
          system: finalSystemPrompt,
          messages: [
            ...claudeHistory,
            { role: "user", content: userContent },
            { role: "assistant", content: "{" },
          ],
        });

        const rawText =
          response.content[0]?.type === "text" ? response.content[0].text : "";
        answer = ("{" + rawText).trim();
      } else {
        const genAI = new GoogleGenerativeAI(apiKey.trim());
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          tools: [{ googleSearch: {} }],
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

        answer =
          result.response.text()?.trim() ||
          "Je n'ai pas reçu de réponse exploitable de Gemini.";
      }

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
      const llmLabel = activeLlm === "claude" ? "Claude" : "Gemini";
      const message =
        error instanceof Error ? error.message : `Erreur inconnue pendant l'appel ${llmLabel}.`;
      addMessage(
        "model",
        `Impossible de contacter ${llmLabel} pour le moment. Détail : ${message}`
      );
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
      setSelectedFileName(null);
    }
  }

  return (
    <div className="menu-generator">
      <div className="menu-generator-header">
        <h1>Générateur de Menus</h1>
        <button
          type="button"
          className="btn icon ghost"
          disabled={isLoading}
          onClick={startNewConversation}
          title="Nouvelle conversation"
          aria-label="Nouvelle conversation"
        >
          <IconRefresh />
        </button>
      </div>
      {!activeApiKey.trim() ? (
        <p
          className="banner"
          role="alert"
          style={{
            background: "#fff8e1",
            border: "1px solid #ffe082",
            color: "#7b5c00",
            marginBottom: "0.75rem",
          }}
        >
          Aucune clé API {activeLlm === "claude" ? "Claude (Anthropic)" : "Gemini (Google)"} configurée.{" "}
          <a href="/settings">Configurez-la dans les Paramètres.</a>
        </p>
      ) : null}
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

      <div className="card menu-generator-chat-card">
        <div className="chat-messages" ref={chatScrollRef}>
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={`${msg.role}-${idx}`}
                data-chat-msg={idx}
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

        <div className="menu-generator-composer-meta">
          <div className="muted small">
            {activeApiKey
              ? `Clé API ${activeLlm === "claude" ? "Claude" : "Gemini"} détectée.`
              : "Ajoute une clé API pour activer la génération."}
          </div>

          {selectedFileName ? (
            <div className="muted small" style={{ marginTop: "-0.15rem" }}>
              Image : <strong>{selectedFileName}</strong>
            </div>
          ) : null}

          <div className="menu-generator-composer-row">
            <label className="field">
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
                  maxHeight: 160,
                }}
              />
            </label>

            <div className="menu-generator-composer-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setSelectedFile(f ?? null);
                  setSelectedFileName(f ? f.name : null);
                }}
              />
              <button
                type="button"
                className="btn icon ghost p-[10px] h-[42px]"
                disabled={isLoading}
                title="Joindre une image"
                aria-label="Joindre une image"
                onClick={() => fileInputRef.current?.click()}
              >
                <IconImage />
              </button>
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
    </div>
  );
}

