import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { apiAuthStatus, apiLogin, apiSetup } from "@/api/client";
import { setAuthToken } from "@/lib/authToken";
import { useAppStore } from "@/store/useAppStore";

type Mode = "checking" | "login" | "setup";

export default function LoginPage() {
  const { t } = useTranslation(["login", "errors"]);
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("checking");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiAuthStatus()
      .then((s) => {
        if (!cancelled) setMode(s.needsSetup ? "setup" : "login");
      })
      .catch(() => {
        if (!cancelled) setMode("login");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "setup" && password !== confirm) {
      setError(t("setup.mismatch"));
      return;
    }
    setPending(true);
    try {
      if (mode === "setup") {
        const res = await apiSetup({ login, password, setupToken });
        setAuthToken(res.token, true);
      } else {
        const res = await apiLogin({ login, password, rememberMe });
        setAuthToken(res.token, rememberMe);
      }
      useAppStore.getState().resetSession();
      nav("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors:generic"));
    } finally {
      setPending(false);
    }
  }

  if (mode === "checking") {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h1>Preppr</h1>
          <p className="muted" role="status">
            {t("checking")}
          </p>
        </div>
      </div>
    );
  }

  const isSetup = mode === "setup";

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Preppr</h1>
        <p className="muted">{isSetup ? t("setup.subtitle") : t("subtitle")}</p>
        {isSetup ? <p className="muted small">{t("setup.body")}</p> : null}
        {isSetup ? (
          <label className="field">
            <span>{t("setup.token")}</span>
            <input
              autoComplete="one-time-code"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              required
            />
            <small className="muted">{t("setup.tokenHint")}</small>
          </label>
        ) : null}
        <label className="field">
          <span>{t("username")}</span>
          <input
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
          />
          {isSetup ? <small className="muted">{t("setup.usernameHint")}</small> : null}
        </label>
        <label className="field">
          <span>{t("password")}</span>
          <input
            type="password"
            autoComplete={isSetup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={isSetup ? 12 : undefined}
            required
          />
          {isSetup ? <small className="muted">{t("setup.passwordHint")}</small> : null}
        </label>
        {isSetup ? (
          <label className="field">
            <span>{t("setup.confirm")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={12}
              required
            />
          </label>
        ) : (
          <label className="check">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            {t("rememberMe")}
          </label>
        )}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn primary" disabled={pending}>
          {pending
            ? isSetup
              ? t("setup.pending")
              : t("pending")
            : isSetup
              ? t("setup.submit")
              : t("submit")}
        </button>
      </form>
    </div>
  );
}
