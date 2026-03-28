const KEY = "mealplanner_token";

export function setAuthToken(token: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(KEY, token);
    sessionStorage.removeItem(KEY);
  } else {
    sessionStorage.setItem(KEY, token);
    localStorage.removeItem(KEY);
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
}

export function clearAuthToken(): void {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
