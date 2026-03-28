export function tenantSlugFromLogin(login: string): string {
  const s = login
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s || s.length > 64) throw new Error("Identifiant invalide");
  if (!/^[a-z0-9-]+$/.test(s)) throw new Error("Identifiant invalide");
  return s;
}
