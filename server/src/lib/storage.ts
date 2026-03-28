import { mkdir, readFile, writeFile, readdir, unlink } from "fs/promises";
import path from "path";
import type { AppState } from "./types.js";

export type AccountUser = { login: string; passwordHash: string };
export type AccountsFile = { users: AccountUser[] };

export function dataRoot(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "data");
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
  };
}

export async function loadAccounts(): Promise<AccountsFile> {
  try {
    const raw = await readFile(accountsPath(), "utf-8");
    return JSON.parse(raw) as AccountsFile;
  } catch {
    return { users: [] };
  }
}

export async function saveAccounts(data: AccountsFile): Promise<void> {
  const p = accountsPath();
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(data, null, 2), "utf-8");
}

export async function loadState(slug: string): Promise<AppState> {
  try {
    const raw = await readFile(statePath(slug), "utf-8");
    const s = JSON.parse(raw) as AppState;
    if (typeof s.version !== "number") return emptyState();
    return s;
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
  await writeFile(sp, JSON.stringify(state, null, 2), "utf-8");
  await writeFile(snapPath, JSON.stringify(state, null, 2), "utf-8");
  await pruneSnapshots(hist);
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

