import i18n from "@/i18n";
import { getAuthToken } from "@/lib/authToken";
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

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers });
}

export async function apiLogin(body: {
  login: string;
  password: string;
  rememberMe: boolean;
}): Promise<{ token: string; tenantSlug: string; login: string }> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as ApiErrorBody & {
    token?: string;
    tenantSlug?: string;
    login?: string;
  };
  if (!res.ok) throw new Error(apiErrorMessage(data, "login_failed"));
  if (!data.token) throw new Error(apiErrorMessage(null, "invalid_response"));
  return {
    token: data.token,
    tenantSlug: data.tenantSlug!,
    login: data.login!,
  };
}

export async function apiGetState(): Promise<AppState> {
  const res = await apiFetch("/api/state");
  const data = (await res.json()) as AppState & ApiErrorBody;
  if (!res.ok) throw new Error(apiErrorMessage(data, "load_failed"));
  return data as AppState;
}

export type PutStateResult =
  | { ok: true; state: AppState }
  | { ok: false; conflict: AppState; message: string };

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
  state: AppState
): Promise<PutStateResult> {
  const res = await apiFetch("/api/state", {
    method: "PUT",
    body: JSON.stringify({ expectedVersion, state }),
  });
  const data = (await res.json()) as AppState & ApiErrorBody & { state?: AppState };
  if (res.status === 409) {
    return {
      ok: false,
      conflict: conflictStateFromResponse(data),
      message: apiErrorMessage(data, "state.version_conflict"),
    };
  }
  if (!res.ok) {
    throw new Error(apiErrorMessage(data, "save_failed"));
  }
  return { ok: true, state: data as AppState };
}

export async function apiImportJson(jsonText: string): Promise<AppState> {
  const res = await apiFetch("/api/import", {
    method: "POST",
    body: JSON.stringify({ json: jsonText }),
  });
  const data = (await res.json()) as AppState & ApiErrorBody;
  if (!res.ok) throw new Error(apiErrorMessage(data, "import_failed"));
  return data as AppState;
}

export async function apiClearRecipes(
  expectedVersion: number
): Promise<PutStateResult> {
  const res = await apiFetch("/api/clear-recipes", {
    method: "POST",
    body: JSON.stringify({ expectedVersion }),
  });
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
  expectedVersion: number
): Promise<PutStateResult> {
  const res = await apiFetch("/api/clear-shopping", {
    method: "POST",
    body: JSON.stringify({ expectedVersion }),
  });
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
