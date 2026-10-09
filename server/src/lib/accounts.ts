import bcrypt from "bcrypt";
import { cp, readFile, rename, rm, stat } from "fs/promises";
import { z } from "zod";
import { tenantSlugFromLogin } from "./slug.js";
import {
  accountsPath,
  loadAccounts,
  normalizeAccounts,
  saveAccounts,
  tenantDir,
  type AccountRole,
  type AccountsFile,
  type AccountUser,
} from "./storage.js";
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_BYTES = 72;

export const credentialsSchema = z.object({
  login: z.string().trim().min(1),
  password: z.string(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string(),
});

export const renameAccountSchema = z.object({
  login: z.string().trim().min(1),
});

export type AccountErrorCode =
  | "auth.invalid_login"
  | "auth.password_too_short"
  | "auth.password_too_long"
  | "auth.rate_limited"
  | "auth.setup_token"
  | "auth.invalid_credentials"
  | "auth.wrong_password"
  | "auth.setup_done"
  | "accounts.login_taken"
  | "accounts.forbidden"
  | "accounts.not_found"
  | "accounts.self_reset"
  | "accounts.self_rename"
  | "accounts.self_delete"
  | "accounts.missing_login"
  | "accounts.slug_busy";

const STATUS: Record<AccountErrorCode, number> = {
  "auth.invalid_login": 400,
  "auth.password_too_short": 400,
  "auth.password_too_long": 400,
  "auth.rate_limited": 429,
  "auth.setup_token": 401,
  "auth.invalid_credentials": 401,
  "auth.wrong_password": 400,
  "auth.setup_done": 409,
  "accounts.login_taken": 409,
  "accounts.forbidden": 403,
  "accounts.not_found": 404,
  "accounts.self_reset": 400,
  "accounts.self_rename": 400,
  "accounts.self_delete": 400,
  "accounts.missing_login": 400,
  "accounts.slug_busy": 409,
};

const MESSAGES: Record<AccountErrorCode, string> = {
  "auth.invalid_login": "Identifiant invalide (lettres, chiffres, tirets).",
  "auth.password_too_short": `Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum).`,
  "auth.password_too_long": `Mot de passe trop long (${MAX_PASSWORD_BYTES} octets maximum).`,
  "auth.rate_limited": "Trop de tentatives. Réessayez dans quelques minutes.",
  "auth.setup_token": "Code d'installation incorrect.",
  "auth.invalid_credentials": "Identifiant ou mot de passe incorrect.",
  "auth.wrong_password": "Mot de passe actuel incorrect.",
  "auth.setup_done": "Le compte administrateur existe déjà.",
  "accounts.login_taken": "Cet identifiant existe déjà.",
  "accounts.forbidden": "Réservé au compte administrateur.",
  "accounts.not_found": "Compte introuvable.",
  "accounts.self_reset": "Changez votre propre mot de passe depuis « Mon compte ».",
  "accounts.self_rename": "Le compte administrateur ne peut pas être renommé.",
  "accounts.self_delete": "Le compte administrateur ne peut pas être supprimé.",
  "accounts.missing_login": "Nouvel identifiant requis.",
  "accounts.slug_busy": "Un dossier de données existe déjà pour cet identifiant.",
};

export class AccountError extends Error {
  readonly status: number;
  constructor(readonly code: AccountErrorCode) {
    super(MESSAGES[code]);
    this.status = STATUS[code];
  }
}

export type PublicAccount = Pick<AccountUser, "login" | "role" | "tenantSlug">;

export function toPublicAccount(u: AccountUser): PublicAccount {
  return { login: u.login, role: u.role, tenantSlug: u.tenantSlug };
}

function assertPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AccountError("auth.password_too_short");
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    throw new AccountError("auth.password_too_long");
  }
}

function slugOrThrow(login: string): string {
  try {
    return tenantSlugFromLogin(login);
  } catch {
    throw new AccountError("auth.invalid_login");
  }
}

function conflictingUser(
  file: AccountsFile,
  login: string,
  tenantSlug: string,
  exceptSlug?: string
): boolean {
  const lower = login.trim().toLowerCase();
  return file.users.some(
    (u) =>
      u.tenantSlug !== exceptSlug &&
      (u.tenantSlug === tenantSlug || u.login.toLowerCase() === lower)
  );
}

/** Deux identifiants qui donnent le même slug partageraient le même dossier de données. */
export function addAccount(
  file: AccountsFile,
  login: string,
  passwordHash: string
): { file: AccountsFile; user: AccountUser } {
  const trimmed = login.trim();
  const tenantSlug = slugOrThrow(trimmed);
  if (conflictingUser(file, trimmed, tenantSlug)) {
    throw new AccountError("accounts.login_taken");
  }
  const role: AccountRole = file.users.length === 0 ? "owner" : "member";
  const user: AccountUser = { login: trimmed, passwordHash, role, tenantSlug, sessionVersion: 0 };
  return { file: { users: [...file.users, user] }, user };
}

