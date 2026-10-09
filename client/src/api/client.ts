import i18n from "@/i18n";
import { clearAuthToken, getAuthToken } from "@/lib/authToken";
import type { AppState } from "@/types";

type ApiErrorBody = { error?: string; code?: string };

function apiErrorMessage(data: ApiErrorBody | null | undefined, fallbackKey: string): string {
  const code = data?.code;
  if (code && i18n.exists(code, { ns: "errors" })) {
    return i18n.t(code, { ns: "errors" });
  }
  if (data?.error) return data.error;
  return i18n.t(fallbackKey, { ns: "errors" });
}

async function apiFetch(
  path: string,
  init?: RequestInit,
  authToken?: string | null
): Promise<Response> {
  const token = authToken === undefined ? getAuthToken() : authToken;
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && token && getAuthToken() === token) {
    const body = (await res.clone().json().catch(() => null)) as ApiErrorBody | null;
    if (body?.code === "auth.invalid_session") {
      clearAuthToken();
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
  }
  return res;
}

export type AccountRole = "owner" | "member";

export type Session = {
  token: string;
  tenantSlug: string;
  login: string;
  role: AccountRole;
};

export type Account = { login: string; role: AccountRole; tenantSlug: string };

async function sessionFrom(res: Response, fallbackKey: string): Promise<Session> {
  const data = (await res.json()) as ApiErrorBody & Partial<Session>;
  if (!res.ok) throw new Error(apiErrorMessage(data, fallbackKey));
  if (!data.token || !data.tenantSlug || !data.login || !data.role) {
    throw new Error(apiErrorMessage(null, "invalid_response"));
  }
  return {
    token: data.token,
    tenantSlug: data.tenantSlug,
    login: data.login,
    role: data.role,
  };
}

export async function apiLogin(body: {
  login: string;
  password: string;
  rememberMe: boolean;
}): Promise<Session> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return sessionFrom(res, "login_failed");
}

export async function apiAuthStatus(): Promise<{ needsSetup: boolean }> {
  const res = await apiFetch("/api/auth/status");
  const data = (await res.json()) as ApiErrorBody & { needsSetup?: boolean };
  if (!res.ok) throw new Error(apiErrorMessage(data, "load_failed"));
  return { needsSetup: data.needsSetup === true };
}

