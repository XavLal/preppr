import { existsSync } from "fs";
import { mkdir, open, readFile, rm } from "fs/promises";
import path from "path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { dataRoot } from "./storage.js";

export function jwtSecretPath(): string {
  return path.join(dataRoot(), "jwt-secret");
}

export async function resolveJwtSecret(): Promise<string> {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;
  return readOrCreateSecret(jwtSecretPath());
}

export function setupTokenPath(): string {
  return path.join(dataRoot(), "setup-token");
}

export async function ensureSetupToken(): Promise<string> {
  return readOrCreateSecret(setupTokenPath());
}

export async function readSetupToken(): Promise<string | null> {
  try {
    const stored = (await readFile(setupTokenPath(), "utf-8")).trim();
    return stored || null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function clearSetupToken(): Promise<void> {
  await rm(setupTokenPath(), { force: true });
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function readOrCreateSecret(file: string): Promise<string> {
  const existing = await readSecret(file);
  if (existing) return existing;
  const secret = randomBytes(32).toString("hex");
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    const handle = await open(file, "wx", 0o600);
    try {
      await handle.writeFile(`${secret}\n`);
    } finally {
      await handle.close();
    }
    return secret;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  const winner = await readSecret(file);
  if (!winner) throw new Error(`Secret illisible : ${file}`);
  return winner;
}

async function readSecret(file: string): Promise<string | null> {
  try {
    const stored = (await readFile(file, "utf-8")).trim();
    return stored || null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export function resolveStaticDir(serverDistDir: string): string | undefined {
  const fromEnv = process.env.CLIENT_DIST?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const candidates = [
    path.resolve(serverDistDir, "../../static"),
    path.resolve(serverDistDir, "../../client/dist"),
  ];
  return candidates.find((dir) => existsSync(path.join(dir, "index.html")));
}
