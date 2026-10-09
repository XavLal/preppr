import { chmod, mkdir, readFile, writeFile, readdir, rename, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { coerceAppState } from "./coerceAppState.js";
import { tenantSlugFromLogin } from "./slug.js";
import { normalizeAisleOrder } from "./shopAisles.js";
import type { AppState } from "./types.js";
import {
  DEFAULT_CULINARY_STYLE_CONTEXT,
  DEFAULT_EQUIPMENT_CONTEXT,
  DEFAULT_FAMILY_CONTEXT,
  DEFAULT_INTERACTION_CONTEXT,
  DEFAULT_TASTES_CONTEXT,
} from "./userPromptDefaults.js";

export type AccountRole = "owner" | "member";
export type AccountUser = {
  login: string;
  passwordHash: string;
  role: AccountRole;
  tenantSlug: string;
  sessionVersion: number;
};
export type AccountsFile = { users: AccountUser[] };

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Un chemin relatif est résolu depuis la racine du dépôt, pas depuis le
 * dossier de travail : `npm start` (cwd `server/`) et les commandes lancées
 * à la racine doivent viser le même `data/`.
 */
export function resolveDataRoot(dataDir: string | undefined, fromModuleDir: string): string {
  const repoRoot = path.resolve(fromModuleDir, "../../..");
  const trimmed = dataDir?.trim();
  if (!trimmed) return path.join(repoRoot, "data");
  return path.resolve(repoRoot, trimmed);
}

export function dataRoot(): string {
  return resolveDataRoot(process.env.DATA_DIR, moduleDir);
}

export function accountsPath(): string {
  return path.join(dataRoot(), "accounts.json");
}

export function tenantDir(slug: string): string {
  return path.join(dataRoot(), "tenants", slug);
}

export function statePath(slug: string): string {
  return path.join(tenantDir(slug), "state.json");
}

export function historyDir(slug: string): string {
  return path.join(tenantDir(slug), "history");
}

export function emptyState(): AppState {
  const now = new Date().toISOString();
  return {
    version: 1,
    updatedAt: now,
    recipes: [],
    shoppingLines: [],
    targetPortions: {},
    shopAisleOrder: normalizeAisleOrder([]),
    geminiApiKey: "",
    claudeApiKey: "",
    activeLlm: "gemini",
    familyContext: DEFAULT_FAMILY_CONTEXT,
    tastesContext: DEFAULT_TASTES_CONTEXT,
    culinaryStyleContext: DEFAULT_CULINARY_STYLE_CONTEXT,
    equipmentContext: DEFAULT_EQUIPMENT_CONTEXT,
    interactionContext: DEFAULT_INTERACTION_CONTEXT,
  };
}

export class AccountsFileError extends Error {}

/**
 * Seul un fichier absent vaut « aucun compte » : un fichier illisible ne doit
 * jamais rouvrir la création du compte propriétaire.
 */
export async function loadAccounts(): Promise<AccountsFile> {
  let raw: string;
  try {
    raw = await readFile(accountsPath(), "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { users: [] };
    throw new AccountsFileError(
      `Lecture impossible de ${accountsPath()} : ${(e as Error).message}`
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new AccountsFileError(
      `JSON invalide dans ${accountsPath()} : ${(e as Error).message}`
    );
  }
  return normalizeAccounts(parsed);
}

/** Complète les comptes créés avant les rôles : le premier devient propriétaire. */
export function normalizeAccounts(
  raw: unknown,
  options?: { allowDuplicateSlugs?: boolean }
): AccountsFile {
  const list =
    raw && typeof raw === "object" && Array.isArray((raw as { users?: unknown }).users)
      ? ((raw as { users: unknown[] }).users)
      : null;
  if (!list) {
    throw new AccountsFileError(`Format inattendu dans ${accountsPath()}.`);
  }
  let ownerSeen = false;
  const users: AccountUser[] = list.map((entry, index) => {
    const u = (entry ?? {}) as Partial<AccountUser>;
    if (typeof u.login !== "string" || typeof u.passwordHash !== "string") {
      throw new AccountsFileError(
        `Compte n°${index + 1} incomplet dans ${accountsPath()}.`
      );
    }
    const wantsOwner = u.role === "owner" || (u.role === undefined && index === 0);
    const role: AccountRole = wantsOwner && !ownerSeen ? "owner" : "member";
    if (role === "owner") ownerSeen = true;
    return {
      login: u.login,
      passwordHash: u.passwordHash,
      role,
      tenantSlug:
        typeof u.tenantSlug === "string" && u.tenantSlug
          ? u.tenantSlug
          : tenantSlugFromLogin(u.login),
      sessionVersion:
        typeof u.sessionVersion === "number" && Number.isInteger(u.sessionVersion)
          ? u.sessionVersion
          : 0,
    };
  });
  if (!ownerSeen && users.length > 0) users[0].role = "owner";
  if (!options?.allowDuplicateSlugs) assertUniqueSlugs(users);
  return { users };
}

function assertUniqueSlugs(users: AccountUser[]): void {
  const seen = new Map<string, string>();
  for (const user of users) {
    const previous = seen.get(user.tenantSlug);
    if (previous) {
      throw new AccountsFileError(
        `Les identifiants « ${previous} » et « ${user.login} » partagent le dossier « ${user.tenantSlug} ». ` +
          "Arrêtez Preppr et lancez la commande migrate-accounts, puis redémarrez."
      );
    }
    seen.set(user.tenantSlug, user.login);
  }
}

export async function saveAccounts(data: AccountsFile): Promise<void> {
  const p = accountsPath();
  await mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
  await rename(tmp, p);
}

export async function loadState(slug: string): Promise<AppState> {
  try {
    const raw = await readFile(statePath(slug), "utf-8");
    const s = JSON.parse(raw) as AppState;
    if (typeof s.version !== "number") return emptyState();
    return coerceAppState(s);
  } catch {
    return emptyState();
  }
}

const MAX_SNAPSHOTS = 50;

export async function saveState(slug: string, state: AppState): Promise<void> {
  const dir = tenantDir(slug);
  const hist = historyDir(slug);
  await mkdir(hist, { recursive: true });
  await mkdir(dir, { recursive: true });
  const sp = statePath(slug);
  const snapName = `state-${state.updatedAt.replace(/[:.]/g, "-")}-v${state.version}.json`;
  const snapPath = path.join(hist, snapName);
  const json = JSON.stringify(state, null, 2);
  await writeFile(sp, json, { encoding: "utf-8", mode: 0o600 });
  await writeFile(snapPath, json, { encoding: "utf-8", mode: 0o600 });
  await pruneSnapshots(hist);
}

/** Ramène les fichiers déjà créés (souvent en 0644) à des droits privés. */
export async function restrictDataPermissions(): Promise<void> {
  const root = dataRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  await tighten(root, 0o700);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    await tightenTree(path.join(root, entry.name), entry.isDirectory());
  }
}

async function tightenTree(target: string, isDirectory: boolean): Promise<void> {
  await tighten(target, isDirectory ? 0o700 : 0o600);
  if (!isDirectory) return;
  let entries;
  try {
    entries = await readdir(target, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    await tightenTree(path.join(target, entry.name), entry.isDirectory());
  }
}

async function tighten(target: string, mode: number): Promise<void> {
  try {
    await chmod(target, mode);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EPERM" || code === "EROFS") return;
    throw e;
  }
}

async function pruneSnapshots(hist: string): Promise<void> {
  let files: string[];
  try {
    files = (await readdir(hist)).filter((f) => f.endsWith(".json"));
  } catch {
    return;
  }
  if (files.length <= MAX_SNAPSHOTS) return;
  files.sort();
  const toRemove = files.slice(0, files.length - MAX_SNAPSHOTS);
  for (const f of toRemove) {
    try {
      await unlink(path.join(hist, f));
    } catch {
      /* ignore */
    }
  }
}