export async function apiSetup(body: {
  login: string;
  password: string;
  setupToken: string;
}): Promise<Session> {
  const res = await apiFetch("/api/auth/setup", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return sessionFrom(res, "setup_failed");
}

export async function apiMe(): Promise<Account> {
  const res = await apiFetch("/api/auth/me");
  const data = (await res.json()) as ApiErrorBody & Account;
  if (!res.ok) throw new Error(apiErrorMessage(data, "load_failed"));
  return { login: data.login, role: data.role, tenantSlug: data.tenantSlug };
}

export async function apiChangePassword(body: {
  currentPassword: string;
  newPassword: string;
}): Promise<Session> {
  const res = await apiFetch("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return sessionFrom(res, "password_change_failed");
}

export async function apiListAccounts(): Promise<Account[]> {
  const res = await apiFetch("/api/accounts");
  const data = (await res.json()) as ApiErrorBody & { accounts?: Account[] };
  if (!res.ok) throw new Error(apiErrorMessage(data, "load_failed"));
  return data.accounts ?? [];
}

export async function apiCreateAccount(body: {
  login: string;
  password: string;
}): Promise<Account> {
  const res = await apiFetch("/api/accounts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as ApiErrorBody & Account;
  if (!res.ok) throw new Error(apiErrorMessage(data, "account_create_failed"));
  return { login: data.login, role: data.role, tenantSlug: data.tenantSlug };
}

export async function apiResetPassword(login: string, newPassword: string): Promise<void> {
  const res = await apiFetch(`/api/accounts/${encodeURIComponent(login)}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
  const data = (await res.json()) as ApiErrorBody;
  if (!res.ok) throw new Error(apiErrorMessage(data, "password_reset_failed"));
}

export async function apiGetState(authToken?: string | null): Promise<AppState> {
  const res = await apiFetch("/api/state", undefined, authToken);
  const data = (await res.json()) as AppState & ApiErrorBody;
  if (!res.ok) throw new Error(apiErrorMessage(data, "load_failed"));
  return data as AppState;
}

export type PutStateResult =
  | { ok: true; state: AppState }
  | { ok: false; conflict: AppState | null; message: string };

function conflictStateFromResponse(data: unknown): AppState {
  if (
    data &&
    typeof data === "object" &&
    "state" in data &&
    (data as { state: unknown }).state &&
    typeof (data as { state: unknown }).state === "object"
  ) {
    return (data as { state: AppState }).state;
  }
  return data as AppState;
}

export async function apiPutState(
  expectedVersion: number,
  state: AppState,
  authToken?: string | null
): Promise<PutStateResult> {
  const res = await apiFetch("/api/state", {
    method: "PUT",
    body: JSON.stringify({ expectedVersion, state }),
  }, authToken);
  const data = (await res.json()) as AppState & ApiErrorBody & { state?: AppState };
  if (res.status === 409) {
    return {
      ok: false,
      conflict: conflictStateFromResponse(data),
      message: apiErrorMessage(data, "state.version_conflict"),
    };
  }
  if (!res.ok) {
    return { ok: false, conflict: null, message: apiErrorMessage(data, "save_failed") };
  }
  return { ok: true, state: data as AppState };
}

export async function apiImportJson(
  jsonText: string,
  authToken?: string | null
): Promise<AppState> {
  const res = await apiFetch("/api/import", {
    method: "POST",
    body: JSON.stringify({ json: jsonText }),
  }, authToken);
  const data = (await res.json()) as AppState & ApiErrorBody;
  if (!res.ok) throw new Error(apiErrorMessage(data, "import_failed"));
  return data as AppState;
}

export async function apiClearRecipes(
  expectedVersion: number,
  authToken?: string | null
): Promise<PutStateResult> {
  const res = await apiFetch("/api/clear-recipes", {
    method: "POST",
    body: JSON.stringify({ expectedVersion }),
  }, authToken);
  const data = (await res.json()) as AppState & ApiErrorBody & { state?: AppState };
  if (res.status === 409) {
    return {
      ok: false,
      conflict: conflictStateFromResponse(data),
      message: apiErrorMessage(data, "state.version_conflict"),
    };
  }
  if (!res.ok) {
    throw new Error(apiErrorMessage(data, "delete_failed"));
  }
  return { ok: true, state: data as AppState };
}

export type RecipeUrlCheckResult =
  | { determined: true; status: number }
  | { determined: false };

export async function apiCheckRecipeUrl(
  url: string
): Promise<RecipeUrlCheckResult> {
  const res = await apiFetch("/api/recipe-url-check", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  const data = (await res.json()) as RecipeUrlCheckResult & ApiErrorBody;
  if (!res.ok) throw new Error(apiErrorMessage(data, "url_check_failed"));
  if (data.determined === true && typeof data.status === "number") {
    return { determined: true, status: data.status };
  }
  return { determined: false };
}

export async function apiClearShopping(
  expectedVersion: number,
  authToken?: string | null
): Promise<PutStateResult> {
  const res = await apiFetch("/api/clear-shopping", {
    method: "POST",
    body: JSON.stringify({ expectedVersion }),
  }, authToken);
  const data = (await res.json()) as AppState & ApiErrorBody & { state?: AppState };
  if (res.status === 409) {
    return {
      ok: false,
      conflict: conflictStateFromResponse(data),
      message: apiErrorMessage(data, "state.version_conflict"),
    };
  }
  if (!res.ok) {
    throw new Error(apiErrorMessage(data, "clear_shopping_failed"));
  }
  return { ok: true, state: data as AppState };
}
