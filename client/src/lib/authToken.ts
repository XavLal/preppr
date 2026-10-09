const KEY = "preppr_token";

let generation = 0;

export function authGeneration(): number {
  return generation;
}

function subjectOf(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const payload = JSON.parse(atob(b64)) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string, remember: boolean): void {
  const previous = subjectOf(getAuthToken());
  if (remember) {
    localStorage.setItem(KEY, token);
    sessionStorage.removeItem(KEY);
  } else {
    sessionStorage.setItem(KEY, token);
    localStorage.removeItem(KEY);
  }
  if (previous !== subjectOf(token)) generation += 1;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
}

export function isAuthTokenRemembered(): boolean {
  return localStorage.getItem(KEY) !== null;
}

export function clearAuthToken(): void {
  generation += 1;
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
