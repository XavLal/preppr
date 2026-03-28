import { getAuthToken } from "@/lib/authToken";
import type { AppState } from "@/types";

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
  const data = (await res.json()) as { error?: string; token?: string; tenantSlug?: string; login?: string };
  if (!res.ok) throw new Error(data.error ?? "Connexion impossible");
  if (!data.token) throw new Error("Réponse invalide");
  return {
    token: data.token,
    tenantSlug: data.tenantSlug!,
    login: data.login!,
  };
}

export async function apiGetState(): Promise<AppState> {
  const res = await apiFetch("/api/state");
  const data = (await res.json()) as AppState & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Chargement impossible");
  return data as AppState;
}

export type PutStateResult =
  | { ok: true; state: AppState }
  | { ok: false; conflict: AppState; message: string };

export async function apiPutState(
  expectedVersion: number,
  state: AppState
): Promise<PutStateResult> {
  const res = await apiFetch("/api/state", {
    method: "PUT",
    body: JSON.stringify({ expectedVersion, state }),
  });
  const data = (await res.json()) as AppState & { error?: string };
  if (res.status === 409) {
    return {
      ok: false,
      conflict: data as AppState,
      message: data.error ?? "Conflit de version",
    };
  }
  if (!res.ok) {
    throw new Error(data.error ?? "Enregistrement impossible");
  }
  return { ok: true, state: data as AppState };
}

export async function apiImportJson(jsonText: string): Promise<AppState> {
  const res = await apiFetch("/api/import", {
    method: "POST",
    body: JSON.stringify({ json: jsonText }),
  });
  const data = (await res.json()) as AppState & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Import impossible");
  return data as AppState;
}
