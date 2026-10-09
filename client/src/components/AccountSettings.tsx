import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type Account,
  apiChangePassword,
  apiCreateAccount,
  apiListAccounts,
  apiMe,
  apiResetPassword,
} from "@/api/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { isAuthTokenRemembered, setAuthToken } from "@/lib/authToken";

type Feedback = { kind: "ok" | "error"; text: string } | null;

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return feedback.kind === "error" ? (
    <p className="error" role="alert">
      {feedback.text}
    </p>
  ) : (
    <p className="muted small" role="status">
      {feedback.text}
    </p>
  );
}

function ChangePasswordForm() {
  const { t } = useTranslation(["settings", "errors"]);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (next !== confirm) {
      setFeedback({ kind: "error", text: t("account.mismatch") });
      return;
    }
    setPending(true);
    try {
      const session = await apiChangePassword({ currentPassword: current, newPassword: next });
      setAuthToken(session.token, isAuthTokenRemembered());
      setCurrent("");
      setNext("");
      setConfirm("");
      setFeedback({ kind: "ok", text: t("account.passwordChanged") });
    } catch (err) {
      setFeedback({ kind: "error", text: errorText(err, t("errors:generic")) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label className="field">
        <span>{t("account.currentPassword")}</span>
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>{t("account.newPassword")}</span>
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          minLength={12}
          required
        />
      </label>
      <label className="field">
        <span>{t("account.confirmPassword")}</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={12}
          required
        />
      </label>
      <FeedbackLine feedback={feedback} />
      <button type="submit" className="btn primary" disabled={pending}>
        {t("account.changePassword")}
      </button>
    </form>
  );
}

function ResetPasswordRow({ account }: { account: Account }) {
  const { t } = useTranslation(["settings", "errors"]);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setPending(true);
    try {
      await apiResetPassword(account.login, password);
      setPassword("");
      setOpen(false);
      setFeedback({ kind: "ok", text: t("account.resetDone", { login: account.login }) });
    } catch (err) {
      setFeedback({ kind: "error", text: errorText(err, t("errors:generic")) });
    } finally {
      setPending(false);
    }
  }

  return (
    <li>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <span>
          <strong>{account.login}</strong>
          {account.role === "owner" ? (
            <span className="muted small"> — {t("account.ownerBadge")}</span>
          ) : null}
        </span>
        {account.role === "member" && !open ? (
          <button type="button" className="btn ghost" onClick={() => setOpen(true)}>
            {t("account.resetPassword")}
          </button>
        ) : null}
      </div>
      {open ? (
        <form onSubmit={onSubmit} style={{ marginTop: "0.5rem" }}>
          <p className="muted small">{t("account.resetWarning", { login: account.login })}</p>
          <label className="field">
            <span>{t("account.newPasswordFor", { login: account.login })}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              required
            />
          </label>
          <div className="row" style={{ gap: "0.5rem" }}>
            <button type="submit" className="btn primary" disabled={pending}>
              {t("account.resetConfirm")}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setPassword("");
              }}
            >
              {t("account.cancel")}
            </button>
          </div>
        </form>
      ) : null}
      <FeedbackLine feedback={feedback} />
    </li>
  );
}

function HouseholdAdmin() {
  const { t } = useTranslation(["settings", "errors"]);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const reload = useCallback(async () => {
    try {
      setAccounts(await apiListAccounts());
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err, t("errors:generic")));
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setPending(true);
    try {
      const created = await apiCreateAccount({ login, password });
      setLogin("");
      setPassword("");
      setFeedback({ kind: "ok", text: t("account.created", { login: created.login }) });
      await reload();
    } catch (err) {
      setFeedback({ kind: "error", text: errorText(err, t("errors:generic")) });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: "1rem" }}>
      <h2>{t("account.householdsTitle")}</h2>
      <p className="muted small">{t("account.householdsBody")}</p>
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}
      {accounts ? (
        <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0", display: "grid", gap: "0.6rem" }}>
          {accounts.map((a) => (
            <ResetPasswordRow key={a.tenantSlug} account={a} />
          ))}
        </ul>
      ) : null}

      <h3>{t("account.createTitle")}</h3>
      <form onSubmit={onCreate}>
        <label className="field">
          <span>{t("account.newLogin")}</span>
          <input
            autoComplete="off"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
          />
          <small className="muted">{t("account.newLoginHint")}</small>
        </label>
        <label className="field">
          <span>{t("account.initialPassword")}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            required
          />
        </label>
        <FeedbackLine feedback={feedback} />
        <button type="submit" className="btn primary" disabled={pending}>
          {t("account.create")}
        </button>
      </form>
    </section>
  );
}

export default function AccountSettings() {
  const { t } = useTranslation(["settings", "errors"]);
  const online = useOnlineStatus();
  const [me, setMe] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!online || me) return;
    let cancelled = false;
    apiMe()
      .then((account) => {
        if (!cancelled) setMe(account);
      })
      .catch((err) => {
        if (!cancelled) setError(errorText(err, t("errors:generic")));
      });
    return () => {
      cancelled = true;
    };
  }, [online, me, t]);

  return (
    <>
      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>{t("account.title")}</h2>
        {!online ? <p className="muted small">{t("account.offline")}</p> : null}
        {online && error && !me ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {me ? (
          <>
            <p className="muted small">
              {t("account.signedInAs", { login: me.login })}
              {me.role === "owner" ? ` — ${t("account.ownerBadge")}` : ""}
            </p>
            <ChangePasswordForm />
          </>
        ) : null}
      </section>
      {online && me?.role === "owner" ? <HouseholdAdmin /> : null}
    </>
  );
}
