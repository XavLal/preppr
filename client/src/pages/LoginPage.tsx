import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { apiLogin } from "@/api/client";
import { setAuthToken } from "@/lib/authToken";

export default function LoginPage() {
  const { t } = useTranslation(["login", "errors"]);
  const nav = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await apiLogin({ login, password, rememberMe });
      setAuthToken(res.token, rememberMe);
      nav("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors:generic"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Preppr</h1>
        <p className="muted">{t("subtitle")}</p>
        <label className="field">
          <span>{t("username")}</span>
          <input
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>{t("password")}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          {t("rememberMe")}
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? t("pending") : t("submit")}
        </button>
      </form>
    </div>
  );
}