let cache: { file: AccountsFile; mtimeMs: number } | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function accountsMtime(): Promise<number> {
  try {
    return (await stat(accountsPath())).mtimeMs;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw e;
  }
}

/** Relit le fichier s’il a changé sur disque (ex. commande de secours lancée à côté du serveur). */
export async function readAccounts(): Promise<AccountsFile> {
  const mtimeMs = await accountsMtime();
  if (!cache || cache.mtimeMs !== mtimeMs) {
    cache = { file: await loadAccounts(), mtimeMs };
  }
  return cache.file;
}

export function clearAccountsCache(): void {
  cache = null;
}

function withAccountsLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function writeAccounts(file: AccountsFile): Promise<void> {
  await saveAccounts(file);
  cache = { file, mtimeMs: await accountsMtime() };
}

function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function findByLogin(file: AccountsFile, login: string): AccountUser | undefined {
  const lower = login.trim().toLowerCase();
  return file.users.find((u) => u.login.toLowerCase() === lower);
}

export function findBySlug(file: AccountsFile, slug: string): AccountUser | undefined {
  return file.users.find((u) => u.tenantSlug === slug);
}

export async function needsSetup(): Promise<boolean> {
  return (await readAccounts()).users.length === 0;
}

export async function verifyCredentials(login: string, password: string): Promise<AccountUser> {
  const user = findByLogin(await readAccounts(), login);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AccountError("auth.invalid_credentials");
  }
  return user;
}

export function setupOwner(login: string, password: string): Promise<AccountUser> {
  return withAccountsLock(async () => {
    assertPassword(password);
    const file = await loadAccounts();
    if (file.users.length > 0) throw new AccountError("auth.setup_done");
    const next = addAccount(file, login, await hashPassword(password));
    await writeAccounts(next.file);
    return next.user;
  });
}

/** Utilisé par le CLI : le premier compte créé devient propriétaire. */
export function createAccount(login: string, password: string): Promise<AccountUser> {
  return withAccountsLock(async () => {
    assertPassword(password);
    const file = await loadAccounts();
    const next = addAccount(file, login, await hashPassword(password));
    await writeAccounts(next.file);
    return next.user;
  });
}

async function requireOwner(file: AccountsFile, actorSlug: string): Promise<AccountUser> {
  const actor = findBySlug(file, actorSlug);
  if (!actor || actor.role !== "owner") throw new AccountError("accounts.forbidden");
  return actor;
}

export async function listAccounts(actorSlug: string): Promise<PublicAccount[]> {
  const file = await readAccounts();
  await requireOwner(file, actorSlug);
  return file.users.map(toPublicAccount);
}

export function createMember(
  actorSlug: string,
  login: string,
  password: string
): Promise<AccountUser> {
  return withAccountsLock(async () => {
    const file = await loadAccounts();
    await requireOwner(file, actorSlug);
    assertPassword(password);
    const next = addAccount(file, login, await hashPassword(password));
    await writeAccounts(next.file);
    return next.user;
  });
}

function replaceUser(file: AccountsFile, previousSlug: string, updated: AccountUser): AccountsFile {
  return {
    users: file.users.map((u) => (u.tenantSlug === previousSlug ? updated : u)),
  };
}

async function setPassword(
  file: AccountsFile,
  user: AccountUser,
  newPassword: string
): Promise<AccountUser> {
  const updated: AccountUser = {
    ...user,
    passwordHash: await hashPassword(newPassword),
    sessionVersion: user.sessionVersion + 1,
  };
  await writeAccounts(replaceUser(file, user.tenantSlug, updated));
  return updated;
}

export function changePassword(
  actorSlug: string,
  currentPassword: string,
  newPassword: string
): Promise<AccountUser> {
  return withAccountsLock(async () => {
    const file = await loadAccounts();
    const user = findBySlug(file, actorSlug);
    if (!user) throw new AccountError("accounts.not_found");
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AccountError("auth.wrong_password");
    }
    assertPassword(newPassword);
    return setPassword(file, user, newPassword);
  });
}

export function resetPassword(
  actorSlug: string,
  targetLogin: string,
  newPassword: string
): Promise<AccountUser> {
  return withAccountsLock(async () => {
    const file = await loadAccounts();
    const actor = await requireOwner(file, actorSlug);
    const target = findByLogin(file, targetLogin);
    if (!target) throw new AccountError("accounts.not_found");
    if (target.tenantSlug === actor.tenantSlug) throw new AccountError("accounts.self_reset");
    assertPassword(newPassword);
    return setPassword(file, target, newPassword);
  });
}

function assertTenantSlug(slug: string): void {
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) throw new AccountError("auth.invalid_login");
}

/**
 * Le dossier suit l’identifiant : deux logins qui se normalisent pareil
 * ne doivent pas viser les mêmes recettes. Un renommage déplace donc le dossier.
 */
async function moveTenantDir(fromSlug: string, toSlug: string): Promise<boolean> {
  assertTenantSlug(fromSlug);
  assertTenantSlug(toSlug);
  const source = tenantDir(fromSlug);
  const dest = tenantDir(toSlug);
  let destExists = true;
  try {
    await stat(dest);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") destExists = false;
    else throw e;
  }
  if (destExists) throw new AccountError("accounts.slug_busy");
  try {
    await stat(source);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
  await rename(source, dest);
  return true;
}

async function removeTenantDir(slug: string): Promise<void> {
  assertTenantSlug(slug);
  await rm(tenantDir(slug), { recursive: true, force: true });
}

function memberOrThrow(
  actor: AccountUser,
  target: AccountUser,
  code: "accounts.self_rename" | "accounts.self_delete"
): void {
  if (target.role === "owner" || target.tenantSlug === actor.tenantSlug) {
    throw new AccountError(code);
  }
}

export function renameMember(
  actorSlug: string,
  targetLogin: string,
  newLogin: string
): Promise<AccountUser> {
  return withAccountsLock(async () => {
    const file = await loadAccounts();
    const actor = await requireOwner(file, actorSlug);
    const target = findByLogin(file, targetLogin);
    if (!target) throw new AccountError("accounts.not_found");
    memberOrThrow(actor, target, "accounts.self_rename");
    const trimmed = newLogin.trim();
    const nextSlug = slugOrThrow(trimmed);
    if (conflictingUser(file, trimmed, nextSlug, target.tenantSlug)) {
      throw new AccountError("accounts.login_taken");
    }
    if (trimmed === target.login) return target;

    const slugChanged = nextSlug !== target.tenantSlug;
    const moved = slugChanged ? await moveTenantDir(target.tenantSlug, nextSlug) : false;
    const updated: AccountUser = {
      ...target,
      login: trimmed,
      tenantSlug: nextSlug,
      sessionVersion: target.sessionVersion + 1,
    };
    try {
      await writeAccounts(replaceUser(file, target.tenantSlug, updated));
    } catch (e) {
      if (moved) {
        await rename(tenantDir(nextSlug), tenantDir(target.tenantSlug)).catch(() => undefined);
      }
      throw e;
    }
    return updated;
  });
}

export function deleteMember(actorSlug: string, targetLogin: string): Promise<void> {
  return withAccountsLock(async () => {
    const file = await loadAccounts();
    const actor = await requireOwner(file, actorSlug);
    const target = findByLogin(file, targetLogin);
    if (!target) throw new AccountError("accounts.not_found");
    memberOrThrow(actor, target, "accounts.self_delete");
    await writeAccounts({
      users: file.users.filter((u) => u.tenantSlug !== target.tenantSlug),
    });
    try {
      await removeTenantDir(target.tenantSlug);
    } catch (e) {
      await writeAccounts(file);
      throw e;
    }
  });
}

function availableSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`;
    const stem = (base.slice(0, 64 - suffix.length).replace(/-+$/g, "") || "foyer");
    const candidate = `${stem}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new AccountError("accounts.login_taken");
}

/**
 * Donne un dossier distinct aux comptes qui normalisaient vers le même slug.
 * Le premier conserve le dossier existant ; les suivants en reçoivent une copie.
 */
export async function migrateDuplicateSlugs(): Promise<
  { login: string; from: string; to: string }[]
> {
  return withAccountsLock(async () => {
    let raw: string;
    try {
      raw = await readFile(accountsPath(), "utf-8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
    const file = normalizeAccounts(JSON.parse(raw), { allowDuplicateSlugs: true });
    const used = new Set<string>();
    const moved: { login: string; from: string; to: string }[] = [];
    const users = file.users.map((user) => {
      const nextSlug = availableSlug(user.tenantSlug, used);
      used.add(nextSlug);
      if (nextSlug === user.tenantSlug) return user;
      moved.push({ login: user.login, from: user.tenantSlug, to: nextSlug });
      return { ...user, tenantSlug: nextSlug };
    });
    for (const change of moved) {
      try {
        await cp(tenantDir(change.from), tenantDir(change.to), {
          recursive: true,
          force: false,
          errorOnExist: false,
        });
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code !== "ENOENT" && code !== "ERR_FS_CP_EEXIST") throw e;
      }
    }
    if (moved.length > 0) await writeAccounts({ users });
    return moved;
  });
}

/** Secours CLI : aucune vérification de rôle, l’accès à la machine tient lieu de preuve. */
export function forceResetPassword(login: string, newPassword: string): Promise<AccountUser> {
  return withAccountsLock(async () => {
    assertPassword(newPassword);
    const file = await loadAccounts();
    const target = findByLogin(file, login);
    if (!target) throw new AccountError("accounts.not_found");
    return setPassword(file, target, newPassword);
  });
}
